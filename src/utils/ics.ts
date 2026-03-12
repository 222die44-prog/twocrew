import type { EventItem } from "../services/schedule";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function yyyymmdd(d: Date) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}
function yyyymmddThhmmss(d: Date) {
  return `${yyyymmdd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function esc(s: string) {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function isAllDay(e: EventItem) {
  const k = (e as any).kind as string | undefined;
  return (e as any).allDay === true || k === "DO" || k === "ALM" || k === "RESERVE";
}

function displayTitle(e: EventItem) {
  const k = (e as any).kind as string | undefined;
  if (k === "ALM") return `${e.owner} 연차`;
  if (k === "DO") return `${e.owner} 휴무`;
  if (k === "RESERVE") return `${e.owner} 대기`;
  if (k === "LO") return `${e.owner} LO`;
  return `${e.owner} ${e.title}`;
}

export function exportICS(events: EventItem[], fileName = "twocrew.ics") {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//TwoCrew//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push("X-WR-TIMEZONE:Asia/Seoul");

  const dtstamp = yyyymmddThhmmss(new Date());

  for (const e of events) {
    const s = new Date(e.start);
    const en = new Date(e.end);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${esc(e.id)}@twocrew`);
    lines.push(`DTSTAMP;TZID=Asia/Seoul:${dtstamp}`);
    lines.push(`SUMMARY:${esc(displayTitle(e))}`);

    if (isAllDay(e)) {
      const ds = yyyymmdd(s);
      const de = yyyymmdd(addDays(s, 1));
      lines.push(`DTSTART;VALUE=DATE:${ds}`);
      lines.push(`DTEND;VALUE=DATE:${de}`);
    } else {
      lines.push(`DTSTART;TZID=Asia/Seoul:${yyyymmddThhmmss(s)}`);
      lines.push(`DTEND;TZID=Asia/Seoul:${yyyymmddThhmmss(en)}`);
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}