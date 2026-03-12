// src/pages/Calendar.tsx
import { useMemo, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getRole, loadEvents, saveEvents } from "../services/schedule";
import type { EventItem } from "../services/schedule";
import { exportICS } from "../utils/ics";

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

/* =========================================================
   Kind / title helpers
========================================================= */

type Kind =
  | "FLIGHT"
  | "LO"
  | "DO"
  | "ATDO"
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

  if (rawK) {
    if (rawK === "FLIGHT") return "FLIGHT";
    if (rawK === "LO") return "LO";
    if (rawK === "DO") return "DO";
    if (rawK === "ATDO") return "ATDO";
    if (rawK === "RESERVE") return "RESERVE";
    if (rawK === "BLANK") return "BLANK";
    if (rawK === "RDO") return "RDO";
    if (rawK === "ALM") return "ALM";
    if (rawK === "ALV") return "ALV";
    if (rawK === "HM_STBY") return "HM_STBY";
    if (rawK === "AP_STBY") return "AP_STBY";
    if (rawK === "RCRM") return "RCRM";
    if (rawK === "JCRM") return "JCRM";
    if (rawK === "EMER") return "EMER";
  }

  if (t === "LO" || t.startsWith("LO ")) return "LO";
  if (t === "DO" || t.startsWith("DO ")) return "DO";
  if (t === "ATDO" || t.startsWith("ATDO ")) return "ATDO";
  if (t === "RESERVE" || t.startsWith("RESERVE ")) return "RESERVE";
  if (t === "BLANK" || t.startsWith("BLANK ")) return "BLANK";
  if (t === "RDO" || t.startsWith("RDO ")) return "RDO";
  if (t === "ALM" || t.startsWith("ALM ")) return "ALM";
  if (t === "ALV" || t.startsWith("ALV ")) return "ALV";

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
    case "RESERVE":
      return "RESERVE";
    case "BLANK":
      return "BLANK";
    case "HM_STBY":
      return "HM_STBY";
    case "AP_STBY":
      return "AP_STBY";
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

  const mNo = t.match(/\b[A-Z]{1,3}\d{2,4}\b/);
  const flightNo = mNo?.[0];

  const airports = Array.from(t.matchAll(/\b[A-Z]{3}\b/g)).map((m) => m[0]);
  let route: string | undefined;

  if (airports.length >= 2) {
    route = `${airports[0]}-${airports[1]}`;
  } else if (airports.length === 1) {
    route = airports[0];
  } else {
    const mRoute = t.match(/\b[A-Z]{3}(?:-[A-Z]{3})+\b/);
    route = mRoute?.[0];
  }

  return { flightNo, route };
}

function flightDestAirportFromTitle(title: string): string | null {
  const { route } = parseFlightChip(title);
  if (!route) return null;
  const parts = route.split("-");
  if (parts.length >= 2) return parts[1] || null;
  return parts[0] || null;
}

