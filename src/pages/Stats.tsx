// src/pages/Stats.tsx
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { loadEvents } from "../services/schedule";
import type { EventItem } from "../services/schedule";

/* ============ utils ============ */
type Role = "HAN" | "KYU";
type Kind =
  | "FLIGHT"
  | "LO"
  | "DO"
  | "ATDO"
  | "RESERVE"
  |  "BLANK"
  | "RDO"
  | "ALM"
  | "ALV"
  | "HM_STBY"
  | "AP_STBY"
  | "RCRM"
  | "JCRM"
  | "EMER"
  | "OTHER";

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
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function minutesBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function getKind(e: EventItem): Kind {
  const rawK = ((e as any).kind as string | undefined)?.toUpperCase().trim();
  const t = normalizeSpaces(String(e.title ?? "")).toUpperCase();

  // 1) kind 우선
  if (rawK) {
    if (rawK === "FLIGHT") return "FLIGHT";
    if (rawK === "LO") return "LO";
    if (rawK === "DO") return "DO";
    if (rawK === "ATDO") return "ATDO";
    if (rawK === "RESERVE") return "RESERVE";
    if (rawK === "RDO") return "RDO";
    if (rawK === "ALM") return "ALM";
    if (rawK === "ALV") return "ALV";
    if (rawK === "HM_STBY") return "HM_STBY";
    if (rawK === "AP_STBY") return "AP_STBY";
    if (rawK === "RCRM") return "RCRM";
    if (rawK === "JCRM") return "JCRM";
    if (rawK === "EMER") return "EMER";
    if (rawK === "BLANK") return "BLANK";
  }

  // 2) title로 판정 (KYU LO/ATDO/DO/RESERVE 해결)
  const t0 = t.split(" ")[0];      // "LO", "ATDO" 같은 첫 토큰
  const tClean = t.replace(/\(.*?\)/g, "").trim(); // "LO (TAE)" -> "LO"

  if (tClean === "LO" || t0 === "LO") return "LO";
  if (tClean === "DO" || t0 === "DO") return "DO";
  if (tClean === "ATDO" || t0 === "ATDO") return "ATDO";
  if (tClean === "RESERVE" || t0 === "RESERVE") return "RESERVE";
  if (tClean === "RDO" || t0 === "RDO") return "RDO";
  if (tClean === "ALM" || t0 === "ALM") return "ALM";
  if (tClean === "ALV" || t0 === "ALV") return "ALV";
  if (tClean === "BLANK" || t0 === "BLANK") return "BLANK";

  return "OTHER";
}

// ✅ 통계에서 “비행시간”은 FLIGHT만 합산
function isFlight(e: EventItem) {
  return getKind(e) === "FLIGHT";
}

// ✅ day cover (end exclusive)
function eventCoversDay(e: EventItem, day: Date) {
  const s = parseISO(e.start);
  const en = parseISO(e.end);
  const dayS = startOfDay(day);
  const dayE = endOfDay(day);
  return s <= dayE && en > dayS;
}

// ✅ 하루에 겹치는 시간(오버랩) 계산용
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
function overlapMinutesForDay(han: EventItem[], kyu: EventItem[], day: Date) {
  const hanInts = mergeIntervals(
    han.filter(isFlight).map((e) => clampIntervalToDay(e, day)).filter(Boolean) as [Date, Date][]
  );
  const kyuInts = mergeIntervals(
    kyu.filter(isFlight).map((e) => clampIntervalToDay(e, day)).filter(Boolean) as [Date, Date][]
  );

  const overlaps: [Date, Date][] = [];
  for (const h of hanInts) {
    for (const k of kyuInts) {
      const inter = intersectIntervals(h, k);
      if (inter) overlaps.push(inter);
    }
  }
  return totalMinutes(mergeIntervals(overlaps));
}

function fmtHours(min: number) {
  const h = min / 60;
  return `${h.toFixed(1)}h`;
}

