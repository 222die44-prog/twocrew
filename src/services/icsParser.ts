// src/services/icsParser.ts
import type { EventItem } from "./schedule";

type Role = "HAN" | "KYU";

type Kind =
  | "FLIGHT"
  | "LO"
  | "DO"
  | "RDO"
  | "ALM"
  | "ALV"
  | "RESERVE"
  | "HM_STBY"
  | "AP_STBY"
  | "RCRM"
  | "JCRM"
  | "EMER"
  | "OTHER";

function uniqId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** RFC5545: 줄바꿈 접힘(line folding) 해제 */
function unfoldLines(text: string) {
  // "\r\n " 또는 "\n " 로 시작하는 다음줄은 이전줄에 이어붙임
  return text.replace(/\r?\n[ \t]/g, "");
}

/** "KEY;PARAM=...:VALUE" 형태 파싱 */
function parseIcsLine(line: string) {
  const idx = line.indexOf(":");
  if (idx < 0) return null;
  const left = line.slice(0, idx);
  const value = line.slice(idx + 1);

  const [key, ...paramsRaw] = left.split(";");
  const params: Record<string, string> = {};
  for (const p of paramsRaw) {
    const eq = p.indexOf("=");
    if (eq > -1) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }

  return { key: key.toUpperCase(), params, value };
}

/**
 * DTSTART / DTEND 값 파싱
 * - 20260307 (DATE)  -> all-day
 * - 20260307T083000Z -> UTC
 * - 20260307T083000  -> 로컬시간(개발 PC 타임존 기준. 보통 KST)
 */
function parseDt(value: string) {
  const v = value.trim();

  // DATE (YYYYMMDD)
  if (/^\d{8}$/.test(v)) {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(4, 6));
    const d = Number(v.slice(6, 8));
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    return { date: start, isDateOnly: true };
  }

  // DATETIME
  // ex) 20260307T083000Z or 20260307T083000
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) {
    // fallback: Date가 알아서 해석 (가능하면)
    return { date: new Date(v), isDateOnly: false };
  }

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = m[6] ? Number(m[6]) : 0;
  const isZ = !!m[7];

  const date = isZ
    ? new Date(Date.UTC(y, mo - 1, d, hh, mm, ss))
    : new Date(y, mo - 1, d, hh, mm, ss);

  return { date, isDateOnly: false };
}

function inferKindFromSummary(summary: string): Kind {
  const s = summary.trim().toUpperCase();

  // 정확히 duty 코드면 그대로
  const dutySet = new Set<Kind>([
    "LO",
    "DO",
    "RDO",
    "ALM",
    "ALV",
    "RESERVE",
    "HM_STBY",
    "AP_STBY",
    "RCRM",
    "JCRM",
    "EMER",
  ]);

  if (dutySet.has(s as Kind)) return s as Kind;

  // 편명 패턴이면 FLIGHT
  if (/\b[A-Z]{1,3}\d{2,4}\b/.test(s)) return "FLIGHT";

  return "OTHER";
}

function isAllDayByParsed(dtStartIsDateOnly: boolean, dtEndIsDateOnly: boolean) {
  return dtStartIsDateOnly || dtEndIsDateOnly;
}

export function parseIcsTextToEvents(icsText: string, owner: Role): EventItem[] {
  const text = unfoldLines(icsText);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const out: EventItem[] = [];
  const seen = new Set<string>();

  let inEvent = false;

  // temp fields
  let dtStart: Date | null = null;
  let dtEnd: Date | null = null;
  let dtStartIsDateOnly = false;
  let dtEndIsDateOnly = false;
  let summary = "";
  let description = "";

  function pushEvent() {
    if (!dtStart || !dtEnd) return;

    const kind = inferKindFromSummary(summary || description || "OTHER");
    const allDay = isAllDayByParsed(dtStartIsDateOnly, dtEndIsDateOnly);

    // title 규칙:
    // - duty 코드면 "DO" 같은 걸 그대로
    // - 그 외는 SUMMARY
    const title = summary || (kind !== "OTHER" ? kind : "OTHER");

    const e: EventItem = {
      id: uniqId(`ics-${owner}`),
      owner,
      start: dtStart.toISOString(),
      end: dtEnd.toISOString(),
      title,
      ...({ kind, allDay } as any),
    } as any;

    const sig = `${e.owner}|${(e as any).kind}|${e.title}|${e.start}|${e.end}`;
    if (seen.has(sig)) return;
    seen.add(sig);

    out.push(e);
  }

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      dtStart = null;
      dtEnd = null;
      dtStartIsDateOnly = false;
      dtEndIsDateOnly = false;
      summary = "";
      description = "";
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent) pushEvent();
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const parsed = parseIcsLine(line);
    if (!parsed) continue;

    const { key, value } = parsed;

    if (key === "DTSTART") {
      const p = parseDt(value);
      dtStart = p.date;
      dtStartIsDateOnly = p.isDateOnly;
    } else if (key === "DTEND") {
      const p = parseDt(value);
      dtEnd = p.date;
      dtEndIsDateOnly = p.isDateOnly;
    } else if (key === "SUMMARY") {
      summary = value.replace(/\\n/g, "\n").trim();
    } else if (key === "DESCRIPTION") {
      description = value.replace(/\\n/g, "\n").trim();
    }
  }

  return out;
}