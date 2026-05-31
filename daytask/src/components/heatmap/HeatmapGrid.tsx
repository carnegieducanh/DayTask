import { useMemo } from 'react';
import { startOfYear, endOfYear, eachDayOfInterval, getDay, format, isToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { DayActivity } from '../../types';

const LEVEL_COLORS = ['var(--bg-secondary)', '#B5D4F4', '#378ADD', '#125680', '#0a3d5e'];

function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

const MONTHS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
const DAYS   = ['CN','T2','T3','T4','T5','T6','T7'];

interface Props {
  year: number;
  data: DayActivity[];
}

export default function HeatmapGrid({ year, data }: Props) {
  const activityMap = useMemo(() => {
    const m: Record<string, number> = {};
    data.forEach((d) => { m[d.date] = d.count; });
    return m;
  }, [data]);

  // Build weeks array: each week is Sun→Sat
  const weeks = useMemo(() => {
    const start = startOfYear(new Date(year, 0, 1));
    const end   = endOfYear(new Date(year, 0, 1));
    const days  = eachDayOfInterval({ start, end });

    const allWeeks: (Date | null)[][] = [];
    let week: (Date | null)[] = Array(getDay(days[0])).fill(null);

    for (const day of days) {
      week.push(day);
      if (week.length === 7) {
        allWeeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      allWeeks.push(week);
    }
    return allWeeks;
  }, [year]);

  // Month label positions
  const monthLabels = useMemo(() => {
    const labels: { month: string; col: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, col) => {
      const firstReal = week.find((d) => d !== null);
      if (firstReal) {
        const m = firstReal.getMonth();
        if (m !== lastMonth) {
          labels.push({ month: MONTHS[m], col });
          lastMonth = m;
        }
      }
    });
    return labels;
  }, [weeks]);

  return (
    <div className="heatmap-wrap">
      {/* Month labels */}
      <div className="heatmap-months" style={{ marginLeft: 28 }}>
        {monthLabels.map(({ month, col }) => (
          <span
            key={col}
            className="heatmap-month-label"
            style={{ left: col * 15 }}
          >
            {month}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {/* Day-of-week labels */}
        <div className="heatmap-days">
          {DAYS.map((d, i) => (
            <span key={d} style={{ visibility: i % 2 === 0 ? 'hidden' : 'visible' }}>
              {d}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div className="heatmap-grid">
          {weeks.map((week, wi) => (
            <div key={wi} className="heatmap-week">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="hm-cell" style={{ background: 'transparent' }} />;
                const dateStr = format(day, 'yyyy-MM-dd');
                const count   = activityMap[dateStr] ?? 0;
                const level   = getLevel(count);
                const todayBorder = isToday(day) ? '1.5px solid var(--primary)' : undefined;
                return (
                  <div
                    key={di}
                    className="hm-cell"
                    style={{ background: LEVEL_COLORS[level], outline: todayBorder }}
                    title={`${format(day, 'd MMM', { locale: vi })}: ${count} task hoàn thành`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="heatmap-legend">
        <span>Ít</span>
        {LEVEL_COLORS.map((c, i) => (
          <div key={i} className="hm-legend-cell" style={{ background: c }} />
        ))}
        <span>Nhiều</span>
      </div>
    </div>
  );
}
