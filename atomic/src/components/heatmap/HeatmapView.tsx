import { useEffect, useMemo, useState } from 'react';
import { IconTrophy, IconCalendar, IconChartBar, IconAward } from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';
import HeatmapGrid from './HeatmapGrid';

const MONTHS_SHORT = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

export default function HeatmapView() {
  const { heatmap, selectedYear, setSelectedYear, loadHeatmap, getStreak } = useAppStore();
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    loadHeatmap(selectedYear);
    getStreak().then(setStreak);
  }, [selectedYear]);

  const totalDone  = heatmap.reduce((s, d) => s + d.count, 0);
  const activeDays = heatmap.length;

  const monthlyTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    heatmap.forEach(({ date, count }) => {
      const month = parseInt(date.slice(5, 7)) - 1;
      totals[month] += count;
    });
    return totals;
  }, [heatmap]);

  const maxMonthly = Math.max(...monthlyTotals, 1);
  const isCurrentYear = selectedYear === new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const longestStreak = useMemo(() => {
    if (heatmap.length === 0) return 0;
    const dates = heatmap.map(d => d.date).sort();
    let longest = 1, current = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T00:00:00');
      const curr = new Date(dates[i] + 'T00:00:00');
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diff === 1) { current++; if (current > longest) longest = current; }
      else current = 1;
    }
    return longest;
  }, [heatmap]);

  const mostActiveDay = useMemo(() => {
    if (heatmap.length === 0) return null;
    return heatmap.reduce((max, d) => d.count > max.count ? d : max);
  }, [heatmap]);

  const bestMonthIdx = useMemo(() => {
    const max = Math.max(...monthlyTotals);
    return max === 0 ? null : monthlyTotals.indexOf(max);
  }, [monthlyTotals]);

  const avgPerDay = activeDays > 0 ? (totalDone / activeDays).toFixed(1) : '0';

  const formatDay = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    return `${d.getDate()} tháng ${d.getMonth() + 1}`;
  };

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

        {/* Monthly bar chart */}
        <div>
          <div className="section-label" style={{ marginBottom: 12 }}>
            Task hoàn thành theo tháng
          </div>
          <div className="monthly-chart">
            {monthlyTotals.map((count, i) => {
              const barH = Math.round((count / maxMonthly) * 80) || (count > 0 ? 3 : 0);
              const isActive = isCurrentYear && i === currentMonth;
              return (
                <div key={i} className="monthly-bar-col">
                  <div className="monthly-bar-track">
                    <div
                      className={`monthly-bar${isActive ? ' monthly-bar--active' : ''}`}
                      style={{ height: barH }}
                      title={`${MONTHS_SHORT[i]}: ${count} task`}
                    />
                  </div>
                  <span className="monthly-bar-label">{MONTHS_SHORT[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom 4 stat cards */}
        <div className="stats-row-4">
          <div className="stat-card-sm">
            <div className="stat-card-sm-label">Streak dài nhất</div>
            <div className="stat-card-sm-row">
              <IconTrophy size={20} className="stat-card-sm-icon stat-icon-trophy" />
              <span className="stat-card-sm-value">{longestStreak}</span>
              <span className="stat-card-sm-unit">ngày</span>
            </div>
          </div>
          <div className="stat-card-sm">
            <div className="stat-card-sm-label">Ngày hoạt động nhiều nhất</div>
            <div className="stat-card-sm-row">
              <IconCalendar size={20} className="stat-card-sm-icon" />
              <span className="stat-card-sm-value">
                {mostActiveDay ? formatDay(mostActiveDay.date) : '—'}
              </span>
            </div>
          </div>
          <div className="stat-card-sm">
            <div className="stat-card-sm-label">Trung bình task/ngày</div>
            <div className="stat-card-sm-row">
              <IconChartBar size={20} className="stat-card-sm-icon" />
              <span className="stat-card-sm-value">{avgPerDay}</span>
            </div>
          </div>
          <div className="stat-card-sm">
            <div className="stat-card-sm-label">Tháng tốt nhất</div>
            <div className="stat-card-sm-row">
              <IconAward size={20} className="stat-card-sm-icon stat-icon-award" />
              <span className="stat-card-sm-value">
                {bestMonthIdx !== null ? `Tháng ${bestMonthIdx + 1}` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
