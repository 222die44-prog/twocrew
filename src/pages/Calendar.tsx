// src/pages/Calendar.tsx
import { useMemo, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getRole, loadEvents, saveEvents } from "../services/schedule";
import type { EventItem } from "../services/schedule";
import { exportICS } from "../utils/ics";
import { parseIcsToEvents } from "../utils/icsImport";

type Role = "HAN" | "KYU";

/* =========================================================
   KST helpers
========================================================= */

function asDate(x: unknown): Date {
  return x instanceof Date ? x : new Date(String(x));
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function monthLabel(d: Date) {
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISO(s: string) {
  return new Date(s);
}

function startOfDay(d: any) {
  const dd = d instanceof Date ? d : new Date(d);
  if (isNaN(dd.getTime())) return new Date();
  return new Date(dd.getFullYear(), dd.getMonth(), dd.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: any) {
  const dd = asDate(d);
  return new Date(dd.getFullYear(), dd.getMonth(), dd.getDate(), 23, 59, 59, 999);
}

function minutesBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

function fmtHMFromISO(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function fmtHMFromDateKST(d: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function blockTimeLabel(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function dutyTimeLabel(events: EventItem[], day: Date) {
  const flights = events
    .filter((e) => getKind(e) === "FLIGHT" && eventCoversDay(e, day))
    .sort((a, b) => a.start.localeCompare(b.start));

  if (flights.length === 0) return null;

  const first = new Date(flights[0].start);
  const last = new Date(flights[flights.length - 1].end);

  const mins = Math.max(0, Math.round((last.getTime() - first.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;

  return `${h}:${String(m).padStart(2, "0")}`;
}

function showUpTimeLabel(events: EventItem[], day: Date) {
  const flights = events
    .filter((e) => getKind(e) === "FLIGHT" && eventCoversDay(e, day))
    .sort((a, b) => a.start.localeCompare(b.start));

  if (flights.length === 0) return null;

  const first = new Date(flights[0].start);
  const showUp = new Date(first.getTime() - 150 * 60000); // ETD - 2시간 30분

  return fmtHMFromDateKST(showUp);
}

const airportCountry: Record<string, string> = {
  ICN: "KR",
  GMP: "KR",
  PUS: "KR",
  CJU: "KR",
  TAE: "KR",
  KWJ: "KR",
  USN: "KR",
  RSU: "KR",
  KPO: "KR",
  CJJ: "KR",
  MWX: "KR",
  YNY: "KR",

  NRT: "JP",
  HND: "JP",
  KIX: "JP",
  NGO: "JP",
  FUK: "JP",
  OKA: "JP",
  CTS: "JP",
  SDJ: "JP",
  KOJ: "JP",
  KMJ: "JP",
  OIT: "JP",
  KMI: "JP",
  HIJ: "JP",
  NGS: "JP",

  PVG: "CN",
  PEK: "CN",
  PKX: "CN",
  CAN: "CN",
  SZX: "CN",
  XIY: "CN",
  TAO: "CN",
  YNT: "CN",
  DLC: "CN",
  SHE: "CN",
  HGH: "CN",
  NKG: "CN",
  WUH: "CN",
  CGO: "CN",
  CSX: "CN",
  KMG: "CN",
  CTU: "CN",
  URC: "CN",
  XMN: "CN",
  FOC: "CN",
  TNA: "CN",
  TSN: "CN",
  YNZ: "CN",
  DYG: "CN",
  YNJ: "CN",

  TPE: "TW",
  KHH: "TW",

  HKG: "HK",
  MFM: "MO",

  HAN: "VN",
  SGN: "VN",
  DAD: "VN",
  CXR: "VN",
  PQC: "VN",
  HUI: "VN",
  VDO: "VN",

  BKK: "TH",
  DMK: "TH",
  CNX: "TH",
  HKT: "TH",
  KBV: "TH",
  USM: "TH",

  MNL: "PH",
  CEB: "PH",
  CRK: "PH",
  KLO: "PH",

  SIN: "SG",

  KUL: "MY",
  PEN: "MY",
  BKI: "MY",
  KCH: "MY",
  LGK: "MY",

  CGK: "ID",
  DPS: "ID",
  SUB: "ID",

  PNH: "KH",
  REP: "KH",

  VTE: "LA",
  LPQ: "LA",

  RGN: "MM",
  MDL: "MM",

  DEL: "IN",
  BOM: "IN",
  BLR: "IN",
  MAA: "IN",

  KTM: "NP",
  DAC: "BD",
  CMB: "LK",
  MLE: "MV",

  UBN: "MN",

  TSE: "KZ",
  ALA: "KZ",
  TAS: "UZ",

  DXB: "AE",
  AUH: "AE",
  DOH: "QA",
  RUH: "SA",
  JED: "SA",
  DMM: "SA",
  KWI: "KW",
  BAH: "BH",
  MCT: "OM",
  AMM: "JO",
  TLV: "IL",
  IST: "TR",

  GUM: "GU",
  SPN: "MP",
  PPT: "PF",

  SYD: "AU",
  BNE: "AU",
  MEL: "AU",
  PER: "AU",
  ADL: "AU",
  CNS: "AU",

  AKL: "NZ",
  CHC: "NZ",

  HNL: "US",
  OGG: "US",
  KOA: "US",
  LIH: "US",

  LAX: "US",
  SFO: "US",
  SEA: "US",
  LAS: "US",
  ORD: "US",
  JFK: "US",
  IAD: "US",
  ATL: "US",
  DFW: "US",
  BOS: "US",
  ANC: "US",
  DTW: "US",
  MSP: "US",

  YYZ: "CA",
  YVR: "CA",
  YUL: "CA",

  MEX: "MX",

  GRU: "BR",

  LHR: "GB",
  LGW: "GB",

  CDG: "FR",
  NCE: "FR",

  FRA: "DE",
  MUC: "DE",

  FCO: "IT",
  MXP: "IT",

  MAD: "ES",
  BCN: "ES",

  AMS: "NL",
  BRU: "BE",
  ZRH: "CH",
  VIE: "AT",
  CPH: "DK",
  ARN: "SE",
  OSL: "NO",
  HEL: "FI",
  PRG: "CZ",
  WAW: "PL",
  BUD: "HU",
  ATH: "GR",
  LIS: "PT",
  DUB: "IE",
  GVA: "CH",

  SVO: "RU",
  LED: "RU",
};

function flagUrlByAirport(airport?: string) {
  if (!airport) return "";
  const cc = airportCountry[airport]?.toLowerCase();
  if (!cc) return "";
  return `https://flagcdn.com/w20/${cc}.png`;
}

function countryFlag(code?: string) {
  if (!code) return "";
  const cc = airportCountry[code];
  if (!cc) return "";
  return cc
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function loAirport(label: string) {
  const m = label.match(/\((.*?)\)/);
  return m ? m[1] : "";
}



/* =========================================================
   Kind / title helpers
========================================================= */

type Kind =
  | "FLIGHT"
  | "LO"
  | "DO"
  | "ATDO"
  | "ADO"
  | "YVC"
  | "RESERVE"
  | "BLANK"
  | "RDO"
  | "ALM"
  | "ALV"
  | "HM_STBY"
  | "AP_STBY"
  | "RCRM"
  | "JCRM"
  | "EMER"
  | "OTHER";

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function getKind(e: EventItem): Kind {
  const rawK = ((e as any).kind as string | undefined)?.toUpperCase().trim();
  const t = normalizeSpaces(String(e.title ?? "")).toUpperCase();

  // 1) 저장된 kind를 최우선 신뢰
  if (rawK) {
    if (rawK === "FLIGHT") return "FLIGHT";
    if (rawK === "LO") return "LO";
    if (rawK === "DO") return "DO";
    if (rawK === "ATDO") return "ATDO";
    if (rawK === "ADO") return "ADO";
    if (rawK === "YVC") return "YVC";
    if (rawK === "RESERVE") return "RESERVE";
    if (rawK === "BLANK") return "BLANK";
    if (rawK === "RDO") return "RDO";
    if (rawK === "ALM") return "ALM";
    if (rawK === "ALV") return "ALV";
    if (rawK === "RCRM") return "RCRM";
    if (rawK === "JCRM") return "JCRM";
    if (rawK === "EMER") return "EMER";

    // 혹시 과거 데이터가 HM_STBY / AP_STBY로 저장돼 있어도 RESERVE로 흡수
    if (rawK === "HM_STBY" || /^HM[ _-]?STBY\d*\b/.test(rawK) || /^HM[ _-]?SBY\d*\b/.test(rawK)) {
      return "HM_STBY";
    }
    if (rawK === "AP_STBY" || /^AP[ _-]?STBY\d*\b/.test(rawK) || /^AP[ _-]?SBY\d*\b/.test(rawK)) {
      return "AP_STBY";
    }
  }

  // 2) fallback: title 기준 판정
  if (t === "LO" || t.startsWith("LO ")) return "LO";
  if (t === "DO" || t.startsWith("DO ")) return "DO";
  if (t === "ATDO" || t.startsWith("ATDO ")) return "ATDO";
  if (t === "ADO" || t.startsWith("ADO")) return "ADO";
  if (t === "YVC" || t.startsWith("YVC")) return "YVC";
  if (t === "RESERVE" || t.startsWith("RESERVE ")) return "RESERVE";
  if (t === "BLANK" || t.startsWith("BLANK ")) return "BLANK";
  if (t === "RDO" || t.startsWith("RDO ")) return "RDO";
  if (t === "ALM" || t.startsWith("ALM ")) return "ALM";
  if (t === "ALV" || t.startsWith("ALV ")) return "ALV";
  if (/^HM[ _-]?STBY\d*\b/.test(t)) return "HM_STBY";
  if (/^AP[ _-]?STBY\d*\b/.test(t)) return "AP_STBY";
  if (/^HM[ _-]?SBY\d*\b/.test(t)) return "HM_STBY";
  if (/^AP[ _-]?SBY\d*\b/.test(t)) return "AP_STBY";
  if (/^HM\b.*\b(STBY|SBY)\d*\b/.test(t)) return "HM_STBY";
  if (/^AP\b.*\b(STBY|SBY)\d*\b/.test(t)) return "AP_STBY";

  if (t.startsWith("RCRM")) return "RCRM";
  if (t.startsWith("JCRM")) return "JCRM";
  if (t.startsWith("EMER")) return "EMER";

  // flight 판정은 마지막
  if (/\b[A-Z]{1,3}\d{2,4}\b/.test(t) && /\b[A-Z]{3}-[A-Z]{3}\b/.test(t)) {
    return "FLIGHT";
  }

  return "OTHER";
}

function getDisplayTitle(e: EventItem) {
  const kind = getKind(e);
  switch (kind) {
    case "ALM":
    case "ALV":
    case "RDO":
    case "DO":
      return "DO";
    case "ATDO":
      return "ATDO";
    case "ADO":
      return "ADO";
    case "YVC":
      return "YVC";
    case "RESERVE":
      return "RESERVE";
    case "BLANK":
      return "BLANK";
    case "HM_STBY":
      return "🏠 HM STBY";
    case "AP_STBY":
      return "✈️ AP STBY";
    case "LO":
      return normalizeSpaces(e.title);
    default:
      return e.title;
  }
}

function isAllDayEvent(e: EventItem) {
  const kind = getKind(e);
  return (
    (e as any).allDay === true ||
    kind === "DO" ||
    kind === "ATDO" ||
    kind === "ADO" ||
    kind === "YVC" ||
    kind === "ALM" ||
    kind === "ALV" ||
    kind === "RDO" ||
    kind === "RESERVE" ||
    kind === "BLANK" ||
    kind === "LO" ||
    kind === "HM_STBY" ||
    kind === "AP_STBY"
  );
}

function isDutyLike(e: EventItem) {
  return getKind(e) === "FLIGHT";
}

/* =========================================================
   Flight helpers
========================================================= */

function parseFlightChip(title: string): { flightNo?: string; route?: string } {
  const t = normalizeSpaces(title).toUpperCase();

  // flight number: KE833 / OZ123 / etc
  const mNo = t.match(/\b[A-Z]{1,3}\d{2,4}\b/);
  const flightNo = mNo?.[0];

  // 1) 먼저 진짜 노선 형태(ICN-PUS 같은 하이픈 구간)를 우선 찾기
  const routeMatches = Array.from(t.matchAll(/\b([A-Z]{3}-[A-Z]{3})\b/g)).map((m) => m[1]);
  if (routeMatches.length > 0) {
    return {
      flightNo,
      route: routeMatches[routeMatches.length - 1], // 마지막 실제 route 사용
    };
  }

  // 2) fallback: 공항코드만 있을 때는 TVL 같은 운영코드는 제외
  const airports = Array.from(t.matchAll(/\b[A-Z]{3}\b/g))
    .map((m) => m[0])
    .filter((code) => !["TVL", "DH", "OAL"].includes(code));

  if (airports.length >= 2) {
    return {
      flightNo,
      route: `${airports[0]}-${airports[1]}`,
    };
  }

  if (airports.length === 1) {
    return {
      flightNo,
      route: airports[0],
    };
  }

  return { flightNo };
}

function flightDestAirportFromTitle(title: string): string | null {
  const { route } = parseFlightChip(title);
  if (!route) return null;
  const parts = route.split("-");
  if (parts.length >= 2) return parts[1] || null;
  return parts[0] || null;
}

function flightBarLabelForDay(owner: Role, ownerEvents: EventItem[], day: Date) {
  const dayEvents = ownerEvents.filter((e) => eventCoversDay(e, day));

  const lo = dayEvents.find((e) => getKind(e) === "LO");
  if (lo) {
    const airport = extractAirportFromLoTitle(lo.title);
    if (airport) return `🛫 →${airport}`;
  }

  const flights = dayEvents
    .filter((e) => getKind(e) === "FLIGHT")
    .sort((a, b) => a.start.localeCompare(b.start));

  if (flights.length === 0) return "✈";

  // 당일 여러 편이면 집공항 제외한 마지막 해외공항
  if (flights.length >= 2) {
    const airports: string[] = [];

    for (const f of flights) {
      const m = f.title.match(/\b([A-Z]{3})-([A-Z]{3})\b/);
      if (m) {
        airports.push(m[1]);
        airports.push(m[2]);
      }
    }

    const nonHome = airports.filter((a) => a !== "ICN" && a !== "GMP");
    if (nonHome.length > 0) {
      return `🛫 →${nonHome[nonHome.length - 1]}`;
    }
  }

  // 단일편이면 마지막 도착지
  const lastFlight = flights[flights.length - 1];
  const dest = flightDestAirportFromTitleSafe(lastFlight.title);

  return dest ? `🛫 →${dest}` : "✈";
}

/* =========================================================
   Interval / overlap helpers
========================================================= */

function clampIntervalToDay(e: EventItem, day: Date): [Date, Date] | null {
  const s = parseISO(e.start);
  const en = parseISO(e.end);
  const dayS = startOfDay(day);
  const dayE = endOfDay(day);
  const cs = s < dayS ? dayS : s;
  const ce = en > dayE ? dayE : en;
  return cs < ce ? [cs, ce] : null;
}

function mergeIntervals(intervals: [Date, Date][]) {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0].getTime() - b[0].getTime());
  const out: [Date, Date][] = [];
  let cur = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const nxt = sorted[i];
    if (nxt[0].getTime() <= cur[1].getTime()) {
      cur = [cur[0], new Date(Math.max(cur[1].getTime(), nxt[1].getTime()))];
    } else {
      out.push(cur);
      cur = nxt;
    }
  }

  out.push(cur);
  return out;
}

function intersectIntervals(a: [Date, Date], b: [Date, Date]): [Date, Date] | null {
  const s = new Date(Math.max(a[0].getTime(), b[0].getTime()));
  const e = new Date(Math.min(a[1].getTime(), b[1].getTime()));
  return s < e ? [s, e] : null;
}

function totalMinutes(intervals: [Date, Date][]) {
  return intervals.reduce((sum, [s, e]) => sum + minutesBetween(s, e), 0);
}

function eventCoversDay(e: EventItem, day: Date) {
  const s = parseISO(e.start);
  const en = parseISO(e.end);
  const dayS = startOfDay(day);
  const dayE = endOfDay(day);
  return s <= dayE && en > dayS;
}

function overlapMinutesForDay(hanEvents: EventItem[], kyuEvents: EventItem[], day: Date) {
  const hanDuty = hanEvents.filter(isDutyLike);
  const kyuDuty = kyuEvents.filter(isDutyLike);

  const hanInts = mergeIntervals(
    hanDuty.map((e) => clampIntervalToDay(e, day)).filter(Boolean) as [Date, Date][]
  );
  const kyuInts = mergeIntervals(
    kyuDuty.map((e) => clampIntervalToDay(e, day)).filter(Boolean) as [Date, Date][]
  );

  const overlaps: [Date, Date][] = [];
  for (const h of hanInts) {
    for (const k of kyuInts) {
      const inter = intersectIntervals(h, k);
      if (inter) overlaps.push(inter);
    }
  }

  return { minutes: totalMinutes(mergeIntervals(overlaps)) };
}

function overlapForDay(hanEvents: EventItem[], kyuEvents: EventItem[], day: Date) {
  const hanDuty = hanEvents.filter(isDutyLike);
  const kyuDuty = kyuEvents.filter(isDutyLike);

  const hanInts = mergeIntervals(
    hanDuty.map((e) => clampIntervalToDay(e, day)).filter(Boolean) as [Date, Date][]
  );
  const kyuInts = mergeIntervals(
    kyuDuty.map((e) => clampIntervalToDay(e, day)).filter(Boolean) as [Date, Date][]
  );

  const overlaps: [Date, Date][] = [];
  for (const h of hanInts) {
    for (const k of kyuInts) {
      const inter = intersectIntervals(h, k);
      if (inter) overlaps.push(inter);
    }
  }

  const merged = mergeIntervals(overlaps);
  return { intervals: merged, minutes: totalMinutes(merged) };
}

function hoursLabel(totalMinutes: number, days: number) {
  const avg = totalMinutes / Math.max(1, days);
  return `${(avg / 60).toFixed(1)}h/day`;
}

/* =========================================================
   Month helpers
========================================================= */

function weekIndexOf(day: Date, month: Date) {
  const first = startOfMonth(month);
  const offset = first.getDay();
  const cellIndex = offset + (day.getDate() - 1);
  return Math.floor(cellIndex / 7);
}

function dayOfWeekIndex(day: Date) {
  return day.getDay();
}

function splitRunIntoWeekBars(runStart: Date, runEnd: Date, visibleDays: Date[]) {
  const out: { week: number; left: number; width: number; startIdx: number; endIdx: number }[] = [];
  const oneDay = 24 * 60 * 60 * 1000;

  const visibleMap = new Map<string, number>();
  visibleDays.forEach((d, i) => {
    visibleMap.set(ymd(d), i);
  });

  let cur = startOfDay(asDate(runStart));
  const end = startOfDay(asDate(runEnd));

  let segStartIndex: number | null = null;
  let prevIndex: number | null = null;

  function pushSegment(startIndex: number, endIndex: number) {
    const week = Math.floor(startIndex / 7);
    const startIdx = startIndex % 7;
    const endIdx = endIndex % 7;
    const left = (startIdx / 7) * 100;
    const right = ((endIdx + 1) / 7) * 100;

    out.push({
      week,
      left,
      width: Math.max(2, right - left),
      startIdx,
      endIdx,
    });
  }

  while (cur.getTime() <= end.getTime()) {
    const idx = visibleMap.get(ymd(cur));

    if (idx !== undefined) {
      if (segStartIndex === null) {
        segStartIndex = idx;
        prevIndex = idx;
      } else {
        const prevWeek = Math.floor(prevIndex! / 7);
        const curWeek = Math.floor(idx / 7);

        const isContinuous = idx === prevIndex! + 1;
        const crossedWeek = curWeek !== prevWeek;

        // 연속이 아니거나, 주가 바뀌면 여기서 segment 종료
        if (!isContinuous || crossedWeek) {
          pushSegment(segStartIndex, prevIndex!);
          segStartIndex = idx;
        }

        prevIndex = idx;
      }
    }

    cur = new Date(cur.getTime() + oneDay);
  }

  if (segStartIndex !== null && prevIndex !== null) {
    pushSegment(segStartIndex, prevIndex);
  }

  return out;
}

function listForDay(list: EventItem[], day: Date) {
  return list
    .filter((e) => eventCoversDay(e, day))
    .sort((a, b) => {
      const aa = isAllDayEvent(a) ? 0 : 1;
      const bb = isAllDayEvent(b) ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return a.start.localeCompare(b.start);
    });
}

function getStatusEventForDay(list: EventItem[]) {
  return list.find((e) => {
    const kind = getKind(e);
    return kind !== "FLIGHT" && kind !== "OTHER";
  });
}

/* =========================================================
   All-day bars
========================================================= */

type DayTag =
  | "FLIGHT"
  | "LO"
  | "RESERVE"
  | "BLANK"
  | "RDO"
  | "DO"
  | "ATDO"
  | "ADO"
  | "YVC"
  | "HM_STBY"
  | "AP_STBY"
  | "JCRM"
  | "RCRM"
  | "EMER"
  | "OTHER"
  | "NONE";

const DAYTAG_PRIORITY: DayTag[] = [
  "RCRM",
  "JCRM",
  "EMER",
  "LO",
  "FLIGHT",
  "HM_STBY",
  "AP_STBY",
  "RESERVE",
  "BLANK",
  "RDO",
  "ATDO",
  "ADO",
  "DO",
  "YVC",
  "OTHER",
  "NONE",
];

function toDayTagFromKind(kind: Kind): DayTag {
  if (kind === "FLIGHT") return "FLIGHT";
  if (kind === "LO") return "LO";
  if (kind === "HM_STBY") return "RESERVE";
  if (kind === "AP_STBY") return "RESERVE";
  if (kind === "RESERVE") return "RESERVE";
  if (kind === "BLANK") return "BLANK";
  if (kind === "RCRM") return "RCRM";
  if (kind === "JCRM") return "JCRM";
  if (kind === "EMER") return "EMER";
  if (kind === "RDO") return "DO";
  if (kind === "ALM") return "DO";
  if (kind === "ALV") return "DO";
  if (kind === "DO") return "DO";
  if (kind === "ATDO") return "DO";
  if (kind === "ADO") return "DO";
  if (kind === "YVC") return "DO";
  if (kind === "OTHER") return "OTHER";
  return "NONE";
}

function dayTagFor(ownerEvents: EventItem[], day: Date): DayTag {
  const tags = ownerEvents
    .filter((e) => eventCoversDay(e, day))
    .map((e) => toDayTagFromKind(getKind(e)));

  if (tags.length === 0) return "NONE";

  for (const t of DAYTAG_PRIORITY) {
    if (tags.includes(t)) return t;
  }

  return "NONE";
}

function dayStatusFor(ownerEvents: EventItem[], day: Date, owner: Role): { tag: DayTag; label: string } {
  const dayEvents = ownerEvents.filter((e) => eventCoversDay(e, day));

  if (dayEvents.length === 0) {
    if (owner === "KYU") {
      return { tag: "BLANK", label: "BLANK" };
    }
    return { tag: "NONE", label: "" };
  }

  const hasLo = dayEvents.some((e) => getKind(e) === "LO");
  if (hasLo) {
    return {
      tag: "LO",
      label: explicitLoLabelForDay(ownerEvents, day) ?? loLabelForRun(ownerEvents, day, day),
    };
  }

  const flights = dayEvents
    .filter((e) => getKind(e) === "FLIGHT")
    .sort((a, b) => a.start.localeCompare(b.start));

  if (flights.length > 0) {
    return {
      tag: "FLIGHT",
      label: flightBarLabelForDay(owner, ownerEvents, day),
    };
  }

  const hasJcrm = dayEvents.some((e) => getKind(e) === "JCRM");
  if (hasJcrm) return { tag: "JCRM", label: "TRAINING" };

  const hasRcrm = dayEvents.some((e) => getKind(e) === "RCRM");
  if (hasRcrm) return { tag: "RCRM", label: "TRAINING" };

  const hasEmer = dayEvents.some((e) => getKind(e) === "EMER");
  if (hasEmer) return { tag: "EMER", label: "TRAINING" };

  const kinds = dayEvents.map((e) => getKind(e));

  if (kinds.includes("HM_STBY")) {
    return { tag: "HM_STBY", label: "HM STBY" };
  }

  if (kinds.includes("AP_STBY")) {
    return { tag: "AP_STBY", label: "AP STBY" };
  }

  // RESERVE가 있으면 무조건 RESERVE
  if (kinds.includes("RESERVE")) {
    return { tag: "RESERVE", label: "RESERVE" };
  }

  // 규영이는 BLANK도 status bar에서 RESERVE처럼 표시
  if (owner === "KYU" && kinds.includes("BLANK")) {
    return { tag: "BLANK", label: "BLANK" };
  }

  if (
    kinds.includes("DO") ||
    kinds.includes("ALM") ||
    kinds.includes("ALV") ||
    kinds.includes("RDO") ||
    kinds.includes("ATDO") ||
    kinds.includes("ADO") ||
    kinds.includes("YVC")
  ) {
    return { tag: "DO", label: "DO" };
  }

  if (kinds.includes("BLANK")) {
    return { tag: "BLANK", label: "BLANK" };
  }

  return { tag: "NONE", label: "" };
}

function buildRunsByDayKey(days: Date[], keyOf: (d: Date) => { tag: DayTag; label: string }) {
  const runs: { tag: DayTag; label: string; start: Date; end: Date; dayCount: number }[] = [];
  const oneDay = 24 * 60 * 60 * 1000;

  let curTag: DayTag = "NONE";
  let curLabel = "";
  let curStart: Date | null = null;
  let curEnd: Date | null = null;
  let count = 0;

  for (const d of days) {
    const k = keyOf(d);

    if (k.tag === "NONE") {
      if (curStart) {
        runs.push({ tag: curTag, label: curLabel, start: curStart, end: curEnd!, dayCount: count });
      }
      curTag = "NONE";
      curLabel = "";
      curStart = null;
      curEnd = null;
      count = 0;
      continue;
    }

    if (!curStart) {
      curTag = k.tag;
      curLabel = k.label;
      curStart = d;
      curEnd = d;
      count = 1;
      continue;
    }

    const isConsecutive = startOfDay(d).getTime() - startOfDay(curEnd!).getTime() === oneDay;

    const canMerge =
      isConsecutive &&
      k.tag === curTag &&
      (
        k.tag === "DO" ||
        k.tag === "RESERVE" ||
        k.tag === "BLANK" ||
        k.tag === "ATDO" ||
        k.tag === "YVC" ||
        k.tag === "ADO" ||
        (k.tag === "LO" && k.label === curLabel) ||
        (k.tag === "FLIGHT" && k.label === curLabel)
      );

    if (canMerge) {
      curEnd = d;
      count += 1;
    } else {
      runs.push({ tag: curTag, label: curLabel, start: curStart, end: curEnd!, dayCount: count });
      curTag = k.tag;
      curLabel = k.label;
      curStart = d;
      curEnd = d;
      count = 1;
    }
  }

  if (curStart) {
    runs.push({ tag: curTag, label: curLabel, start: curStart, end: curEnd!, dayCount: count });
  }

  return runs;
}

type BarSeg = {
  id: string;
  week: number;
  startIdx: number;
  endIdx: number;
  left: number;
  width: number;
  label: string;
  owner: Role;
  tag: DayTag;
};

type PlacedBar = BarSeg & { lane: number };

const HOME_AIRPORTS = new Set(["ICN", "GMP"]);

function extractAirportFromLoTitle(title: string): string | null {
  const t = normalizeSpaces(title).toUpperCase();

  const routeMatch = t.match(/\b([A-Z]{3})-([A-Z]{3})\b/);
  if (routeMatch) {
    const from = routeMatch[1];
    const to = routeMatch[2];

    if (from === to) return from;
    if (!HOME_AIRPORTS.has(to)) return to;
    if (!HOME_AIRPORTS.has(from)) return from;
  }

  const codes = Array.from(t.matchAll(/\b[A-Z]{3}\b/g))
    .map((m) => m[0])
    .filter((code) => !["LO", "TVL", "DH", "OAL"].includes(code));

  const nonHome = codes.find((code) => !HOME_AIRPORTS.has(code));
  return nonHome ?? codes[0] ?? null;
}

function explicitLoLabelForDay(events: EventItem[], day: Date): string | null {
  const lo = events.find((e) => getKind(e) === "LO" && eventCoversDay(e, day));
  if (!lo) return null;

  const raw = normalizeSpaces(lo.title).toUpperCase();
  if (raw === "LO") return null;

  const airport = extractAirportFromLoTitle(lo.title);
  return airport ? `LO (${airport})` : null;
}

function getRouteAirports(title: string) {
  const parsed = parseFlightChip(title);
  if (!parsed.route) return { from: null as string | null, to: null as string | null };

  const parts = parsed.route.split("-");
  return {
    from: parts[0] || null,
    to: parts[1] || null,
  };
}

function flightOriginAirportFromTitle(title: string): string | null {
  const { route } = parseFlightChip(title);
  if (!route) return null;
  const parts = route.split("-");
  return parts[0] || null;
}

function flightDestAirportFromTitleSafe(title: string): string | null {
  const { route } = parseFlightChip(title);
  if (!route) return null;
  const parts = route.split("-");
  return parts.length >= 2 ? parts[1] || null : parts[0] || null;
}

function loLabelForRun(events: EventItem[], start: Date, end: Date) {
  const explicit = explicitLoLabelForDay(events, start);
  if (explicit) return explicit;

  const score = new Map<string, number>();

  let cur = new Date(startOfDay(start));
  const endDay = startOfDay(end);

  while (cur.getTime() <= endDay.getTime()) {
    const dayFlights = events
      .filter((e) => getKind(e) === "FLIGHT" && eventCoversDay(e, cur))
      .sort((a, b) => a.start.localeCompare(b.start));

    if (dayFlights.length > 0) {
      const firstOrigin = flightOriginAirportFromTitle(dayFlights[0].title);
      const lastDest = flightDestAirportFromTitleSafe(dayFlights[dayFlights.length - 1].title);

      if (
        firstOrigin &&
        lastDest &&
        firstOrigin === lastDest &&
        !HOME_AIRPORTS.has(firstOrigin)
      ) {
        score.set(firstOrigin, (score.get(firstOrigin) || 0) + 5);
      }

      if (firstOrigin && !HOME_AIRPORTS.has(firstOrigin)) {
        score.set(firstOrigin, (score.get(firstOrigin) || 0) + 2);
      }

      if (lastDest && !HOME_AIRPORTS.has(lastDest)) {
        score.set(lastDest, (score.get(lastDest) || 0) + 1);
      }
    }

    cur.setDate(cur.getDate() + 1);
  }

  if (score.size > 0) {
    let bestCode = "";
    let bestScore = -1;

    for (const [code, value] of score.entries()) {
      if (value > bestScore) {
        bestCode = code;
        bestScore = value;
      }
    }

    if (bestCode) return `LO (${bestCode})`;
  }

  return "LO";
}

function loDurationLabel(events: EventItem[], start: Date, end: Date) {
  const loEvents = events
    .filter((e) => getKind(e) === "LO")
    .filter((e) => {
      const s = parseISO(e.start);
      const en = parseISO(e.end);
      return s <= endOfDay(end) && en >= startOfDay(start);
    });

  if (loEvents.length > 0) {
    const startMs = Math.min(...loEvents.map((e) => parseISO(e.start).getTime()));
    const endMs = Math.max(...loEvents.map((e) => parseISO(e.end).getTime()));
    const hours = Math.max(1, Math.round((endMs - startMs) / 3600000));
    return `${hours}h`;
  }

  const startMs = startOfDay(start).getTime();
  const endMs = endOfDay(end).getTime();
  const hours = Math.max(1, Math.round((endMs - startMs) / 3600000));
  return `${hours}h`;
}

function barLabel(tag: DayTag, owner: Role) {
  if (tag === "FLIGHT") return "✈";
  if (tag === "LO") return "LO";
  if (tag === "DO") return "DO";
  if (tag === "ADO") return "ADO";
  if (tag === "ATDO") return "ATDO";
  if (tag === "YVC") return "YVC";
  if (tag === "RESERVE") return "RESERVE";
  if (tag === "BLANK") return "BLANK";
  if (tag === "RDO") return "DO";
  if (tag === "RCRM" || tag === "JCRM" || tag === "EMER") return "TRAINING";
  if (tag === "HM_STBY") return "🏠 HM STBY";
  if (tag === "AP_STBY") return "✈️ AP STBY";
  if (tag === "OTHER") return "OTHER";
  return "";
}

function barStyle(tag: DayTag, owner: Role): CSSProperties {
  const base: CSSProperties = {
    boxSizing: "border-box",
    height: 24,
    borderRadius: 9,
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    fontSize: 13,
    fontWeight: 900,
    border: "1px solid rgba(0,0,0,0.10)",
    color: "rgba(17,24,39,0.95)",
    textAlign: "center",
  };

  if (tag === "FLIGHT") {
    const c = owner === "HAN" ? "rgba(0,122,255,0.40)" : "rgba(239,68,68,0.40)";
    const b = owner === "HAN" ? "rgba(0,122,255,0.40)" : "rgba(239,68,68,0.40)";
    return { ...base, background: c, borderColor: b };
  }

  if (tag === "LO") {
    if (owner === "HAN") {
      return {
        ...base,
        background: "rgba(0,122,255,0.40)",
        borderColor: "rgba(0,122,255,0.4)",
      };
    }

    return {
      ...base,
      background: "rgba(239,68,68,0.40)",
      borderColor: "rgba(239,68,68,0.45)",
    };
  }

  if (tag === "RESERVE") {
    return { ...base, background: "rgba(245,158,11,0.40)", borderColor: "rgba(245,158,11,0.30)" };
  }

  if (tag === "HM_STBY" || tag === "AP_STBY") {
    return { ...base, background: "rgba(245,158,11,0.40)", borderColor: "rgba(245,158,11,0.30)" };
  }

  if (tag === "BLANK") {
    return { ...base, background: "rgba(245,158,11,0.40)", borderColor: "rgba(245,158,11,0.30)" };
  }

  if (tag === "DO" || tag === "ATDO" || tag === "YVC" || tag === "ADO") {
    return { ...base, background: "rgba(34,197,94,0.40)", borderColor: "rgba(100,116,139,0.26)" };
  }

  if (tag === "RCRM" || tag === "JCRM" || tag === "EMER") {
    return { ...base, background: "rgba(251,113,133,0.12)", borderColor: "rgba(251,113,133,0.25)" };
  }

  if (tag === "OTHER") {
    return {
      ...base,
      background: "rgba(156,163,175,0.35)",
      borderColor: "rgba(156,163,175,0.5)",
    };
  }

  return { ...base, background: "transparent", borderColor: "transparent" };
}

function assignLanesPerWeek(segs: BarSeg[]) {
  const byWeek = new Map<number, BarSeg[]>();
  for (const s of segs) {
    const arr = byWeek.get(s.week) || [];
    arr.push(s);
    byWeek.set(s.week, arr);
  }

  const placed: PlacedBar[] = [];
  const maxLane: number[] = [];

  for (const [week, list] of byWeek.entries()) {
    list.sort((a, b) => {
      const ownerRank = (x: BarSeg) => {
        if (x.id.startsWith("OVL-")) return 2;
        return x.owner === "HAN" ? 0 : 1;
      };

      const ar = ownerRank(a);
      const br = ownerRank(b);
      if (ar !== br) return ar - br;

      if (a.startIdx !== b.startIdx) return a.startIdx - b.startIdx;

      const la = a.endIdx - a.startIdx;
      const lb = b.endIdx - b.startIdx;
      if (la !== lb) return lb - la;

      return a.tag.localeCompare(b.tag);
    });

    const laneEnds: number[] = [];
    for (const it of list) {
      let lane = 0;
      while (lane < laneEnds.length) {
        if (it.startIdx > laneEnds[lane]) break;
        lane++;
      }
      if (lane === laneEnds.length) laneEnds.push(it.endIdx);
      else laneEnds[lane] = it.endIdx;

      placed.push({ ...it, lane });
    }

    maxLane[week] = laneEnds.length;
  }

  return { placed, maxLane };
}

/* =========================================================
   Colors / chips / modal helpers
========================================================= */

function kindBadgeStyle(e: EventItem): CSSProperties {
  const kind = getKind(e);
  switch (kind) {
    case "ALM":
    case "ALV":
    case "RDO":
    case "DO":
      return {
        background: "rgba(34,197,94,0.14)",
        border: "1px solid rgba(34,197,94,0.25)",
      };
    case "ATDO":
      return {
        background: "rgba(100,116,139,0.12)",
        border: "1px solid rgba(100,116,139,0.22)",
      };
    case "YVC":
      return {
        background: "rgba(100,116,139,0.12)",
        border: "1px solid rgba(100,116,139,0.22)",
      };
    case "ADO":
      return {
        background: "rgba(100,116,139,0.12)",
        border: "1px solid rgba(100,116,139,0.22)",
      };
    case "RESERVE":
    case "BLANK":
      return {
        background: "rgba(245,158,11,0.14)",
        border: "1px solid rgba(245,158,11,0.25)",
      };
    case "HM_STBY":
    case "AP_STBY":
      return {
        background: "rgba(245,158,11,0.14)",
        border: "1px solid rgba(245,158,11,0.25)",
      };
    case "LO":
      return {
        background: "rgba(14,165,233,0.14)",
        border: "1px solid rgba(14,165,233,0.25)",
      };
    default:
      return {
        background: "rgba(161,161,170,0.12)",
        border: "1px solid rgba(161,161,170,0.22)",
      };
  }
}

function sectionTitleColor(role: Role) {
  return role === "HAN" ? "rgba(0,122,255,0.95)" : "rgba(239,68,68,0.95)";
}

function ownerColor(owner: Role) {
  return owner === "HAN" ? "rgba(0,122,255,0.95)" : "rgba(239,68,68,0.95)";
}

function ownerChipBG(owner: Role) {
  return owner === "HAN" ? "rgba(0,122,255,0.10)" : "rgba(239,68,68,0.10)";
}

function ownerChipBorder(owner: Role) {
  return owner === "HAN" ? "rgba(0,122,255,0.35)" : "rgba(239,68,68,0.22)";
}

function mergeAndSaveImportedEvents(imported: EventItem[], owner: Role) {
  const existing = loadEvents();

  const normalizedImported: EventItem[] = imported.map((e) => ({
    ...e,
    owner,
  }));

  const importedKeys = new Set(
    normalizedImported.map(
      (e) => `${(e as any).owner}|${e.title}|${e.start}|${e.end}`
    )
  );

  const kept = existing.filter((e) => {
    const key = `${(e as any).owner}|${e.title}|${e.start}|${e.end}`;
    return !importedKeys.has(key);
  });

  saveEvents([...kept, ...normalizedImported]);
}

function FlightChip({
  owner,
  e,
  onClick,
}: {
  owner: Role;
  e: EventItem;
  onClick?: () => void;
}) {
  const parsed = parseFlightChip(e.title);
  const flightNo = parsed.flightNo || "";
  const route = parsed.route || normalizeSpaces(e.title);

  return (
    <div
      onClick={(ev) => {
        ev.stopPropagation();
        onClick?.();
      }}
      role="button"
      style={{
        justifySelf: "stretch",
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: "4px 1fr",
        borderRadius: 10,
        overflow: "hidden",
        border: `1px solid ${ownerChipBorder(owner)}`,
        background: ownerChipBG(owner),
        minHeight: 30,
        cursor: "pointer",
      }}
      title={`${e.title}\n${fmtHMFromISO(e.start)} ~ ${fmtHMFromISO(e.end)}`}
    >
      <div style={{ background: ownerColor(owner) }} />
      <div
        style={{
          padding: "3px 6px",
          display: "grid",
          gap: 2,
          alignContent: "center",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            fontSize: 14,
            fontWeight: 900,
            color: ownerColor(owner),
            lineHeight: 1.1,
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 9, lineHeight: 1 }}>✈</span>
          <span>{flightNo}</span>
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            opacity: 0.9,
            lineHeight: 1.1,
            textAlign: "center",
            wordBreak: "break-word",
          }}
        >
          {route}
        </div>
      </div>
    </div >
  );
}

function StatusChip({ e }: { e: EventItem }) {
  const kind = getKind(e);

  const label =
    kind === "LO"
      ? getDisplayTitle(e)
      : kind === "ATDO"
        ? "ATDO"
        : kind === "ADO"
          ? "ADO"
          : kind === "YVC"
            ? "YVC"
            : kind === "DO"
              ? "DO"
              : kind === "RESERVE"
                ? "RESERVE"
                : kind === "BLANK"
                  ? "BLANK"
                  : kind === "RDO"
                    ? "DO"
                    : kind === "ALM"
                      ? "DO"
                      : kind === "ALV"
                        ? "DO"
                        : kind === "HM_STBY"
                          ? "🏠 HM STBY"
                          : kind === "AP_STBY"
                            ? "✈️ AP STBY"
                            : getDisplayTitle(e);

  return (
    <div
      style={{
        minHeight: 16,
        borderRadius: 6,
        padding: "2px 6px",
        fontSize: 10,
        fontWeight: 800,
        lineHeight: 1,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        opacity: 0.9,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        ...kindBadgeStyle(e),
      }}
      title={e.title}
    >
      {label}
    </div>
  );
}

/* =========================================================
   Page
========================================================= */

export default function CalendarPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [refreshSig, setRefreshSig] = useState(0);
  const [compareOn, setCompareOn] = useState(true);
  const [showHanToggle, setShowHanToggle] = useState(true);
  const [showKyuToggle, setShowKyuToggle] = useState(true);

  const me: Role = useMemo(() => getRole() as Role, []);
  const meName = me === "HAN" ? "계성한" : "안규영";

  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<EventItem | null>(null);
  const [isFlightModalOpen, setIsFlightModalOpen] = useState(false);

  function openFlight(e: EventItem) {
    setSelectedFlight(e);
    setIsFlightModalOpen(true);
  }

  function closeFlight() {
    setSelectedFlight(null);
    setIsFlightModalOpen(false);
  }

  useEffect(() => {
    const imported = (location.state as any)?.importedEvents as EventItem[] | undefined;
    if (!imported || imported.length === 0) return;

    const roleFromImport = (location.state as any)?.importRole as Role | undefined;
    const owner = roleFromImport ?? me;

    mergeAndSaveImportedEvents(imported, owner);
    setRefreshSig((s) => s + 1);
    navigate("/cal", { replace: true, state: null });
  }, [location.state, me, navigate]);

  const events = useMemo(() => loadEvents(), [refreshSig]);

  const hanEvents = useMemo(() => events.filter((e) => (e as any).owner === "HAN"), [events]);
  const kyuEvents = useMemo(() => events.filter((e) => (e as any).owner === "KYU"), [events]);

  const visHanEvents = useMemo(() => (showHanToggle ? hanEvents : []), [showHanToggle, hanEvents]);
  const visKyuEvents = useMemo(() => (showKyuToggle ? kyuEvents : []), [showKyuToggle, kyuEvents]);

  const hanDutyEvents = useMemo(() => hanEvents.filter(isDutyLike), [hanEvents]);
  const kyuDutyEvents = useMemo(() => kyuEvents.filter(isDutyLike), [kyuEvents]);

  const visHanDutyEvents = useMemo(() => (compareOn ? hanDutyEvents : []), [compareOn, hanDutyEvents]);
  const visKyuDutyEvents = useMemo(() => (compareOn ? kyuDutyEvents : []), [compareOn, kyuDutyEvents]);

  const first = startOfMonth(month);
  const firstWeekday = first.getDay();
  const totalDays = daysInMonth(month);

  const monthDays: Date[] = [];
  for (let d = 1; d <= totalDays; d++) {
    monthDays.push(new Date(month.getFullYear(), month.getMonth(), d));
  }

  const cells: Date[] = [];

  // 이전 달 날짜 채우기
  const prevMonthLastDay = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push(new Date(month.getFullYear(), month.getMonth() - 1, prevMonthLastDay - i));
  }

  // 현재 달 날짜
  for (const d of monthDays) cells.push(d);

  // 다음 달 날짜 채우기
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push(new Date(month.getFullYear(), month.getMonth() + 1, nextDay));
    nextDay++;
  }

  const weekCount = Math.ceil(cells.length / 7);
  const visibleDays = cells;

  function prevMonth() {
    setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  }

  function nextMonth() {
    setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  }

  function openDay(day: Date) {
    setSelectedDay(day);
    setIsModalOpen(true);
  }

  function closeDay() {
    setIsModalOpen(false);
    setSelectedDay(null);
    setRefreshSig((s) => s + 1);
  }

  const minutesByDayKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of visibleDays) {
      const { minutes } = overlapMinutesForDay(hanDutyEvents, kyuDutyEvents, d);
      map.set(ymd(d), minutes);
    }
    return map;
  }, [hanDutyEvents, kyuDutyEvents, visibleDays]);

  const overlapRuns = useMemo(() => {
    const runs: { start: Date; end: Date; dayCount: number; totalMinutes: number }[] = [];
    const oneDay = 24 * 60 * 60 * 1000;

    let curStart: Date | null = null;
    let curEnd: Date | null = null;
    let curCount = 0;

    for (const d of visibleDays) {
      const has = (minutesByDayKey.get(ymd(d)) || 0) > 0;

      if (!has) {
        if (curStart) {
          let tot = 0;
          let cur = startOfDay(curStart);
          const end = startOfDay(curEnd!);
          while (cur.getTime() <= end.getTime()) {
            tot += minutesByDayKey.get(ymd(cur)) || 0;
            cur = new Date(cur.getTime() + oneDay);
          }
          runs.push({ start: curStart, end: curEnd!, dayCount: curCount, totalMinutes: tot });
        }
        curStart = null;
        curEnd = null;
        curCount = 0;
        continue;
      }

      if (!curStart) {
        curStart = d;
        curEnd = d;
        curCount = 1;
      } else {
        const isConsecutive = startOfDay(d).getTime() - startOfDay(curEnd!).getTime() === oneDay;
        if (isConsecutive) {
          curEnd = d;
          curCount += 1;
        } else {
          let tot = 0;
          let cur = startOfDay(curStart);
          const end = startOfDay(curEnd!);
          while (cur.getTime() <= end.getTime()) {
            tot += minutesByDayKey.get(ymd(cur)) || 0;
            cur = new Date(cur.getTime() + oneDay);
          }
          runs.push({ start: curStart, end: curEnd!, dayCount: curCount, totalMinutes: tot });

          curStart = d;
          curEnd = d;
          curCount = 1;
        }
      }
    }

    if (curStart) {
      let tot = 0;
      let cur = startOfDay(curStart);
      const end = startOfDay(curEnd!);
      while (cur.getTime() <= end.getTime()) {
        tot += minutesByDayKey.get(ymd(cur)) || 0;
        cur = new Date(cur.getTime() + oneDay);
      }
      runs.push({ start: curStart, end: curEnd!, dayCount: curCount, totalMinutes: tot });
    }

    return runs;
  }, [visibleDays, minutesByDayKey]);

  const { placedBars, maxLaneByWeek } = useMemo(() => {
    const segs: BarSeg[] = [];

    const hanRuns = buildRunsByDayKey(visibleDays, (d) => dayStatusFor(visHanEvents, d, "HAN"));

    const kyuRuns = buildRunsByDayKey(visibleDays, (d) => dayStatusFor(visKyuEvents, d, "KYU"));

    const pushRun = (owner: Role, tag: DayTag, start: Date, end: Date) => {
      if (tag === "NONE") return;

      let label = barLabel(tag, owner);

      if (tag === "LO") {
        const loText =
          owner === "HAN"
            ? loLabelForRun(visHanEvents, start, end)
            : loLabelForRun(visKyuEvents, start, end);

        const loDur =
          owner === "HAN"
            ? loDurationLabel(visHanEvents, start, end)
            : loDurationLabel(visKyuEvents, start, end);

        label = `${loText} · ${loDur}`;
      } else if (tag === "FLIGHT") {
        label =
          owner === "HAN"
            ? flightBarLabelForDay("HAN", visHanEvents, start)
            : flightBarLabelForDay("KYU", visKyuEvents, start);
      }

      for (const s of splitRunIntoWeekBars(start, end, visibleDays)) {
        segs.push({
          id: `${owner}-${tag}-${ymd(start)}-${ymd(end)}-${s.week}-${s.startIdx}-${s.endIdx}`,
          week: s.week,
          startIdx: s.startIdx,
          endIdx: s.endIdx,
          left: s.left,
          width: s.width,
          label,
          owner,
          tag,
        });
      }
    };

    for (const r of hanRuns) pushRun("HAN", r.tag, r.start, r.end);
    for (const r of kyuRuns) pushRun("KYU", r.tag, r.start, r.end);

    if (compareOn) {
      for (const r of overlapRuns) {
        const label = `Overlap ${hoursLabel(r.totalMinutes, r.dayCount)}`;
        for (const s of splitRunIntoWeekBars(r.start, r.end, visibleDays)) {
          segs.push({
            id: `OVL-${ymd(r.start)}-${ymd(r.end)}-${s.week}-${s.startIdx}-${s.endIdx}`,
            week: s.week,
            startIdx: s.startIdx,
            endIdx: s.endIdx,
            left: s.left,
            width: s.width,
            label,
            owner: "HAN",
            tag: "OTHER",
          });
        }
      }
    }

    const { placed, maxLane } = assignLanesPerWeek(segs);
    return { placedBars: placed, maxLaneByWeek: maxLane };
  }, [visibleDays, month, visHanEvents, visKyuEvents, overlapRuns, compareOn]);

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

  const modalHan = selectedDay ? listForDay(visHanEvents, selectedDay) : [];
  const modalKyu = selectedDay ? listForDay(visKyuEvents, selectedDay) : [];
  const modalOverlap = selectedDay
    ? overlapForDay(visHanDutyEvents, visKyuDutyEvents, selectedDay)
    : { intervals: [], minutes: 0 };

  const selectedFlightDay = selectedFlight
    ? startOfDay(new Date(selectedFlight.start))
    : null;

  const selectedFlightOwnerEvents =
    selectedFlight?.owner === "HAN" ? visHanEvents : visKyuEvents;

  const selectedDutyLabel =
    selectedFlight && selectedFlightDay
      ? dutyTimeLabel(selectedFlightOwnerEvents, selectedFlightDay)
      : null;

  const selectedShowUpLabel =
    selectedFlight && selectedFlightDay
      ? showUpTimeLabel(selectedFlightOwnerEvents, selectedFlightDay)
      : null;

  function exportAll() {
    exportICS(events, `twocrew-all-${monthLabel(month)}.ics`);
  }

  function exportHan() {
    exportICS(hanEvents, `twocrew-han-${monthLabel(month)}.ics`);
  }

  function exportKyu() {
    exportICS(kyuEvents, `twocrew-kyu-${monthLabel(month)}.ics`);
  }

  async function importIcsFile(owner: Role, file: File) {
    const text = await file.text();
    const imported = parseIcsToEvents(text, owner);
    mergeAndSaveImportedEvents(imported, owner);
    setRefreshSig((s) => s + 1);
  }

  async function onPickIcs(owner: Role) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ics,text/calendar";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      await importIcsFile(owner, file);
    };
    input.click();
  }

  const [darkMode, setDarkMode] = useState(true);

  const theme = darkMode
    ? {
      pageBg: "#111827",
      cardBg: "#1f2937",
      headerBg: "#243041",
      border: "rgba(255,255,255,0.10)",
      borderSoft: "rgba(255,255,255,0.06)",
      text: "rgba(255,255,255,0.92)",
      textSoft: "rgba(255,255,255,0.72)",
      textDim: "rgba(255,255,255,0.40)",
      emptyBg: "rgba(255,255,255,0.03)",
      todayBg: "#ffffff",
      todayText: "#000000",
      buttonBg: "#243041",
      modalBg: "#1f2937",
      overlay: "rgba(0,0,0,0.60)",
    }
    : {
      pageBg: "#f3f4f6",
      cardBg: "#ffffff",
      headerBg: "rgba(0,0,0,0.02)",
      border: "rgba(0,0,0,0.10)",
      borderSoft: "rgba(0,0,0,0.06)",
      text: "rgba(17,24,39,0.92)",
      textSoft: "rgba(17,24,39,0.75)",
      textDim: "rgba(0,0,0,0.25)",
      emptyBg: "rgba(0,0,0,0.03)",
      todayBg: "rgba(0,0,0,0.95)",
      todayText: "#ffffff",
      buttonBg: "#ffffff",
      modalBg: "#ffffff",
      overlay: "rgba(0,0,0,0.35)",
    };

  const totalFlightCount =
    hanEvents.filter((e) => getKind(e) === "FLIGHT").length +
    kyuEvents.filter((e) => getKind(e) === "FLIGHT").length;

  const totalLayoverCount = events.filter((e) => getKind(e) === "LO").length;

  const thisMonthHanFlights = hanEvents.filter((e) => {
    const d = new Date(e.start);
    return getKind(e) === "FLIGHT" && d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
  }).length;

  const thisMonthKyuFlights = kyuEvents.filter((e) => {
    const d = new Date(e.start);
    return getKind(e) === "FLIGHT" && d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
  }).length;


  const todayKey = ymd(new Date());

  return (
    <div
      style={{
  padding: "12px 12px 24px",
  width: "100%",
  maxWidth: 980,
  margin: "0 auto",
  background: theme.pageBg,
  color: theme.text,
  minHeight: "100vh",
  boxSizing: "border-box",
}}
    >
      
{/* hero section */}
      {/* App-like top area */}
      <div
        style={{
          marginBottom: 14,
          display: "grid",
          gap: 12,
        }}
      >
        {/* Hero */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 24,
            padding: "18px 16px 16px",
            minHeight: 180,
            background:
              darkMode
                ? "linear-gradient(135deg, rgba(17,24,39,0.20), rgba(0,0,0,0.38)), url('/airplane.jpg')"
                : "linear-gradient(135deg, rgba(255,255,255,0.20), rgba(0,0,0,0.18)), url('/airplane.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            color: "#fff",
            boxShadow: darkMode
              ? "0 18px 40px rgba(0,0,0,0.34)"
              : "0 18px 36px rgba(0,0,0,0.16)",
            border: darkMode
              ? "1px solid rgba(255,255,255,0.10)"
              : "1px solid rgba(255,255,255,0.35)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                darkMode
                  ? "linear-gradient(180deg, rgba(15,23,42,0.10) 0%, rgba(15,23,42,0.66) 100%)"
                  : "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(17,24,39,0.50) 100%)",
            }}
          />

          <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 14 }}>
            {/* top row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 0.3,
                    opacity: 0.92,
                  }}
                >
                  TwoCrew Calendar
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 30,
                    lineHeight: 1,
                    fontWeight: 950,
                    letterSpacing: -0.8,
                  }}
                >
                  {monthLabel(month)}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    opacity: 0.92,
                  }}
                >
                  현재 사용자 · {meName}
                </div>
              </div>

              <button
                onClick={() => setDarkMode((v) => !v)}
                style={{
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  borderRadius: 14,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {darkMode ? "Light" : "Dark"}
              </button>
            </div>

            {/* summary cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              <div
                style={{
                  padding: "12px 10px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.14)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700 }}>Flights</div>
                <div style={{ marginTop: 4, fontSize: 22, fontWeight: 950 }}>{totalFlightCount}</div>
              </div>

              <div
                style={{
                  padding: "12px 10px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.14)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700 }}>Layovers</div>
                <div style={{ marginTop: 4, fontSize: 22, fontWeight: 950 }}>{totalLayoverCount}</div>
              </div>

              <div
                style={{
                  padding: "12px 10px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.14)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700 }}>Month</div>
                <div style={{ marginTop: 4, fontSize: 22, fontWeight: 950 }}>
                  {thisMonthHanFlights + thisMonthKyuFlights}
                </div>
              </div>
            </div>

            {/* bottom pills */}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  padding: "7px 10px",
                  borderRadius: 999,
                  background: "rgba(0,122,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                HAN {thisMonthHanFlights}
              </div>

              <div
                style={{
                  padding: "7px 10px",
                  borderRadius: 999,
                  background: "rgba(239,68,68,0.18)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                KYU {thisMonthKyuFlights}
              </div>

              <div
                style={{
                  padding: "7px 10px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                Mobile UI
              </div>
            </div>
          </div>
        </div>

        {/* Month navigation */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 44px",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            onClick={prevMonth}
            style={{
              ...btnStyle,
              height: 44,
              padding: 0,
              borderRadius: 14,
              background: theme.buttonBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              fontSize: 18,
            }}
          >
            ‹
          </button>

          <div
            style={{
              height: 44,
              borderRadius: 14,
              border: `1px solid ${theme.border}`,
              background: theme.cardBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 950,
              fontSize: 16,
              letterSpacing: -0.3,
            }}
          >
            {monthLabel(month)}
          </div>

          <button
            onClick={nextMonth}
            style={{
              ...btnStyle,
              height: 44,
              padding: 0,
              borderRadius: 14,
              background: theme.buttonBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              fontSize: 18,
            }}
          >
            ›
          </button>
        </div>

        {/* Quick actions */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          <button
            onClick={exportAll}
            style={{
              ...btnStyle,
              background: theme.buttonBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            ICS 전체
          </button>

          <button
            onClick={exportHan}
            style={{
              ...btnStyle,
              background: theme.buttonBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            ICS HAN
          </button>

          <button
            onClick={exportKyu}
            style={{
              ...btnStyle,
              background: theme.buttonBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            ICS KYU
          </button>

          <button
            onClick={() => navigate("/stats")}
            style={{
              ...btnStyle,
              background: theme.buttonBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            통계
          </button>

          <button
            onClick={() => navigate("/week")}
            style={{
              ...btnStyle,
              background: theme.buttonBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Week
          </button>
        </div>

        {/* Import / toggles */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => onPickIcs("HAN")}
            style={{
              ...btnStyle,
              background: theme.buttonBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
            }}
          >
            가져오기(HAN)
          </button>

          <button
            onClick={() => onPickIcs("KYU")}
            style={{
              ...btnStyle,
              background: theme.buttonBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
            }}
          >
            가져오기(KYU)
          </button>

          <label
            style={{
              ...toggleStyle,
              background: showHanToggle ? "rgba(0,122,255,0.12)" : theme.buttonBg,
              color: theme.text,
              border: showHanToggle
                ? "1px solid rgba(0,122,255,0.35)"
                : `1px solid ${theme.border}`,
            }}
          >
            <input
              type="checkbox"
              checked={showHanToggle}
              onChange={() => setShowHanToggle((v) => !v)}
            />
            HAN
          </label>

          <label
            style={{
              ...toggleStyle,
              background: showKyuToggle ? "rgba(239,68,68,0.12)" : theme.buttonBg,
              color: theme.text,
              border: showKyuToggle
                ? "1px solid rgba(239,68,68,0.30)"
                : `1px solid ${theme.border}`,
            }}
          >
            <input
              type="checkbox"
              checked={showKyuToggle}
              onChange={() => setShowKyuToggle((v) => !v)}
            />
            KYU
          </label>
        </div>
      </div>

      {/* Weekday header */}
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          overflow: "hidden",
          background: theme.cardBg,
        }}
      >
        {weekDays.map((d, i) => (
          <div
            key={d}
            style={{
              fontSize: 13,
              padding: "8px 10px",
              borderRight: i === 6 ? "none" : `1px solid ${theme.borderSoft}`,
              background: theme.headerBg,
              fontWeight: 800,
              textAlign: "center",
              color: theme.textSoft,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        {Array.from({ length: weekCount }).map((_, w) => {
          const weekCells = cells.slice(w * 7, w * 7 + 7);
          const allowedStatusTags: DayTag[] = [
            "FLIGHT",
            "ADO",
            "DO",
            "LO",
            "RESERVE",
            "ATDO",
            "YVC",
            "BLANK",
            "HM_STBY",
            "AP_STBY",
            "JCRM",
            "RCRM",
            "EMER",
          ];

          const hanWeekBars = placedBars.filter(
            (b) =>
              b.week === w &&
              b.owner === "HAN" &&
              allowedStatusTags.includes(b.tag) &&
              !b.id.startsWith("OVL-")
          );

          const kyuWeekBars = placedBars.filter(
            (b) =>
              b.week === w &&
              b.owner === "KYU" &&
              allowedStatusTags.includes(b.tag) &&
              !b.id.startsWith("OVL-")
          );

          return (
            <div
              key={w}
              style={{
                position: "relative",
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 12,
                overflow: "hidden",
                background: theme.cardBg,
              }}
            >
              {/* Date row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {weekCells.map((day, idx) => {
                  const inCurrentMonth = day.getMonth() === month.getMonth();
                  const empty = !inCurrentMonth;
                  const isToday = ymd(day) === todayKey;

                  return (
                    <div
                      key={idx}
                      onClick={day ? () => openDay(day) : undefined}
                      style={{
                        minHeight: 30,
                        padding: "6px 8px",
                        cursor: day ? "pointer" : "default",
                        background: empty ? theme.emptyBg : theme.cardBg,
                        borderRight: idx === 6 ? "none" : `1px solid ${theme.borderSoft}`,
                        display: "flex",
                        justifyContent: "center",
                        opacity: inCurrentMonth ? 1 : 0.45,
                        color: inCurrentMonth ? theme.text : theme.textDim,
                      }}
                      title={day ? "클릭해서 상세보기" : ""}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 700,
                          fontSize: 12,
                          background: isToday ? theme.todayBg : "transparent",
                          color: isToday ? theme.todayText : empty ? theme.textDim : theme.text,
                          boxShadow: isToday ? "0 0 0 2px rgba(59,130,246,0.55)" : "none",
                        }}
                      >
                        {day.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* HAN status row */}
              <div
                style={{
                  position: "relative",
                  height: 28,
                  padding: "2px 4px",
                  borderTop: `1px solid ${theme.borderSoft}`,
                  borderBottom: `1px solid ${theme.borderSoft}`,
                  background: theme.cardBg,
                }}
              >
                {hanWeekBars.map((b) => {
                  const top = 4;
                  const style = barStyle(b.tag, b.owner);

                  const loParts =
                    b.tag === "LO"
                      ? (() => {
                        const [baseLabel, durationLabel = ""] = b.label.split(" · ");
                        const ap = loAirport(baseLabel);
                        return {
                          airport: ap,
                          duration: durationLabel,
                        };
                      })()
                      : null;

                  return (
                    <div
                      key={b.id}
                      style={{
                        position: "absolute",
                        left: `${b.left}%`,
                        width: `calc(${b.width}% - 2px)`,
                        top,
                        pointerEvents: "none",
                        ...style,
                        color: theme.text,
                      }}
                      title={b.label}
                    >
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {b.tag === "LO" && loParts ? (
                            <>
                              <span style={{ fontSize: 18, lineHeight: 1 }}>🛏</span>
                              <span style={{ fontWeight: 900, opacity: 0.9 }}>LO</span>
                              <span>{loParts.airport}</span>
                              {flagUrlByAirport(loParts.airport) ? (
                                <img
                                  src={flagUrlByAirport(loParts.airport)}
                                  alt=""
                                  style={{
                                    width: 16,
                                    height: 12,
                                    objectFit: "cover",
                                    borderRadius: 2,
                                    display: "inline-block",
                                    verticalAlign: "middle",
                                  }}
                                />
                              ) : null}
                              {loParts.duration ? (
                                <span style={{ opacity: 0.85, fontSize: 12 }}>
                                  {loParts.duration}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span>{b.label}</span>
                          )}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Cell content row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  borderTop: `1px solid ${theme.borderSoft}`,
                }}
              >
                {weekCells.map((day, idx) => {
                  const hanAll = listForDay(visHanEvents, day);
                  const kyuAll = listForDay(visKyuEvents, day);

                  const hanFlights = hanAll.filter((e) => getKind(e) === "FLIGHT");
                  const kyuFlights = kyuAll.filter((e) => getKind(e) === "FLIGHT");

                  const hanHasLoOnly =
                    hanAll.some((e) => getKind(e) === "LO") && hanFlights.length === 0;

                  const kyuHasLoOnly =
                    kyuAll.some((e) => getKind(e) === "LO") && kyuFlights.length === 0;

                  const hanLegs = hanHasLoOnly ? [] : hanFlights.slice(0, 2);
                  const kyuLegs = kyuHasLoOnly ? [] : kyuFlights.slice(0, 2);

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => openDay(day)}
                      role="button"
                      style={{
                        padding: "8px 2px",
                        minHeight: 170,
                        background: theme.cardBg,
                        borderRight: idx === 6 ? "none" : `1px solid ${theme.borderSoft}`,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-start",
                      }}
                      title="클릭해서 상세보기"
                    >
                      {/* HAN FLIGHT AREA */}
                      <div
                        style={{
                          height: 82,
                          display: "grid",
                          gap: 4,
                          alignContent: "start",
                        }}
                      >
                        {hanLegs.length > 0
                          ? hanLegs.map((e) => (
                            <FlightChip
                              key={e.id}
                              owner="HAN"
                              e={e}
                              onClick={() => openFlight(e)}
                            />
                          ))
                          : null}
                      </div>

                      {/* divider */}
                      <div
                        style={{
                          height: 1,
                          background: theme.borderSoft,
                          margin: "4px 0",
                          flexShrink: 0,
                        }}
                      />

                      {/* KYU FLIGHT AREA */}
                      <div
                        style={{
                          height: 82,
                          display: "grid",
                          gap: 4,
                          alignContent: "start",
                        }}
                      >
                        {kyuLegs.length > 0
                          ? kyuLegs.map((e) => (
                            <FlightChip
                              key={e.id}
                              owner="KYU"
                              e={e}
                              onClick={() => openFlight(e)}
                            />
                          ))
                          : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* KYU status row */}
              <div
                style={{
                  position: "relative",
                  height: 28,
                  padding: "2px 4px",
                  borderTop: `1px solid ${theme.borderSoft}`,
                  background: theme.cardBg,
                }}
              >
                {kyuWeekBars.map((b) => {
                  const top = 4;
                  const style = barStyle(b.tag, b.owner);

                  const loParts =
                    b.tag === "LO"
                      ? (() => {
                        const [baseLabel, durationLabel = ""] = b.label.split(" · ");
                        const ap = loAirport(baseLabel);
                        return {
                          airport: ap,
                          duration: durationLabel,
                        };
                      })()
                      : null;

                  return (
                    <div
                      key={b.id}
                      style={{
                        position: "absolute",
                        left: `${b.left}%`,
                        width: `calc(${b.width}% - 2px)`,
                        top,
                        pointerEvents: "none",
                        ...style,
                        color: theme.text,
                      }}
                      title={b.label}
                    >
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          display: "block",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {b.tag === "LO" && loParts ? (
                            <>
                              <span style={{ fontSize: 18, lineHeight: 1 }}>🛏</span>
                              <span style={{ fontWeight: 900, opacity: 0.9 }}>LO</span>
                              <span>{loParts.airport}</span>
                              {flagUrlByAirport(loParts.airport) ? (
                                <img
                                  src={flagUrlByAirport(loParts.airport)}
                                  alt=""
                                  style={{
                                    width: 16,
                                    height: 12,
                                    objectFit: "cover",
                                    borderRadius: 2,
                                    display: "inline-block",
                                    verticalAlign: "middle",
                                  }}
                                />
                              ) : null}
                              {loParts.duration ? (
                                <span style={{ opacity: 0.85, fontSize: 12 }}>
                                  {loParts.duration}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span>{b.label}</span>
                          )}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Flight Modal */}
      {isFlightModalOpen && selectedFlight && (
        <div
          onClick={closeFlight}
          style={{
            position: "fixed",
            inset: 0,
            background: theme.overlay,
            display: "grid",
            placeItems: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 100%)",
              background: theme.modalBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: 16,
              padding: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>
                {parseFlightChip(selectedFlight.title).flightNo || "FLIGHT"}
              </div>
              <button
                onClick={closeFlight}
                style={{
                  ...modalCloseBtn,
                  background: theme.buttonBg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                }}
              >
                닫기
              </button>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background:
                  selectedFlight.owner === "HAN"
                    ? "rgba(0,122,255,0.12)"
                    : "rgba(239,68,68,0.12)",
                border:
                  selectedFlight.owner === "HAN"
                    ? "1px solid rgba(0,122,255,0.24)"
                    : "1px solid rgba(239,68,68,0.24)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                {parseFlightChip(selectedFlight.title).flightNo || "FLIGHT"}
              </div>
              <div style={{ marginTop: 4, fontSize: 15, fontWeight: 800 }}>
                {parseFlightChip(selectedFlight.title).route || selectedFlight.title}
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13 }}>
                <strong>출발</strong> {fmtHMFromISO(selectedFlight.start)}
              </div>

              <div style={{ fontSize: 13 }}>
                <strong>도착</strong> {fmtHMFromISO(selectedFlight.end)}
              </div>

              <div style={{ fontSize: 13 }}>
                <strong>Block</strong> {blockTimeLabel(selectedFlight.start, selectedFlight.end)}
              </div>

              <div style={{ fontSize: 13 }}>
                <strong>Duty</strong> {selectedDutyLabel ?? "-"}
              </div>

              <div style={{ fontSize: 13 }}>
                <strong>출근</strong> {selectedShowUpLabel ?? "-"}
              </div>

              <div style={{ fontSize: 13 }}>
                <strong>원문</strong> {selectedFlight.title}
              </div>

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {selectedFlight.start} ~ {selectedFlight.end}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Day Modal */}
      {isModalOpen && selectedDay && (
        <div
          onClick={closeDay}
          style={{
            position: "fixed",
            inset: 0,
            background: theme.overlay,
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(820px, 100%)",
              background: theme.modalBg,
              borderRadius: 16,
              padding: 16,
              color: theme.text,
              border: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{ymd(selectedDay)}</div>
              <button
                onClick={closeDay}
                style={{
                  ...modalCloseBtn,
                  background: theme.buttonBg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                }}
              >
                닫기
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
              <Section title="HAN" color={sectionTitleColor("HAN")} items={modalHan} darkMode={darkMode} />
              <Section title="KYU" color={sectionTitleColor("KYU")} items={modalKyu} darkMode={darkMode} />

              <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: 12 }}>
                <div style={{ fontWeight: 900, color: "rgba(255,59,48,0.92)", marginBottom: 8 }}>
                  Overlap (시간 겹침)
                </div>

                {modalOverlap.minutes === 0 ? (
                  <div style={{ opacity: 0.7, fontSize: 13 }}>겹치는 시간 없음</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>
                      총 {(modalOverlap.minutes / 60).toFixed(2)}h ({modalOverlap.minutes}분)
                    </div>
                    {modalOverlap.intervals.map(([s, e], idx) => (
                      <div key={idx} style={{ fontSize: 13, opacity: 0.9 }}>
                        {fmtHMFromDateKST(s)} ~ {fmtHMFromDateKST(e)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
              ✅ 셀에서는 “편명+공항”만 보여주고, 시간은 상세보기에서 확인
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Modal section
========================================================= */

function Section({
  title,
  color,
  items,
  darkMode,
}: {
  title: string;
  color: string;
  items: EventItem[];
  darkMode: boolean;
}) {
  return (
    <div
      style={{
        border: darkMode
          ? "1px solid rgba(255,255,255,0.10)"
          : "1px solid rgba(0,0,0,0.10)",
        borderRadius: 14,
        padding: 12,
        background: darkMode ? "#243041" : "#ffffff",
      }}
    >
      <div style={{ fontWeight: 900, color, marginBottom: 8 }}>{title}</div>

      {items.length === 0 ? (
        <div style={{ opacity: 0.7, fontSize: 13 }}>일정 없음</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((e) => {
            const allDay = isAllDayEvent(e);
            const kind = getKind(e);

            const timeLabel = allDay ? "" : `${fmtHMFromISO(e.start)} ~ ${fmtHMFromISO(e.end)}`;
            const mainTitle = kind === "FLIGHT" ? normalizeSpaces(e.title) : getDisplayTitle(e);
            const subTitle =
              e.title && normalizeSpaces(e.title) !== mainTitle ? normalizeSpaces(e.title) : "";

            return (
              <div
                key={e.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "96px 1fr",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  ...(kindBadgeStyle(e) as any),
                }}
              >
                <div style={{ fontWeight: 900, color, fontSize: 12 }}>{timeLabel}</div>

                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>
                    {kind === "FLIGHT" ? `✈ ${mainTitle}` : mainTitle}
                  </div>

                  {subTitle ? <div style={{ fontSize: 12, opacity: 0.75 }}>{subTitle}</div> : null}

                  <div style={{ fontSize: 11, opacity: 0.6 }}>
                    {e.start} ~ {e.end}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   Styles
========================================================= */

const toggleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontWeight: 800,
  fontSize: 12,
  padding: "6px 8px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "white",
  cursor: "pointer",
};

const btnStyle: CSSProperties = {
  padding: "10px 12px",
  minHeight: 40,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.14)",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 12,
};

const modalCloseBtn: CSSProperties = {
  border: "1px solid rgba(0,0,0,0.14)",
  borderRadius: 12,
  padding: "8px 10px",
  background: "white",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 12,
};