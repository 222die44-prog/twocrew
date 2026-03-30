// src/utils/icsImport.ts
import type { EventItem } from "../services/schedule";

type Role = "HAN" | "KYU";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function unfoldIcsLines(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function normalizeSummary(raw: string) {
  return normalizeSpaces(
    raw
      .replace(/\\,/g, ",")
      .replace(/\\;/g, ";")
      .replace(/\\n/gi, " ")
      .replace(/\b([A-Z]{1,3})\s+(\d{2,4})\b/g, "$1$2")
      .replace(/\b([A-Z]{3})\s*-\s*([A-Z]{3})\b/g, "$1-$2")
      .replace(/\bLO\s*\(\s*([A-Z]{3})\s*\)\b/gi, "LO $1")
      .replace(/\b([A-Z]{3})\s+LO\b/gi, "LO $1")
  );
}

function parseIcsDate(raw: string) {
  const v = raw.trim();

  if (/^\d{8}$/.test(v)) {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(4, 6));
    const d = Number(v.slice(6, 8));
    return `${y}-${pad(m)}-${pad(d)}T00:00:00`;
  }

  if (/^\d{8}T\d{6}Z$/.test(v)) {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(4, 6));
    const d = Number(v.slice(6, 8));
    const hh = Number(v.slice(9, 11));
    const mm = Number(v.slice(11, 13));
    const ss = Number(v.slice(13, 15));

    const utc = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
    const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);

    return `${kst.getFullYear()}-${pad(kst.getMonth() + 1)}-${pad(kst.getDate())}T${pad(
      kst.getHours()
    )}:${pad(kst.getMinutes())}:${pad(kst.getSeconds())}`;
  }

  if (/^\d{8}T\d{6}$/.test(v)) {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(4, 6));
    const d = Number(v.slice(6, 8));
    const hh = Number(v.slice(9, 11));
    const mm = Number(v.slice(11, 13));
    const ss = Number(v.slice(13, 15));

    return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  }

  if (/^\d{8}T\d{4}$/.test(v)) {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(4, 6));
    const d = Number(v.slice(6, 8));
    const hh = Number(v.slice(9, 11));
    const mm = Number(v.slice(11, 13));

    return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00`;
  }

  return v;
}

function detectKind(summary: string): EventItem["kind"] | "IGNORE" {
  const s = normalizeSummary(summary).toUpperCase();

  if (/REPORT TIME|DEBRIEF TIME/.test(s)) return "IGNORE";

  // 원본 LO는 읽지 않고 버릴 예정
  if (
    s === "LO" ||
    s.startsWith("LO ") ||
    /\bLO\b/.test(s) ||
    /LAYOVER|STAYOVER|REST/.test(s)
  ) {
    return "LO";
  }

  if (/\b[A-Z]{1,3}\d{2,4}\b/.test(s) && /\b[A-Z]{3}-[A-Z]{3}\b/.test(s)) {
    return "FLIGHT";
  }

  if (s.startsWith("ATDO")) return "ATDO";
  if (s.startsWith("ADO")) return "ADO";
  if (s.startsWith("YYC") || s.startsWith("YVC")) return "YYC";
  if (s.startsWith("DO")) return "DO";
  if (s.startsWith("RESERVE")) return "RESERVE";
  if (s.startsWith("BLANK")) return "BLANK";
  if (s.startsWith("RDO")) return "RDO";
  if (s.startsWith("ALM")) return "ALM";
  if (s.startsWith("ALV")) return "ALV";

  // HM/AP standby 계열은 전부 RESERVE로 통일
 if (/^HM[ _-]?STBY\d*\b/.test(s)) return "HM_STBY";
if (/^AP[ _-]?STBY\d*\b/.test(s)) return "AP_STBY";
if (/^HM[ _-]?SBY\d*\b/.test(s)) return "HM_STBY";
if (/^AP[ _-]?SBY\d*\b/.test(s)) return "AP_STBY";

if (/^HM\b.*\b(STBY|SBY)\d*\b/.test(s)) return "HM_STBY";
if (/^AP\b.*\b(STBY|SBY)\d*\b/.test(s)) return "AP_STBY";

  if (s.startsWith("RCRM")) return "RCRM";
  if (s.startsWith("JCRM")) return "JCRM";
  if (s.startsWith("EMER")) return "EMER";

  return "OTHER";
}

function extractField(block: string, fieldName: string) {
  const lines = block.split("\n");
  const upper = fieldName.toUpperCase();

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;

    const left = line.slice(0, idx).toUpperCase();
    const right = line.slice(idx + 1).trim();

    if (left === upper || left.startsWith(`${upper};`)) {
      return right;
    }
  }

  return null;
}

function routeFromTitle(title: string) {
  const m = title.match(/\b([A-Z]{3})-([A-Z]{3})\b/);
  if (!m) return null;
  return { from: m[1], to: m[2] };
}

export function parseIcsToEvents(text: string, owner: Role): EventItem[] {
  const normalized = unfoldIcsLines(text);
  const events: EventItem[] = [];
  const blocks = normalized.split("BEGIN:VEVENT").slice(1);

  for (const rawBlock of blocks) {
    const block = rawBlock.split("END:VEVENT")[0];

    const summaryRaw = extractField(block, "SUMMARY");
    const dtStartRaw = extractField(block, "DTSTART");
    const dtEndRaw = extractField(block, "DTEND");
    const uidRaw = extractField(block, "UID");

    if (!summaryRaw || !dtStartRaw) continue;

    const title = normalizeSummary(summaryRaw);
    const kind = detectKind(title);
    if (kind === "IGNORE") continue;

    const start = parseIcsDate(dtStartRaw);
    const end = dtEndRaw
      ? parseIcsDate(dtEndRaw)
      : (() => {
        const d = new Date(start);
        d.setDate(d.getDate() + 1);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;
      })();

    // 핵심: 원본 LO는 저장하지 않음
    if (kind === "LO") continue;

    events.push({
      id: uidRaw ?? crypto.randomUUID(),
      owner,
      title,
      start,
      end,
      kind,
    });
  }

  const result: EventItem[] = [...events];

  const flights = events
    .filter((e) => e.kind === "FLIGHT")
    .sort((a, b) => a.start.localeCompare(b.start));

  for (let i = 0; i < flights.length - 1; i++) {
    const cur = flights[i];
    const next = flights[i + 1];

    const curRoute = routeFromTitle(cur.title);
    const nextRoute = routeFromTitle(next.title);
    if (!curRoute || !nextRoute) continue;

    // 도착 공항과 다음 출발 공항이 같아야 layover 후보
    if (curRoute.to !== nextRoute.from) continue;

    // 집 공항은 layover로 만들지 않음
    if (curRoute.to === "ICN" || curRoute.to === "GMP") continue;

    const gapMs = new Date(next.start).getTime() - new Date(cur.end).getTime();
    const gapHours = gapMs / 3600000;

    // 퀵턴 제거
    if (gapHours < 6) continue;

    // 중간에 다른 이벤트가 있으면 layover 아님
    const hasMiddleEvent = events.some((e) => {
      if (e.id === cur.id || e.id === next.id) return false;
      const t = new Date(e.start).getTime();
      return t > new Date(cur.end).getTime() && t < new Date(next.start).getTime();
    });
    if (hasMiddleEvent) continue;

    result.push({
      id: `LO-${cur.id}`,
      owner,
      title: `LO ${curRoute.to}`,
      start: cur.end,
      end: next.start,
      kind: "LO",
    });
  }

  return result;
}