import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRole, loadEvents } from "../services/schedule";
import type { EventItem } from "../services/schedule";

type Role = "HAN" | "KYU";

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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfWeek(d: Date) {
  const copy = new Date(d);
  const diff = copy.getDay(); // 일=0
  copy.setDate(copy.getDate() - diff);
  return startOfDay(copy);
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function fmtDayLabel(d: Date) {
  const names = ["일", "월", "화", "수", "목", "금", "토"];
  return `${names[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtWeekRange(start: Date) {
  const end = addDays(start, 6);
  return `${start.getFullYear()}.${pad(start.getMonth() + 1)}.${pad(start.getDate())} - ${end.getFullYear()}.${pad(
    end.getMonth() + 1
  )}.${pad(end.getDate())}`;
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

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function eventCoversDay(e: EventItem, day: Date) {
  const s = new Date(e.start);
  const en = new Date(e.end);
  const dayS = startOfDay(day);
  const dayE = endOfDay(day);
  return s <= dayE && en > dayS;
}

function getKind(e: EventItem): Kind {
  const rawK = ((e as any).kind as string | undefined)?.toUpperCase().trim();
  const t = normalizeSpaces(String(e.title ?? "")).toUpperCase();

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
    if (rawK === "HM_STBY") return "HM_STBY";
    if (rawK === "AP_STBY") return "AP_STBY";
  }

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
  if (/^HM[ _-]?(STBY|SBY)\d*\b/.test(t)) return "HM_STBY";
  if (/^AP[ _-]?(STBY|SBY)\d*\b/.test(t)) return "AP_STBY";
  if (t.startsWith("RCRM")) return "RCRM";
  if (t.startsWith("JCRM")) return "JCRM";
  if (t.startsWith("EMER")) return "EMER";

  if (/\b[A-Z]{1,3}\d{2,4}\b/.test(t) && /\b[A-Z]{3}-[A-Z]{3}\b/.test(t)) {
    return "FLIGHT";
  }

  return "OTHER";
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
      return "HM STBY";
    case "AP_STBY":
      return "AP STBY";
    default:
      return normalizeSpaces(e.title);
  }
}

function parseFlightChip(title: string): { flightNo?: string; route?: string } {
  const t = normalizeSpaces(title).toUpperCase();
  const mNo = t.match(/\b[A-Z]{1,3}\d{2,4}\b/);
  const flightNo = mNo?.[0];

  const routeMatches = Array.from(t.matchAll(/\b([A-Z]{3}-[A-Z]{3})\b/g)).map((m) => m[1]);
  if (routeMatches.length > 0) {
    return { flightNo, route: routeMatches[routeMatches.length - 1] };
  }

  return { flightNo };
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

function minutesBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

function overlapMinutesForDay(aEvents: EventItem[], bEvents: EventItem[], day: Date) {
  const aFlights = aEvents.filter((e) => getKind(e) === "FLIGHT" && eventCoversDay(e, day));
  const bFlights = bEvents.filter((e) => getKind(e) === "FLIGHT" && eventCoversDay(e, day));

  if (aFlights.length === 0 || bFlights.length === 0) return 0;

  let total = 0;
  for (const a of aFlights) {
    for (const b of bFlights) {
      const s = new Date(Math.max(new Date(a.start).getTime(), new Date(b.start).getTime()));
      const e = new Date(Math.min(new Date(a.end).getTime(), new Date(b.end).getTime()));
      if (s < e) total += minutesBetween(s, e);
    }
  }
  return total;
}

function hasOffLike(list: EventItem[]) {
  return list.some((e) => {
    const k = getKind(e);
    return ["DO", "ATDO", "ADO", "YVC", "ALM", "ALV", "RDO", "BLANK"].includes(k);
  });
}

function meetLabel(han: EventItem[], kyu: EventItem[], day: Date) {
  const overlap = overlapMinutesForDay(han, kyu, day);
  const hanHasFlight = han.some((e) => getKind(e) === "FLIGHT");
  const kyuHasFlight = kyu.some((e) => getKind(e) === "FLIGHT");
  const hanOff = hasOffLike(han);
  const kyuOff = hasOffLike(kyu);

  if (hanOff && kyuOff) return { text: "둘 다 여유 있음", tone: "good" as const };
  if (!hanHasFlight && !kyuHasFlight) return { text: "일정 가벼움", tone: "good" as const };
  if (overlap > 0) return { text: `겹침 ${Math.round(overlap / 60)}h`, tone: "warn" as const };
  if (hanHasFlight && kyuHasFlight) return { text: "둘 다 운항", tone: "bad" as const };
  return { text: "Meet 가능성 있음", tone: "neutral" as const };
}

function itemTone(kind: Kind, owner: Role) {
  if (kind === "FLIGHT") {
    return owner === "HAN"
      ? {
          bg: "rgba(37,99,235,0.16)",
          border: "rgba(59,130,246,0.40)",
          text: "rgba(219,234,254,0.98)",
        }
      : {
          bg: "rgba(220,38,38,0.14)",
          border: "rgba(248,113,113,0.34)",
          text: "rgba(254,226,226,0.98)",
        };
  }

  if (kind === "LO") {
    return {
      bg: "rgba(14,165,233,0.16)",
      border: "rgba(56,189,248,0.34)",
      text: "rgba(224,242,254,0.98)",
    };
  }

  if (["DO", "ATDO", "ADO", "YVC", "ALM", "ALV", "RDO"].includes(kind)) {
    return {
      bg: "rgba(34,197,94,0.18)",
      border: "rgba(74,222,128,0.26)",
      text: "rgba(220,252,231,0.98)",
    };
  }

  if (["RESERVE", "BLANK", "HM_STBY", "AP_STBY"].includes(kind)) {
    return {
      bg: "rgba(245,158,11,0.16)",
      border: "rgba(251,191,36,0.30)",
      text: "rgba(254,243,199,0.98)",
    };
  }

  return {
    bg: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.22)",
    text: "rgba(241,245,249,0.92)",
  };
}

function ownerAccent(owner: Role) {
  return owner === "HAN" ? "rgba(59,130,246,0.95)" : "rgba(248,113,113,0.95)";
}

export default function WeekPage() {
  const navigate = useNavigate();
  const me = useMemo(() => getRole() as Role, []);
  const meName = me === "HAN" ? "계성한" : "안규영";

  const [weekBase, setWeekBase] = useState(() => startOfWeek(new Date()));
  const [showHan, setShowHan] = useState(true);
  const [showKyu, setShowKyu] = useState(true);
  const [meetOnly, setMeetOnly] = useState(false);

  const events = useMemo(() => loadEvents(), []);
  const hanEvents = useMemo(() => events.filter((e) => (e as any).owner === "HAN"), [events]);
  const kyuEvents = useMemo(() => events.filter((e) => (e as any).owner === "KYU"), [events]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekBase, i)), [weekBase]);

  const visibleDays = useMemo(() => {
    return days.filter((day) => {
      const han = listForDay(hanEvents, day);
      const kyu = listForDay(kyuEvents, day);
      const meet = meetLabel(han, kyu, day);
      return !meetOnly || meet.tone !== "bad";
    });
  }, [days, hanEvents, kyuEvents, meetOnly]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111827",
        color: "rgba(255,255,255,0.92)",
        padding: "16px 14px 28px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(180deg, rgba(30,41,59,0.88), rgba(15,23,42,0.96))",
            padding: "16px 16px 14px",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>TwoCrew Week</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 950, letterSpacing: -0.6 }}>
            {fmtWeekRange(weekBase)}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.78 }}>현재 사용자 · {meName}</div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "46px 1fr 46px",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button onClick={() => setWeekBase((d) => addDays(d, -7))} style={navBtn}>
            ‹
          </button>

          <div
            style={{
              height: 46,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(31,41,55,0.95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 15,
            }}
          >
            {fmtWeekRange(weekBase)}
          </div>

          <button onClick={() => setWeekBase((d) => addDays(d, 7))} style={navBtn}>
            ›
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          <button onClick={() => navigate("/cal")} style={actionBtn}>
            Month
          </button>
          <button onClick={() => setWeekBase(startOfWeek(new Date()))} style={actionBtn}>
            This Week
          </button>
          <button
            onClick={() => setMeetOnly((v) => !v)}
            style={{
              ...actionBtn,
              background: meetOnly ? "rgba(34,197,94,0.18)" : "rgba(31,41,55,0.95)",
              border: meetOnly ? "1px solid rgba(74,222,128,0.35)" : "1px solid rgba(255,255,255,0.10)",
            }}
          >
            Meet Only
          </button>
          <button onClick={() => navigate("/")} style={actionBtn}>
            Home
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <label
            style={{
              ...togglePill,
              background: showHan ? "rgba(30,64,175,0.22)" : "rgba(31,41,55,0.95)",
              border: showHan ? "1px solid rgba(59,130,246,0.34)" : "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <input type="checkbox" checked={showHan} onChange={() => setShowHan((v) => !v)} />
            HAN
          </label>

          <label
            style={{
              ...togglePill,
              background: showKyu ? "rgba(127,29,29,0.20)" : "rgba(31,41,55,0.95)",
              border: showKyu ? "1px solid rgba(248,113,113,0.30)" : "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <input type="checkbox" checked={showKyu} onChange={() => setShowKyu((v) => !v)} />
            KYU
          </label>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {visibleDays.map((day) => {
            const han = listForDay(hanEvents, day);
            const kyu = listForDay(kyuEvents, day);
            const meet = meetLabel(han, kyu, day);

            return (
              <div
                key={ymd(day)}
                style={{
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(17,24,39,0.96)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: 19, fontWeight: 900 }}>{fmtDayLabel(day)}</div>

                  <div
                    style={{
                      ...meetBadge(meet.tone),
                    }}
                  >
                    {meet.text}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: showHan && showKyu ? "1fr 1fr" : "1fr",
                    gap: 0,
                  }}
                >
                  {showHan ? (
                    <DayColumn owner="HAN" items={han} />
                  ) : null}

                  {showKyu ? (
                    <DayColumn owner="KYU" items={kyu} />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayColumn({ owner, items }: { owner: Role; items: EventItem[] }) {
  return (
    <div
      style={{
        padding: "14px 14px 16px",
        borderRight: owner === "HAN" ? "1px solid rgba(255,255,255,0.06)" : "none",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          color: ownerAccent(owner),
        }}
      >
        {owner}
      </div>

      {items.length === 0 ? (
        <div
          style={{
            borderRadius: 12,
            padding: "12px 12px",
            fontSize: 13,
            opacity: 0.72,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          일정 없음
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((e) => {
            const kind = getKind(e);
            const tone = itemTone(kind, owner);
            const parsed = kind === "FLIGHT" ? parseFlightChip(e.title) : null;
            const title = kind === "FLIGHT" ? parsed?.flightNo || "FLIGHT" : getDisplayTitle(e);
            const sub = kind === "FLIGHT" ? parsed?.route || normalizeSpaces(e.title) : normalizeSpaces(e.title);
            const time = isAllDayEvent(e) ? "All day" : `${fmtHMFromISO(e.start)} - ${fmtHMFromISO(e.end)}`;

            return (
              <div
                key={e.id}
                style={{
                  borderRadius: 14,
                  padding: "10px 12px",
                  background: tone.bg,
                  border: `1px solid ${tone.border}`,
                  color: tone.text,
                  display: "grid",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 900 }}>{title}</div>
                  <div style={{ fontSize: 12, opacity: 0.88, fontWeight: 800 }}>{time}</div>
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.95 }}>{sub}</div>

                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {e.start} ~ {e.end}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  height: 46,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(31,41,55,0.95)",
  color: "rgba(255,255,255,0.92)",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 20,
};

const actionBtn: React.CSSProperties = {
  height: 42,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(31,41,55,0.95)",
  color: "rgba(255,255,255,0.92)",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
};

const togglePill: React.CSSProperties = {
  height: 42,
  borderRadius: 14,
  color: "rgba(255,255,255,0.92)",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

function meetBadge(tone: "good" | "neutral" | "warn" | "bad"): React.CSSProperties {
  if (tone === "good") {
    return {
      padding: "7px 10px",
      borderRadius: 999,
      background: "rgba(34,197,94,0.18)",
      border: "1px solid rgba(74,222,128,0.26)",
      color: "rgba(220,252,231,0.96)",
      fontSize: 12,
      fontWeight: 900,
    };
  }

  if (tone === "warn") {
    return {
      padding: "7px 10px",
      borderRadius: 999,
      background: "rgba(245,158,11,0.16)",
      border: "1px solid rgba(251,191,36,0.24)",
      color: "rgba(254,243,199,0.96)",
      fontSize: 12,
      fontWeight: 900,
    };
  }

  if (tone === "bad") {
    return {
      padding: "7px 10px",
      borderRadius: 999,
      background: "rgba(239,68,68,0.14)",
      border: "1px solid rgba(248,113,113,0.24)",
      color: "rgba(254,226,226,0.96)",
      fontSize: 12,
      fontWeight: 900,
    };
  }

  return {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.12)",
    border: "1px solid rgba(148,163,184,0.20)",
    color: "rgba(226,232,240,0.96)",
    fontSize: 12,
    fontWeight: 900,
  };
}