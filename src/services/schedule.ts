export type Role = "HAN" | "KYU";

export type Kind =
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

export type EventItem = {
  id: string;
  owner: Role;
  start: string;
  end: string;
  title: string;

  /** ✅ 이제 정식 필드 */
  kind?: Kind;

  /** all-day 여부 */
  allDay?: boolean;
};

const KEY = "twocrew_events";
const ROLE_KEY = "twocrew_role";

/* ---------------- 저장 / 불러오기 ---------------- */

export function loadEvents(): EventItem[] {
  const raw = localStorage.getItem(KEY);
  try {
    return raw ? (JSON.parse(raw) as EventItem[]) : [];
  } catch {
    return [];
  }
}

export function saveEvents(events: EventItem[]) {
  localStorage.setItem(KEY, JSON.stringify(events));
}

export function addEvent(event: EventItem) {
  const events = loadEvents();
  events.push(event);
  saveEvents(events);
}

/* ---------------- 삭제 ---------------- */

export function deleteEvent(id: string) {
  const events = loadEvents();
  saveEvents(events.filter((e) => e.id !== id));
}

/* ---------------- 사용자 선택 ---------------- */

export function setRole(role: Role) {
  localStorage.setItem(ROLE_KEY, role);
}

export function getRole(): Role {
  const v = localStorage.getItem(ROLE_KEY);
  return v === "KYU" ? "KYU" : "HAN";
}

export function repairStoredEventsOnce() {
  const raw = localStorage.getItem("twocrew_events");
  if (!raw) return;

  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;

    const fixed = arr.map((e: any) => ({
      ...e,
      // 예전 데이터가 owner 없으면 기본값
      owner: e.owner === "KYU" ? "KYU" : "HAN",
    }));

    localStorage.setItem("twocrew_events", JSON.stringify(fixed));
  } catch {
    // ignore
  }
}