/* ============ page ============ */
export default function StatsPage() {
  const nav = useNavigate();
  const [month, setMonth] = useState(() => new Date());

  const events = useMemo(() => loadEvents(), []);

  const hanEvents = useMemo(() => events.filter((e) => (e as any).owner === "HAN"), [events]);
  const kyuEvents = useMemo(() => events.filter((e) => (e as any).owner === "KYU"), [events]);

  const monthDays = useMemo(() => {
    const total = daysInMonth(month);
    const out: Date[] = [];
    for (let d = 1; d <= total; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    return out;
  }, [month]);

  const inMonth = (list: EventItem[]) =>
    list.filter((e) => {
      // “해당 월에 하루라도 걸리면 포함” (day cover 기준)
      return monthDays.some((d) => eventCoversDay(e, d));
    });

  const hanM = useMemo(() => inMonth(hanEvents), [hanEvents, monthDays]);
  const kyuM = useMemo(() => inMonth(kyuEvents), [kyuEvents, monthDays]);

  const calc = (owner: Role, list: EventItem[]) => {
    const flights = list.filter(isFlight);
    const flightMinutes = flights.reduce((sum, e) => sum + minutesBetween(parseISO(e.start), parseISO(e.end)), 0);

    // legs = flight event 개수
    const legs = flights.length;

    // day counts by kind (대표 이벤트 기준 X, “해당 kind가 하루에 존재하면 1”로 카운트)
    const dayHas = (kind: Kind) =>
      monthDays.filter((d) => list.some((e) => getKind(e) === kind && eventCoversDay(e, d))).length;

    const loDays = dayHas("LO");
    const doDays = dayHas("DO");
    const atdoDays = dayHas("ATDO");
    const reserveDays = dayHas("RESERVE");
    const blankDays = monthDays.filter((d) => !list.some((e) => eventCoversDay(e, d))).length;
    const rdoDays = dayHas("RDO");
    const almDays = dayHas("ALM");
    const alvDays = dayHas("ALV");
    const stbyDays = dayHas("HM_STBY") + dayHas("AP_STBY");
    const crmDays = dayHas("RCRM") + dayHas("JCRM") + dayHas("EMER");

    // flight days = 비행이 하루라도 있으면 1
    const flightDays = monthDays.filter((d) => flights.some((e) => eventCoversDay(e, d))).length;

    return {
      owner,
      flightMinutes,
      legs,
      flightDays,
      loDays,
      doDays,
      atdoDays,
      reserveDays,
      rdoDays,
      almDays,
      alvDays,
      stbyDays,
      crmDays,
      blankDays,
    };
  };

  const hanStat = useMemo(() => calc("HAN", hanM), [hanM, monthDays]);
  const kyuStat = useMemo(() => calc("KYU", kyuM), [kyuM, monthDays]);

  const overlapTotalMin = useMemo(() => {
    let tot = 0;
    for (const d of monthDays) tot += overlapMinutesForDay(hanM, kyuM, d);
    return tot;
  }, [hanM, kyuM, monthDays]);

  function prevMonth() {
    setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  }
  function nextMonth() {
    setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  }

  return (
    <div style={{ padding: 12, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>월간 통계</h2>
          <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>대상 월: {monthLabel(month)}</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => nav("/cal")} style={btnStyle}>캘린더</button>
          <button onClick={prevMonth} style={btnStyle}>이전달</button>
          <div style={{ fontWeight: 900, fontSize: 16, minWidth: 80, textAlign: "center" }}>{monthLabel(month)}</div>
          <button onClick={nextMonth} style={btnStyle}>다음달</button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard title="HAN" color="rgba(0,122,255,0.95)" stat={hanStat} />
        <StatCard title="KYU" color="rgba(245,158,11,0.95)" stat={kyuStat} />
      </div>

      <div style={{ marginTop: 10, border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: 12, background: "white" }}>
        <div style={{ fontWeight: 900, color: "rgba(255,59,48,0.92)", marginBottom: 6 }}>Overlap (월 합계)</div>
        <div style={{ fontSize: 13, fontWeight: 900 }}>{fmtHours(overlapTotalMin)} ({overlapTotalMin}분)</div>
        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
          * FLIGHT 기준으로만 계산 (두 사람 비행 시간이 겹치는 구간)
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, color, stat }: { title: string; color: string; stat: any }) {
  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: 12, background: "white" }}>
      <div style={{ fontWeight: 900, color, marginBottom: 8 }}>{title}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Row k="Flight Hours" v={`${(stat.flightMinutes / 60).toFixed(1)}h`} />
        <Row k="Legs" v={`${stat.legs}`} />
        <Row k="Flight Days" v={`${stat.flightDays}`} />
        <Row k="LO Days" v={`${stat.loDays}`} />
        <Row k="DO Days" v={`${stat.doDays}`} />
        <Row k="ATDO Days" v={`${stat.atdoDays}`} />
        <Row k="RESERVE Days" v={`${stat.reserveDays}`} />
        <Row k="RDO Days" v={`${stat.rdoDays}`} />
        <Row k="ALM Days" v={`${stat.almDays}`} />
        <Row k="ALV Days" v={`${stat.alvDays}`} />
        <Row k="STBY Days" v={`${stat.stbyDays}`} />
        <Row k="CRM Days" v={`${stat.crmDays}`} />
        <Row k="BLANK Days" v={`${stat.blankDays}`} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, padding: "10px 10px" }}>
      <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 800 }}>{k}</div>
      <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2 }}>{v}</div>
    </div>
  );
}

const btnStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.14)",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 12,
};