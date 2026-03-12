import type { RosterKind } from "@/types/schedule";

export function detectKind(text: string): RosterKind {
  const t = (text || "").trim().toUpperCase();

  if (t.startsWith("DO")) return "DO";
  if (t.startsWith("RESERVE")) return "RESERVE";
  if (t.startsWith("ALM")) return "ALM";
  if (t.startsWith("LO")) return "LO";

  // 편명 패턴 예: KE721, KE1401 등
  if (/^KE\d{2,4}\b/.test(t)) return "FLIGHT";

  // 훈련/교육 키워드가 있으면 추가로 확장 가능
  if (/(SIM|REC|GND|TRAIN)/.test(t)) return "TRAINING";

  return "OTHER";
}

export function isAllDayByKind(kind: RosterKind): boolean {
  return kind === "DO" || kind === "RESERVE" || kind === "ALM";
}