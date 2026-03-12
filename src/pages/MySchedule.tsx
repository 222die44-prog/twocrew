import { useMemo, useState } from "react";
import { addEvent, deleteEvent, getRole, loadEvents } from "../services/schedule";
import type { EventItem } from "../services/schedule";

export default function MySchedule() {
  const role = useMemo(() => getRole(), []);
  const meName = role === "HAN" ? "계성한" : "안규영";

  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [events, setEvents] = useState<EventItem[]>(() => loadEvents());

  function refresh() {
    setEvents(loadEvents());
  }

  function handleAdd() {
    if (!title || !start || !end) {
      alert("제목/시작/종료를 모두 입력해줘");
      return;
    }
    if (new Date(start) >= new Date(end)) {
      alert("종료 시간이 시작 시간보다 늦어야 해");
      return;
    }

    addEvent({
      id: Date.now().toString(),
      owner: role,
      title,
      start,
      end,
    });

    setTitle("");
    setStart("");
    setEnd("");
    refresh();
  }

  function handleDelete(id: string) {
    if (!confirm("이 일정을 삭제할까?")) return;
    deleteEvent(id);
    refresh();
  }

  const myEvents = events
    .filter((e) => e.owner === role)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div style={{ padding: 20, maxWidth: 560, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 6 }}>내 스케줄 입력</h2>
      <div style={{ opacity: 0.75, marginBottom: 16 }}>
        현재 사용자: {meName}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="예: KE721 ICN-KIX / OFF / DUTY"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>
          시작
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          종료
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={inputStyle}
          />
        </label>

        <button onClick={handleAdd} style={btnStyle}>
          저장
        </button>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h3 style={{ marginBottom: 10 }}>내 일정 목록</h3>

      {myEvents.length === 0 ? (
        <div style={{ opacity: 0.7 }}>아직 일정이 없어.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {myEvents.map((e) => (
            <div key={e.id} style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 800 }}>{e.title}</div>
                <button onClick={() => handleDelete(e.id)} style={delBtnStyle}>
                  삭제
                </button>
              </div>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
                {e.start} ~ {e.end}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.14)",
  fontSize: 15,
};

const btnStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(0,0,0,0.14)",
  background: "white",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
};

const delBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.14)",
  background: "white",
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  opacity: 0.8,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  padding: 12,
};
