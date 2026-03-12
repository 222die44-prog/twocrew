import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRole, setRole } from "../services/schedule";

type Role = "HAN" | "KYU";

export default function Home() {
  const nav = useNavigate();
  const [role, setRoleState] = useState<Role>(() => getRole());

  const name = useMemo(() => (role === "HAN" ? "계성한" : "안규영"), [role]);

  function choose(r: Role) {
    setRole(r);
    setRoleState(r);
  }

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ marginTop: 0 }}>TwoCrew</h1>
      <div style={{ marginBottom: 16, opacity: 0.8 }}>현재 사용자: {name}</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={() => choose("HAN")}>나는 계성한</button>
        <button onClick={() => choose("KYU")}>나는 안규영</button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => nav("/my")}>내 스케줄 입력</button>
        <button onClick={() => nav("/compare")}>겹침 보기</button>
        <button onClick={() => nav("/cal")}>캘린더 보기</button>
      </div>
    </div>
  );
}
