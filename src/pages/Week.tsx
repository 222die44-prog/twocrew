import { useMemo, useState } from "react";
import { loadEvents } from "../services/schedule";

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const events = useMemo(() => loadEvents(), []);

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div style={{ padding: 20 }}>
      <h2>Weekly Calendar</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
        {days.map((d, i) => (
          <div key={i} style={{ border: "1px solid #ddd", padding: 10 }}>
            {d.toDateString()}
          </div>
        ))}
      </div>
    </div>
  );
}