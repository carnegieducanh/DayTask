import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import type { DayActivity } from '../../types';
import { getHeatmapColors } from '../../utils/heatmapColors';

function level(n: number) { return n === 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : n <= 6 ? 3 : 4; }

export default function MiniHeatmap({ data }: { data: DayActivity[] }) {
  const t = useT();
  const { theme, language, accentColor, customAccentColor } = useAppStore();
  const COLORS = getHeatmapColors(accentColor, theme, 'var(--border-1)', customAccentColor);

  const map = useMemo(
    () => Object.fromEntries(data.map((d) => [d.date, d.count])),
    [data]
  );

  // Current month + 2 previous months, each rendered as its own calendar block
  const monthsData = useMemo(() => {
    const today = new Date();
    return [2, 1, 0].map((offset) => {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - offset, 1);
      const start = startOfMonth(monthDate);
      const end   = endOfMonth(monthDate);
      const days  = eachDayOfInterval({ start, end });

      const weeks: (Date | null)[][] = [];
      let week: (Date | null)[] = Array(getDay(days[0])).fill(null);
      for (const day of days) {
        week.push(day);
        if (week.length === 7) { weeks.push(week); week = []; }
      }
      if (week.length > 0) {
        while (week.length < 7) week.push(null);
        weeks.push(week);
      }
      return { label: t.heatmap.monthsShort[monthDate.getMonth()], weeks };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  return (
    <div>
      <div className="mini-heatmap-months">
        {monthsData.map(({ label, weeks }, mi) => (
          <div key={mi} className="mini-heatmap-month-block">
            <div className="mini-heatmap-month-label">{label}</div>
            <div className="mini-heatmap-month-grid">
              {weeks.map((week, wi) => (
                <div key={wi} className="mini-heatmap-month-col">
                  {week.map((day, di) => {
                    if (!day) return <div key={di} className="mini-hm-cell" style={{ background: 'transparent' }} />;
                    const ds = format(day, 'yyyy-MM-dd');
                    const n = map[ds] ?? 0;
                    const formattedDate = language === 'vi'
                      ? format(day, 'd MMM', { locale: viLocale })
                      : format(day, 'MMM d');
                    return (
                      <div
                        key={di}
                        className="mini-hm-cell"
                        style={{ background: COLORS[level(n)] }}
                        title={t.heatmap.cellTooltip(formattedDate, n)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="heatmap-legend" style={{ marginTop: 6, fontSize: 10 }}>
        <span>{t.heatmap.legendLess}</span>
        {COLORS.map((c, i) => <div key={i} className="hm-legend-cell" style={{ background: c }} />)}
        <span>{t.heatmap.legendMore}</span>
      </div>
    </div>
  );
}
