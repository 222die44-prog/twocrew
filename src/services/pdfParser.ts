// src/services/pdfParser.ts
import type { EventItem } from "./schedule";

import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

type Role = "HAN" | "KYU";

type ParsedResult = {
  year: number;
  month: number;
  events: EventItem[];
};

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

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function normalizeText(s: string) {
  return s.replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseYearMonth(text: string) {
  const mA = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b\s*(20\d{2})/i);
  if (mA) return { year: Number(mA[2]), month: MONTH_MAP[mA[1].toLowerCase()] };

  const m1 = text.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월/i);
  if (m1) return { year: Number(m1[1]), month: Number(m1[2]) };

  const m2 = text.match(/(20\d{2})\s*[.\-/]\s*(\d{1,2})\b/);
  if (m2) return { year: Number(m2[1]), month: Number(m2[2]) };

  return null;
}

function kstISO(year: number, month: number, day: number, hh: number, mm: number) {
  const utc = Date.UTC(year, month - 1, day, hh - 9, mm, 0, 0);
  return new Date(utc).toISOString();
}

function allDayRangeISO(year: number, month: number, day: number) {
  const start = kstISO(year, month, day, 0, 0);
  const end = new Date(new Date(start).getTime() + 86400000).toISOString();
  return { start, end };
}

function uniqId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function parseDayToken(tok: string) {
  const n = Number(tok);
  return n >= 1 && n <= 31 ? n : null;
}

function isAirport(tok: string) {
  return /^[A-Z]{3}$/.test(tok.toUpperCase());
}
function isFlightNo(tok: string) {
  return /\b[A-Z]{1,3}\d{2,4}\b/.test(tok.toUpperCase());
}
function parseHHMM(tok: string) {
  const m = tok.match(/^(\d{1,2}):(\d{2})$/);
  return m ? { hh: Number(m[1]), mm: Number(m[2]) } : null;
}

function inferKind(tok: string): Kind | null {
  const t = tok.toUpperCase();
  if (t === "DO") return "DO";
  if (t === "RDO") return "RDO";
  if (t === "ALM") return "ALM";
  if (t === "ALV") return "ALV";
  if (t === "RESERVE") return "RESERVE";
  if (t === "HM_STBY") return "HM_STBY";
  if (t === "AP_STBY") return "AP_STBY";
  if (t === "JCRM") return "JCRM";
  if (t === "RCRM") return "RCRM";
  if (t === "EMER") return "EMER";
  if (t === "LO") return "LO";
  return null;
}

function makeAllDay(owner: Role, year: number, month: number, day: number, kind: Kind, title: string): EventItem {
  const { start, end } = allDayRangeISO(year, month, day);
  return {
    id: uniqId(`duty-${owner}`),
    owner,
    start,
    end,
    title,
    ...({ kind, allDay: true } as any),
  } as any;
}

function makeTimed(
  owner: Role,
  year: number,
  month: number,
  day: number,
  kind: Kind,
  title: string,
  startT: { hh: number; mm: number },
  endT: { hh: number; mm: number }
): EventItem {
  const start = kstISO(year, month, day, startT.hh, startT.mm);

  // 종료가 시작보다 빠르면(자정 넘어감) 다음날로 처리
  let endDay = day;
  if (endT.hh * 60 + endT.mm <= startT.hh * 60 + startT.mm) endDay++;

  const end = kstISO(year, month, endDay, endT.hh, endT.mm);

  return {
    id: uniqId(`duty-${owner}`),
    owner,
    start,
    end,
    title,
    ...({ kind, allDay: false } as any),
  } as any;
}

