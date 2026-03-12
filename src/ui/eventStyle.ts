import type { ScheduleEvent } from "@/types/schedule";

export function getKindLabel(ev: ScheduleEvent): string {
  switch (ev.kind) {
    case "ALM": return "연차";
    case "DO": return "휴무";
    case "RESERVE": return "대기";
    case "LO": return "LO";
    case "FLIGHT": return "비행";
    case "TRAINING": return "훈련";
    default: return ev.title;
  }
}

export function getKindClass(ev: ScheduleEvent): string {
  // Tailwind 기준 예시 (너희 스타일에 맞게 바꿔도 됨)
  switch (ev.kind) {
    case "ALM": return "bg-emerald-500/80 text-white";
    case "DO": return "bg-slate-300 text-slate-900";
    case "RESERVE": return "bg-amber-400/80 text-slate-900";
    case "LO": return "bg-sky-500/30 text-sky-900 border border-sky-500/60";
    case "FLIGHT": return "bg-indigo-500/80 text-white";
    default: return "bg-zinc-400/60 text-zinc-900";
  }
}