import { useMemo } from 'react';
import { format, subDays, addDays } from 'date-fns';
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

  // Last 3 calendar months (current + 2 previous), aligned to Sunday
  const weeks = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const anchor = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const startSun = subDays(anchor, anchor.getDay());

    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // last day of current month

    const result: (Date | null)[][] = [];
    let cur = new Date(startSun);
    while (cur <= endDate) {
      const week: (Date | null)[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(cur <= endDate ? new Date(cur) : null);
        cur = addDays(cur, 1);
      }
      result.push(week);
    }
    return result;
  }, []);

  const monthLabels = useMemo(() => {
    const out: { label: string; col: number }[] = [];
    let last = -1;
    weeks.forEach((week, col) => {
      for (const d of week) {
        if (!d) continue;
        const m = d.getMonth();
        if (d.getDate() === 1 && m !== last) {
          out.push({ label: t.heatmap.monthsShort[m], col });
          last = m;
          break;
        }
      }
    });
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, t]);

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Month labels */}
      <div style={{ position: 'relative', height: 16, marginLeft: 28, fontSize: 10, color: 'var(--text-secondary)' }}>
        {monthLabels.map(({ label, col }) => (
          <span key={col} style={{ position: 'absolute', left: col * 15 }}>{label}</span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {/* Day-of-week labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 24, flexShrink: 0 }}>
          {t.heatmap.weekDowShort.map((d, i) => (
            <span key={i} style={{ fontSize: 9, color: 'var(--text-secondary)', height: 12, lineHeight: '12px', textAlign: 'right', visibility: i % 2 === 0 ? 'hidden' : 'visible' }}>
              {d}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'flex', gap: 3 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {week.map((day, di) =>
                !day
                  ? <div key={di} style={{ width: 12, height: 12 }} />
                  : (() => {
                      const ds = format(day, 'yyyy-MM-dd');
                      const n = map[ds] ?? 0;
                      const formattedDate = language === 'vi'
                        ? format(day, 'd MMM', { locale: viLocale })
                        : format(day, 'MMM d');
                      return (
                        <div
                          key={di}
                          style={{ width: 12, height: 12, borderRadius: 2, background: COLORS[level(n)], flexShrink: 0, cursor: 'default' }}
                          title={t.heatmap.cellTooltip(formattedDate, n)}
                        />
                      );
                    })()
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10, color: 'var(--text-secondary)' }}>
        <span>{t.heatmap.legendLess}</span>
        {COLORS.map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />)}
        <span>{t.heatmap.legendMore}</span>
      </div>
    </div>
  );
}
