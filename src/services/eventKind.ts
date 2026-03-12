import type { EventItem } from "./schedule";

export type Kind =
  | "FLIGHT"
  | "LO"
  | "DO"
  | "ATDO"
  | "RESERVE"
  | "RDO"
  | "ALM"
  | "ALV"
  | "HM_STBY"
  | "AP_STBY"
  | "RCRM"
  | "JCRM"
  | "EMER"
  | "BLANK"
  | "OTHER";

function norm(s: string) {
  return s.replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * 🔥 모든 페이지가 이것만 사용해야 함
 */
export function getEventKind(e: EventItem): Kind {
  const rawKind = ((e as any).kind as string | undefined)?.toUpperCase().trim();
  const title = norm(String(e.title ?? ""));

  // 1️⃣ kind 값이 이미 있으면 신뢰
  if (rawKind) {
    if (rawKind === "FLIGHT") return "FLIGHT";
    if (rawKind === "LO") return "LO";
    if (rawKind === "DO") return "DO";
    if (rawKind === "ATDO") return "ATDO";
    if (rawKind === "RESERVE") return "RESERVE";
    if (rawKind === "RDO") return "RDO";
    if (rawKind === "ALM") return "ALM";
    if (rawKind === "ALV") return "ALV";
    if (rawKind === "HM_STBY") return "HM_STBY";
    if (rawKind === "AP_STBY") return "AP_STBY";
    if (rawKind === "RCRM") return "RCRM";
    if (rawKind === "JCRM") return "JCRM";
    if (rawKind === "EMER") return "EMER";
    if (rawKind === "BLANK") return "BLANK";
  }

  // 2️⃣ title 기반 fallback (KYU PDF 대응 핵심)
  if (title === "LO") return "LO";
  if (title === "DO") return "DO";
  if (title === "ATDO") return "ATDO";
  if (title === "RESERVE") return "RESERVE";
  if (title === "RDO") return "RDO";
  if (title === "ALM") return "ALM";
  if (title === "ALV") return "ALV";
  if (title === "BLANK") return "BLANK";

  // 편명 패턴이면 비행으로 판단
  if (/^[A-Z]{2}\d{3,4}/.test(title)) return "FLIGHT";

  return "OTHER";
}

/** 비행 여부 */
export function isFlightEvent(e: EventItem) {
  return getEventKind(e) === "FLIGHT";
}