function makeFlight(
  owner: Role,
  year: number,
  month: number,
  day: number,
  flightNo: string,
  depAirport: string,
  depTime: { hh: number; mm: number },
  arrAirport: string,
  arrTime: { hh: number; mm: number }
): EventItem {
  const start = kstISO(year, month, day, depTime.hh, depTime.mm);
  let arrDay = day;
  if (arrTime.hh * 60 + arrTime.mm < depTime.hh * 60 + depTime.mm) arrDay++;
  const end = kstISO(year, month, arrDay, arrTime.hh, arrTime.mm);

  return {
    id: uniqId(`flt-${owner}`),
    owner,
    start,
    end,
    title: `${flightNo} ${depAirport}-${arrAirport}`,
    ...({ kind: "FLIGHT", allDay: false } as any),
  } as any;
}

export async function parseRosterPdfToEvents(pdfArrayBuffer: ArrayBuffer, owner: Role): Promise<ParsedResult> {
  const loadingTask = (pdfjsLib as any).getDocument({ data: pdfArrayBuffer });
  const pdf = await loadingTask.promise;

  let whole = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = (content.items || []).map((it: any) => String(it.str ?? ""));
    whole += strings.join(" ") + "\n";
  }

  const text = normalizeText(whole);
  const ym = parseYearMonth(text);

  if (!ym) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, events: [] };
  }

  const { year, month } = ym;
  const tokens = text.split(/\s+/).filter(Boolean);

  let currentDay: number | null = null;
  const out: EventItem[] = [];

  const seen = new Set<string>();
  function pushOnce(e: EventItem) {
    const sig = `${e.owner}|${(e as any).kind}|${e.title}|${e.start}|${e.end}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push(e);
  }

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    // ✅ 숫자만 나와도 날짜 갱신 (표형 PDF 대응)
    const dayNum = parseDayToken(tok);
    if (dayNum) {
      const next = (tokens[i + 1] ?? "").toUpperCase();
      if (inferKind(next) || isFlightNo(next)) {
        currentDay = dayNum;
        continue;
      }
    }

    if (!currentDay) continue;

    const kind = inferKind(tok);
    if (kind) {
      // ✅ NEW: JCRM/RCRM/EMER 시간만 있는 케이스 처리 (공항코드 없어도 잡기)
if (kind === "JCRM" || kind === "RCRM" || kind === "EMER") {
  const times: { hh: number; mm: number }[] = [];

  // kind 토큰 다음 12개 토큰 내에서 HH:MM 2개 찾기
  for (let j = i + 1; j <= i + 12 && j < tokens.length; j++) {
    const tm = parseHHMM(tokens[j] ?? "");
    if (tm) times.push(tm);
    if (times.length >= 2) break;
  }

  if (times.length >= 2) {
    pushOnce(makeTimed(owner, year, month, currentDay, kind, kind, times[0], times[1]));
  } else {
    // 시간도 못 찾으면 all-day라도 만들기
    pushOnce(makeAllDay(owner, year, month, currentDay, kind, kind));
  }

  continue;
}
      if (kind === "LO") {
        // 🔥 LO는 무조건 하루짜리
        pushOnce(makeAllDay(owner, year, month, currentDay, "LO", "LO"));
      } else {
        pushOnce(makeAllDay(owner, year, month, currentDay, kind, kind));
      }
      continue;
    }

    // Flight
    const fno = tok.toUpperCase();
    if (isFlightNo(fno)) {
      const depA = tokens[i + 1]?.toUpperCase();
      const depT = parseHHMM(tokens[i + 2] ?? "");
      if (!depA || !depT || !isAirport(depA)) continue;

      let arrA: string | null = null;
      let arrT: { hh: number; mm: number } | null = null;

      for (let j = i + 3; j <= i + 8 && j < tokens.length; j++) {
        const cand = tokens[j]?.toUpperCase();
        if (isAirport(cand)) {
          const tm = parseHHMM(tokens[j + 1] ?? "");
          if (tm) {
            arrA = cand;
            arrT = tm;
            break;
          }
        }
      }

      if (arrA && arrT) {
        pushOnce(makeFlight(owner, year, month, currentDay, fno, depA, depT, arrA, arrT));
      }
    }
  }

  return { year, month, events: out };
}