// src/pages/ImportPDF.tsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseRosterPdfToEvents } from "../services/pdfParser";
import { parseIcsTextToEvents } from "../services/icsParser";

type Role = "HAN" | "KYU";

export default function ImportPDF() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("HAN");
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();

    try {
      setLoading(true);

      // ✔ PDF Import
      if (name.endsWith(".pdf")) {
        const buf = await file.arrayBuffer();
        const parsed = await parseRosterPdfToEvents(buf, role);

        navigate("/cal", {
          state: { importedEvents: parsed.events, importRole: role },
        });
        return;
      }

      // ✔ ICS Import
      if (name.endsWith(".ics")) {
        const text = await file.text();
        const events = parseIcsTextToEvents(text, role);

        navigate("/cal", {
          state: { importedEvents: events, importRole: role },
        });
        return;
      }

      alert("PDF 또는 ICS 파일만 업로드할 수 있습니다.");
    } catch (err) {
      console.error(err);
      alert("파일을 처리하는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: 40,
        maxWidth: 500,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <h2 style={{ marginBottom: 20 }}>스케줄 Import</h2>

      {/* 역할 선택 */}
      <div style={{ marginBottom: 20 }}>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 14,
          }}
        >
          <option value="HAN">HAN (계성한)</option>
          <option value="KYU">KYU (안규영)</option>
        </select>
      </div>

      {/* 파일 업로드 */}
      <div>
        <input
          type="file"
          accept=".pdf,.ics"
          onChange={handleFileChange}
          style={{ marginBottom: 20 }}
        />
      </div>

      {loading && <div>파일을 처리하는 중입니다...</div>}

      <div style={{ marginTop: 30 }}>
        <button
          onClick={() => navigate("/cal")}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#007AFF",
            color: "white",
            cursor: "pointer",
          }}
        >
          달력으로 이동
        </button>
      </div>
    </div>
  );
}