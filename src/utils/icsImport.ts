// src/utils/icsImport.ts
import ICAL from "ical.js";
import type { EventItem } from "../services/schedule";

type Role = "HAN" | "KYU";

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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIsoLikeKST(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:00`;
}

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function inferKind(title: string): Kind {
  const t = normalizeSpaces(title).toUpperCase();

  if (/\b[A-Z]{1,3}\d{2,4}\b/.test(t)) return "FLIGHT";
  if (t === "LO" || t.startsWith("LO ")) return "LO";
  if (t === "DO" || t.startsWith("DO ")) return "DO";
  if (t === "ATDO" || t.startsWith("ATDO ")) return "ATDO";
  if (t === "RESERVE" || t.startsWith("RESERVE ")) return "RESERVE";
  if (t === "BLANK" || t.startsWith("BLANK ")) return "BLANK";
  if (t === "RDO" || t.startsWith("RDO ")) return "RDO";
  if (t === "ALM" || t.startsWith("ALM ")) return "ALM";
  if (t === "ALV" || t.startsWith("ALV ")) return "ALV";
  if (t === "HM_STBY" || t.startsWith("HM_STBY ")) return "HM_STBY";
  if (t === "AP_STBY" || t.startsWith("AP_STBY ")) return "AP_STBY";
  if (t === "RCRM" || t.startsWith("RCRM ")) return "RCRM";
  if (t === "JCRM" || t.startsWith("JCRM ")) return "JCRM";
  if (t === "EMER" || t.startsWith("EMER ")) return "EMER";

  return "OTHER";
}

export function parseIcsToEvents(icsText: string, owner: Role): EventItem[] {
  const jcal = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent");

  const events: EventItem[] = vevents.map((vevent, idx) => {
    const ev = new ICAL.Event(vevent);

    const summary = normalizeSpaces(ev.summary || "UNTITLED");
    const startDate = ev.startDate?.toJSDate?.() ?? new Date();
    const endDate = ev.endDate?.toJSDate?.() ?? new Date(startDate.getTime() + 60 * 60 * 1000);

    return {
      id: crypto.randomUUID?.() ?? `${owner}-${Date.now()}-${idx}`,
      owner,
      title: summary,
      start: toIsoLikeKST(startDate),
      end: toIsoLikeKST(endDate),
      kind: inferKind(summary),
      allDay: vevent.hasProperty("dtstart") && String(vevent.getFirstPropertyValue("dtstart")).includes("VALUE=DATE")
        ? true
        : undefined,
    } as EventItem;
  });

  return events;
}