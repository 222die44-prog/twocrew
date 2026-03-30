import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111827",
        color: "white",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "20px 16px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: -1,
            lineHeight: 1.05,
          }}
        >
          TwoCrew
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 14,
            opacity: 0.72,
            lineHeight: 1.5,
          }}
        >
          두 명의 스케줄을 빠르게 확인하세요
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <MenuButton
          emoji="📅"
          title="Calendar"
          subtitle="월간 캘린더 보기"
          onClick={() => navigate("/cal")}
        />

        <MenuButton
          emoji="🗓"
          title="Week"
          subtitle="주간 상세 보기"
          onClick={() => navigate("/week")}
        />

        <MenuButton
          emoji="🤝"
          title="Meet Day"
          subtitle="함께 가능한 날 보기"
          onClick={() => navigate("/meet")}
        />
      </div>
    </div>
  );
}

function MenuButton({
  emoji,
  title,
  subtitle,
  onClick,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "18px 16px",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.05)",
        color: "white",
        cursor: "pointer",
        textAlign: "left",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 24, lineHeight: 1 }}>{emoji}</div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              opacity: 0.68,
              lineHeight: 1.35,
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
    </button>
  );
}