function flightBarLabelForDay(owner: Role, ownerEvents: EventItem[], day: Date) {
  const flights = ownerEvents
    .filter((e) => getKind(e) === "FLIGHT" && eventCoversDay(e, day))
    .sort((a, b) => a.start.localeCompare(b.start));

  const first = flights[0];
  if (!first) return owner;

  const dest = flightDestAirportFromTitle(first.title);
  return dest ? `→${dest}` : owner;
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

function splitRunIntoWeekBars(runStart: Date, runEnd: Date, month: Date) {
  const out: { week: number; left: number; width: number; startIdx: number; endIdx: number }[] = [];
  const oneDay = 24 * 60 * 60 * 1000;

  let cur = startOfDay(asDate(runStart));
  const end = startOfDay(asDate(runEnd));

  let segStart = cur;
  let segWeek = weekIndexOf(segStart, month);

  while (cur.getTime() <= end.getTime()) {
    const w = weekIndexOf(cur, month);
    if (w !== segWeek) {
      const segEnd = new Date(cur.getTime() - oneDay);
      const startIdx = dayOfWeekIndex(segStart);
      const endIdx = dayOfWeekIndex(segEnd);
      const left = (startIdx / 7) * 100;
      const right = ((endIdx + 1) / 7) * 100;

      out.push({
        week: segWeek,
        left,
        width: Math.max(2, right - left),
        startIdx,
        endIdx,
      });

      segStart = cur;
      segWeek = w;
    }

    cur = new Date(cur.getTime() + oneDay);
  }

  const segEnd = end;
  const startIdx = dayOfWeekIndex(segStart);
  const endIdx = dayOfWeekIndex(segEnd);
  const left = (startIdx / 7) * 100;
  const right = ((endIdx + 1) / 7) * 100;

  out.push({
    week: segWeek,
    left,
    width: Math.max(2, right - left),
    startIdx,
    endIdx,
  });

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
  "DO",
  "OTHER",
  "NONE",
];

function toDayTagFromKind(kind: Kind): DayTag {
  if (kind === "FLIGHT") return "FLIGHT";
  if (kind === "LO") return "LO";
  if (kind === "HM_STBY") return "HM_STBY";
  if (kind === "AP_STBY") return "AP_STBY";
  if (kind === "RESERVE") return "RESERVE";
  if (kind === "BLANK") return "BLANK";
  if (kind === "RCRM") return "RCRM";
  if (kind === "JCRM") return "JCRM";
  if (kind === "EMER") return "EMER";
  if (kind === "RDO") return "DO";
  if (kind === "ALM") return "DO";
  if (kind === "ALV") return "DO";
  if (kind === "DO") return "DO";
  if (kind === "ATDO") return "ATDO";
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

function loLabelForDay(events: EventItem[], day: Date) {
  const lo = events.find((e) => getKind(e) === "LO" && eventCoversDay(e, day));
  if (!lo) return "LO";
  return normalizeSpaces(lo.title) || "LO";
}

function barLabel(tag: DayTag, owner: Role) {
  if (tag === "FLIGHT") return owner;
  if (tag === "LO") return "LO";
  if (tag === "DO") return "DO";
  if (tag === "ATDO") return "ATDO";
  if (tag === "RESERVE") return "RESERVE";
  if (tag === "BLANK") return "BLANK";
  if (tag === "RDO") return "DO";
  if (tag === "RCRM") return "RCRM";
  if (tag === "JCRM") return "JCRM";
  if (tag === "EMER") return "EMER";
  if (tag === "HM_STBY") return "HM_STBY";
  if (tag === "AP_STBY") return "AP_STBY";
  if (tag === "OTHER") return "OTHER";
  return "";
}

function barStyle(tag: DayTag, owner: Role): CSSProperties {
  const base: CSSProperties = {
    boxSizing: "border-box",
    height: 18,
    borderRadius: 8,
    padding: "0 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid rgba(0,0,0,0.10)",
    color: "rgba(17,24,39,0.95)",
    textAlign: "center",
  };

  if (tag === "FLIGHT") {
    const c = owner === "HAN" ? "rgba(0,122,255,0.16)" : "rgba(239,68,68,0.16)";
    const b = owner === "HAN" ? "rgba(0,122,255,0.30)" : "rgba(239,68,68,0.30)";
    return { ...base, background: c, borderColor: b };
  }
  if (tag === "LO") {
    return { ...base, background: "rgba(14,165,233,0.16)", borderColor: "rgba(14,165,233,0.30)" };
  }
  if (tag === "RESERVE") {
    return { ...base, background: "rgba(245,158,11,0.16)", borderColor: "rgba(245,158,11,0.30)" };
  }
  if (tag === "BLANK") {
    return { ...base, background: "rgba(245,158,11,0.16)", borderColor: "rgba(245,158,11,0.30)" };
  }
  if (tag === "DO") {
    return { ...base, background: "rgba(34,197,94,0.14)", borderColor: "rgba(34,197,94,0.25)" };
  }
  if (tag === "ATDO") {
    return { ...base, background: "rgba(100,116,139,0.14)", borderColor: "rgba(100,116,139,0.26)" };
  }
  if (tag === "HM_STBY" || tag === "AP_STBY") {
    return { ...base, background: "rgba(236,72,153,0.14)", borderColor: "rgba(236,72,153,0.28)" };
  }
  if (tag === "RCRM" || tag === "JCRM" || tag === "EMER") {
    return { ...base, background: "rgba(251,113,133,0.12)", borderColor: "rgba(251,113,133,0.25)" };
  }
  if (tag === "OTHER") {
    return { ...base, background: "rgba(161,161,170,0.14)", borderColor: "rgba(161,161,170,0.26)" };
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
    case "RESERVE":
    case "BLANK":
      return {
        background: "rgba(245,158,11,0.14)",
        border: "1px solid rgba(245,158,11,0.25)",
      };
    case "HM_STBY":
    case "AP_STBY":
      return {
        background: "rgba(236,72,153,0.12)",
        border: "1px solid rgba(236,72,153,0.22)",
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
  return owner === "HAN" ? "rgba(0,122,255,0.16)" : "rgba(239,68,68,0.22)";
}

function mergeAndSaveImportedEvents(imported: EventItem[], owner: Role) {
  const existing = loadEvents();

  const normalizedImported: EventItem[] = imported.map((e) => ({
    ...e,
    owner,
  }));

  const all = [...existing, ...normalizedImported];

  const seen = new Set<string>();
  const dedup: EventItem[] = [];

  for (const e of all) {
    const sig = `${(e as any).owner}|${e.title}|${e.start}|${e.end}|${String((e as any).kind ?? "")}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    dedup.push(e);
  }

  saveEvents(dedup);
}

function FlightChip({ owner, e }: { owner: Role; e: EventItem }) {
  const parsed = parseFlightChip(e.title);
  const flightNo = parsed.flightNo || "";
  const route = parsed.route || normalizeSpaces(e.title);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "4px 1fr",
        borderRadius: 10,
        overflow: "hidden",
        border: `1px solid ${ownerChipBorder(owner)}`,
        background: ownerChipBG(owner),
        minHeight: 34,
      }}
      title={`${e.title}\n${fmtHMFromISO(e.start)} ~ ${fmtHMFromISO(e.end)}`}
    >
      <div style={{ background: ownerColor(owner) }} />
      <div
        style={{
          padding: "3px 6px",
          display: "grid",
          gap: 1,
          alignContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            fontSize: 10,
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
            fontSize: 10,
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
    </div>
  );
}

function StatusChip({ e }: { e: EventItem }) {
  const kind = getKind(e);

  const label =
    kind === "LO"
      ? getDisplayTitle(e)
      : kind === "ATDO"
        ? "ATDO"
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
                      ? "HM_STBY"
                      : kind === "AP_STBY"
                        ? "AP_STBY"
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

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (const d of monthDays) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weekCount = Math.ceil(cells.length / 7);

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
    for (const d of monthDays) {
      const { minutes } = overlapMinutesForDay(hanDutyEvents, kyuDutyEvents, d);
      map.set(ymd(d), minutes);
    }
    return map;
  }, [hanDutyEvents, kyuDutyEvents, monthDays]);

  const overlapRuns = useMemo(() => {
    const runs: { start: Date; end: Date; dayCount: number; totalMinutes: number }[] = [];
    const oneDay = 24 * 60 * 60 * 1000;

    let curStart: Date | null = null;
    let curEnd: Date | null = null;
    let curCount = 0;

    for (const d of monthDays) {
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
  }, [monthDays, minutesByDayKey]);

  const { placedBars, maxLaneByWeek } = useMemo(() => {
    const segs: BarSeg[] = [];

    const hanRuns = buildRunsByDayKey(monthDays, (d) => {
      const tag = dayTagFor(visHanEvents, d);
      const label = tag === "FLIGHT" ? flightBarLabelForDay("HAN", visHanEvents, d) : barLabel(tag, "HAN");
      return { tag, label };
    });

    const kyuRuns = buildRunsByDayKey(monthDays, (d) => {
      const tag = dayTagFor(visKyuEvents, d);
      const label = tag === "FLIGHT" ? flightBarLabelForDay("KYU", visKyuEvents, d) : barLabel(tag, "KYU");
      return { tag, label };
    });

    const pushRun = (owner: Role, tag: DayTag, start: Date, end: Date) => {
      if (tag === "NONE") return;

      let label = barLabel(tag, owner);

      if (tag === "LO") {
        label = owner === "HAN" ? loLabelForDay(visHanEvents, start) : loLabelForDay(visKyuEvents, start);
      } else if (tag === "FLIGHT") {
        label = owner === "HAN"
          ? flightBarLabelForDay("HAN", visHanEvents, start)
          : flightBarLabelForDay("KYU", visKyuEvents, start);
      }

      for (const s of splitRunIntoWeekBars(start, end, month)) {
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
        for (const s of splitRunIntoWeekBars(r.start, r.end, month)) {
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
  }, [monthDays, month, visHanEvents, visKyuEvents, overlapRuns, compareOn]);

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

  const modalHan = selectedDay ? listForDay(visHanEvents, selectedDay) : [];
  const modalKyu = selectedDay ? listForDay(visKyuEvents, selectedDay) : [];
  const modalOverlap = selectedDay
    ? overlapForDay(visHanDutyEvents, visKyuDutyEvents, selectedDay)
    : { intervals: [], minutes: 0 };

  function exportAll() {
    exportICS(events, `twocrew-all-${monthLabel(month)}.ics`);
  }

  function exportHan() {
    exportICS(hanEvents, `twocrew-han-${monthLabel(month)}.ics`);
  }

  function exportKyu() {
    exportICS(kyuEvents, `twocrew-kyu-${monthLabel(month)}.ics`);
  }

  const todayKey = ymd(new Date());

  return (
    <div style={{ padding: 12, maxWidth: 980, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>캘린더</h2>
          <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>현재 사용자: {meName}</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={prevMonth} style={btnStyle}>이전달</button>
          <div style={{ fontWeight: 900, fontSize: 16, minWidth: 80, textAlign: "center" }}>
            {monthLabel(month)}
          </div>
          <button onClick={nextMonth} style={btnStyle}>다음달</button>

          <button onClick={exportAll} style={btnStyle}>ICS(전체)</button>
          <button onClick={exportHan} style={btnStyle}>ICS(HAN)</button>
          <button onClick={exportKyu} style={btnStyle}>ICS(KYU)</button>

          <button onClick={() => navigate("/stats")} style={btnStyle}>통계</button>
          <button onClick={() => navigate("/week")} style={btnStyle}>Week</button>

          <label style={toggleStyle}>
            <input
              type="checkbox"
              checked={showHanToggle}
              onChange={() => setShowHanToggle((v) => !v)}
            />
            HAN
          </label>

          <label style={toggleStyle}>
            <input
              type="checkbox"
              checked={showKyuToggle}
              onChange={() => setShowKyuToggle((v) => !v)}
            />
            KYU
          </label>

          <button onClick={() => setCompareOn((v) => !v)} style={btnStyle}>
            Compare {compareOn ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 12,
          overflow: "hidden",
          background: "white",
        }}
      >
        {weekDays.map((d, i) => (
          <div
            key={d}
            style={{
              fontSize: 13,
              opacity: 0.75,
              padding: "8px 10px",
              borderRight: i === 6 ? "none" : "1px solid rgba(0,0,0,0.06)",
              background: "rgba(0,0,0,0.02)",
              fontWeight: 800,
              textAlign: "center",
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
          const weekBars = placedBars.filter((b) => b.week === w);
          const laneCount = Math.min(6, Math.max(0, maxLaneByWeek[w] ?? 0));

          return (
            <div
              key={w}
              style={{
                position: "relative",
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 12,
                overflow: "hidden",
                background: "white",
              }}
            >
              {/* Date row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {weekCells.map((day, idx) => {
                  const empty = !day;
                  const isToday = day ? ymd(day) === todayKey : false;

                  return (
                    <div
                      key={idx}
                      style={{
                        minHeight: 30,
                        padding: "6px 8px",
                        cursor: day ? "pointer" : "default",
                        background: empty ? "rgba(0,0,0,0.03)" : "white",
                        borderRight: idx === 6 ? "none" : "1px solid rgba(0,0,0,0.06)",
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
                          fontWeight: 900,
                          fontSize: 12,
                          background: isToday ? "rgba(17,24,39,0.95)" : "transparent",
                          color: isToday ? "white" : empty ? "rgba(0,0,0,0.25)" : "rgba(17,24,39,0.90)",
                        }}
                      >
                        {day ? day.getDate() : ""}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bars layer */}
              {laneCount > 0 && (
                <div
                  style={{
                    position: "relative",
                    height: laneCount * 22 + 8,
                    padding: "2px 6px 6px 6px",
                    borderTop: "1px solid rgba(0,0,0,0.04)",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  {weekBars.map((b) => {
                    const top = b.lane * 22 + 2;
                    const style =
                      b.id.startsWith("OVL-")
                        ? ({
                            ...barStyle("OTHER", "HAN"),
                            background: "rgba(255,59,48,0.16)",
                            borderColor: "rgba(255,59,48,0.30)",
                          } as CSSProperties)
                        : barStyle(b.tag, b.owner);

                    return (
                      <div
                        key={b.id}
                        style={{
                          position: "absolute",
                          left: `${b.left}%`,
                          width: `calc(${b.width}% - 2px)`,
                          top,
                          ...style,
                        }}
                        title={b.label}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{b.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cell content row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  borderTop: laneCount > 0 ? "none" : "1px solid rgba(0,0,0,0.06)",
                }}
              >
                {weekCells.map((day, idx) => {
                  if (!day) {
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: 8,
                          minHeight: 170,
                          background: "rgba(0,0,0,0.03)",
                          borderRight: idx === 6 ? "none" : "1px solid rgba(0,0,0,0.06)",
                        }}
                      />
                    );
                  }

                  const hanAll = listForDay(visHanEvents, day);
                  const kyuAll = listForDay(visKyuEvents, day);

                  const hanStatus = getStatusEventForDay(hanAll);
                  const kyuStatus = getStatusEventForDay(kyuAll);

                  const hanLegs = hanAll.filter((e) => getKind(e) === "FLIGHT").slice(0, 1);
                  const kyuLegs = kyuAll.filter((e) => getKind(e) === "FLIGHT").slice(0, 1);

                  const extra =
                    Math.max(0, hanAll.filter((e) => getKind(e) === "FLIGHT").length - hanLegs.length) +
                    Math.max(0, kyuAll.filter((e) => getKind(e) === "FLIGHT").length - kyuLegs.length);

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => openDay(day)}
                      role="button"
                      style={{
                        padding: 8,
                        minHeight: 170,
                        background: "white",
                        cursor: "pointer",
                        borderRight: idx === 6 ? "none" : "1px solid rgba(0,0,0,0.06)",
                        display: "grid",
                        gridTemplateRows: "18px 24px 40px 40px 24px 16px",
                        alignContent: "start",
                      }}
                      title="클릭해서 상세보기"
                    >
                      {/* HAN STATUS */}
                      <div style={{ minHeight: 24, marginBottom: 8 }}>
                        {hanStatus ? <StatusChip e={hanStatus} /> : null}
                      </div>

                      {/* HAN FLIGHT */}
                      <div style={{ minHeight: 40, marginBottom: 8 }}>
                        {hanLegs.length > 0
                          ? hanLegs.map((e) => <FlightChip key={e.id} owner="HAN" e={e} />)
                          : null}
                      </div>

                      {/* KYU FLIGHT */}
                      <div style={{ minHeight: 40, marginBottom: 6 }}>
                        {kyuLegs.length > 0
                          ? kyuLegs.map((e) => <FlightChip key={e.id} owner="KYU" e={e} />)
                          : null}
                      </div>

                      {/* KYU STATUS */}
                      <div style={{ minHeight: 24, marginTop: 6, paddingBottom: 4 }}>
                        {kyuStatus ? <StatusChip e={kyuStatus} /> : null}
                      </div>

                      {/* MORE */}
                      <div
                        style={{
                          minHeight: 16,
                          fontSize: 10,
                          opacity: 0.55,
                          lineHeight: 1.2,
                          paddingTop: 2,
                        }}
                      >
                        {extra > 0 ? `+${extra} more` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && selectedDay && (
        <div
          onClick={closeDay}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
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
              background: "white",
              borderRadius: 16,
              padding: 16,
              border: "1px solid rgba(0,0,0,0.12)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{ymd(selectedDay)}</div>
              <button onClick={closeDay} style={modalCloseBtn}>닫기</button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
              <Section title="HAN" color={sectionTitleColor("HAN")} items={modalHan} />
              <Section title="KYU" color={sectionTitleColor("KYU")} items={modalKyu} />

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

function Section({ title, color, items }: { title: string; color: string; items: EventItem[] }) {
  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: 12 }}>
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
  padding: "8px 10px",
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