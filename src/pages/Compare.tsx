import { loadEvents } from "../services/schedule";

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  const start = new Date(Math.max(aStart.getTime(), bStart.getTime()));
  const end = new Date(Math.min(aEnd.getTime(), bEnd.getTime()));
  return start < end ? { start, end } : null;
}

// 겹치는 구간들을 정렬 후, 서로 겹치거나(또는 붙어있으면) 하나로 합침
function mergeRanges(ranges: { start: Date; end: Date }[]) {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  const merged: { start: Date; end: Date }[] = [];
  let cur = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    // next.start <= cur.end 이면 겹치거나 바로 이어지는 구간 → 합치기
    if (next.start.getTime() <= cur.end.getTime()) {
      if (next.end.getTime() > cur.end.getTime()) cur.end = next.end;
    } else {
      merged.push(cur);
      cur = { ...next };
    }
  }

  merged.push(cur);
  return merged;
}

export default function Compare() {
  const events = loadEvents();

  const han = events.filter((e) => e.owner === "HAN");
  const kyu = events.filter((e) => e.owner === "KYU");

  const rawOverlaps: { start: Date; end: Date }[] = [];

  han.forEach((h) => {
    kyu.forEach((k) => {
      const o = overlap(
        new Date(h.start),
        new Date(h.end),
        new Date(k.start),
        new Date(k.end)
      );
      if (o) rawOverlaps.push(o);
    });
  });

  const overlaps = mergeRanges(rawOverlaps);

  return (
    <div style={{ padding: 20 }}>
      <h2>겹치는 시간</h2>

      {overlaps.length === 0 ? (
        <div>겹치는 일정 없음</div>
      ) : (
        overlaps.map((o, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            {o.start.toLocaleString()} ~ {o.end.toLocaleString()}
          </div>
        ))
      )}

      {rawOverlaps.length !== overlaps.length && (
        <div style={{ marginTop: 14, opacity: 0.7, fontSize: 13 }}>
          (중복/연속 구간을 합쳐서 {rawOverlaps.length}개 → {overlaps.length}
          개로 정리했어)
        </div>
      )}
    </div>
  );
}
