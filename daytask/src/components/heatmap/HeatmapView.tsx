import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import HeatmapGrid from './HeatmapGrid';

export default function HeatmapView() {
  const { heatmap, selectedYear, setSelectedYear, loadHeatmap, getStreak } = useAppStore();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    loadHeatmap(selectedYear);
    getStreak().then(setStreak);
  }, [selectedYear]);

  const totalDone  = heatmap.reduce((s, d) => s + d.count, 0);
  const activeDays = heatmap.length;

  return (
    <>
      <div className="view-topbar">
        <div>
          <div className="view-title">Heatmap hoạt động</div>
          <div className="view-subtitle">{totalDone} task hoàn thành · {activeDays} ngày có hoạt động</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="icon-btn" onClick={() => setSelectedYear(selectedYear - 1)}>←</button>
          <span style={{ fontSize: 15, fontWeight: 500, minWidth: 40, textAlign: 'center' }}>
            {selectedYear}
          </span>
          <button className="icon-btn" onClick={() => setSelectedYear(selectedYear + 1)}>→</button>
        </div>
      </div>

      <div className="view-content">
        {/* Stat cards */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Streak hiện tại</div>
            <div className="stat-value">{streak}</div>
            <div className="stat-sub">ngày liên tiếp</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ngày hoạt động</div>
            <div className="stat-value">{activeDays}</div>
            <div className="stat-sub">trong năm {selectedYear}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Task hoàn thành</div>
            <div className="stat-value">{totalDone}</div>
            <div className="stat-sub">tổng năm {selectedYear}</div>
          </div>
        </div>

        {/* Heatmap grid */}
        <div>
          <div className="section-label" style={{ marginBottom: 12 }}>
            Hoạt động năm {selectedYear}
          </div>
          <HeatmapGrid year={selectedYear} data={heatmap} />
        </div>
      </div>
    </>
  );
}
