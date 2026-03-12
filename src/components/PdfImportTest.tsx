import { parseKoreanAirPDF } from "../services/pdfParser";

export default function PdfImportTest() {
  return (
    <div style={{ padding: 20 }}>
      <h3>PDF Schedule Import Test</h3>

      <input
        type="file"
        accept="application/pdf"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;

          const events = await parseKoreanAirPDF(f);
          console.log("FINAL EVENTS:", events);

          alert(`Parsed ${events.length} events. 콘솔 확인!`);
        }}
      />
    </div>
  );
}