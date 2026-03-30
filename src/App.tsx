import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import MySchedule from "./pages/MySchedule";
import Compare from "./pages/Compare";
import CalendarPage from "./pages/Calendar";
import ImportPDF from "./pages/ImportPDF";
import StatsPage from "./pages/Stats"; // ✅ 추가
import WeekPage from "./pages/Week";
import { repairStoredEventsOnce } from "./services/schedule";

function App() {
  useEffect(() => {
    try {
      repairStoredEventsOnce();
    } catch {}
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/my" element={<MySchedule />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/cal" element={<CalendarPage />} />
        <Route path="/import" element={<ImportPDF />} />
        <Route path="/stats" element={<StatsPage />} /> {/* ✅ 추가 */}
        <Route path="/week" element={<WeekPage />} />
        <Route path="/meet" element={<div style={{ padding: 20 }}>Meet Day 준비중</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;