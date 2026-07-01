import { useMemo } from 'react';
import { startOfYear, endOfYear, eachDayOfInterval, getDay, format, isToday } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import type { DayActivity, DayDuration } from '../../types';
import { getHeatmapColors } from '../../utils/heatmapColors';

function getCountLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

function getHoursLevel(minutes: number): number {
  if (minutes === 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 90) return 2;
  if (minutes < 180) return 3;
  return 4;
}

interface Props {
  year: number;
  data: DayActivity[];
  mode?: 'count' | 'hours';
  durations?: DayDuration[];
}

export default function HeatmapGrid({ year, data, mode = 'count', durations = [] }: Props) {
  const t = useT();
  const { theme, language, accentColor, customAccentColor } = useAppStore();
  const LEVEL_COLORS = getHeatmapColors(accentColor, theme, undefined, customAccentColor);

  const activityMap = useMemo(() => {
    const m: Record<string, number> = {};
    data.forEach((d) => { m[d.date] = d.count; });
    return m;
  }, [data]);

  const durationMap = useMemo(() => {
    const m: Record<string, number> = {};
    durations.forEach((d) => { m[d.date] = d.minutes; });
    return m;
  }, [durations]);

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

  const monthLabels = useMemo(() => {
    const labels: { month: string; col: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, col) => {
      const firstReal = week.find((d) => d !== null);
      if (firstReal) {
        const m = firstReal.getMonth();
        if (m !== lastMonth) {
          labels.push({ month: t.heatmap.monthsShort[m], col });
          lastMonth = m;
        }
      }
    });
    return labels;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, t]);

  return (
    <div className="heatmap-wrap">
      {/* Month labels */}
      <div className="heatmap-months" style={{ marginLeft: 28 }}>
        {monthLabels.map(({ month, col }) => (
          <span key={col} className="heatmap-month-label" style={{ left: col * 15 }}>
            {month}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {/* Day-of-week labels */}
        <div className="heatmap-days">
          {t.heatmap.weekDowShort.map((d, i) => (
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
                const todayBorder = isToday(day) ? '1.5px solid var(--primary)' : undefined;
                const formattedDate = language === 'vi'
                  ? format(day, 'd MMM', { locale: viLocale })
                  : format(day, 'MMM d');

                let level: number;
                let tooltipText: string;

                if (mode === 'hours') {
                  const mins = durationMap[dateStr] ?? 0;
                  level = getHoursLevel(mins);
                  const h = Math.floor(mins / 60);
                  const m = mins % 60;
                  tooltipText = t.heatmap.cellTooltipHours(formattedDate, h, m);
                } else {
                  const count = activityMap[dateStr] ?? 0;
                  level = getCountLevel(count);
                  tooltipText = t.heatmap.cellTooltip(formattedDate, count);
                }

                return (
                  <div
                    key={di}
                    className="hm-cell"
                    style={{ background: LEVEL_COLORS[level], outline: todayBorder }}
                    title={tooltipText}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="heatmap-legend">
        <span>{t.heatmap.legendLess}</span>
        {LEVEL_COLORS.map((c, i) => (
          <div key={i} className="hm-legend-cell" style={{ background: c }} />
        ))}
        <span>{t.heatmap.legendMore}</span>
      </div>
    </div>
  );
}
