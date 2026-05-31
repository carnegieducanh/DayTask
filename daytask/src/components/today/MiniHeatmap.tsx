import { useMemo } from 'react';
import { format, subDays, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { DayActivity } from '../../types';

const COLORS = ['var(--border-1)', '#B5D4F4', '#378ADD', '#185FA5', '#0C447C'];
const MONTHS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
const DAYS   = ['CN','T2','T3','T4','T5','T6','T7'];

function level(n: number) { return n===0?0:n<=2?1:n<=4?2:n<=6?3:4; }

export default function MiniHeatmap({ data }: { data: DayActivity[] }) {
  const map = useMemo(
    () => Object.fromEntries(data.map((d) => [d.date, d.count])),
    [data]
  );

  // Last 91 days, aligned to Sunday
  const weeks = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const anchor = subDays(today, 90);
    const startSun = subDays(anchor, anchor.getDay()); // prev Sunday

    const result: (Date | null)[][] = [];
    let cur = new Date(startSun);
    while (cur <= today) {
      const week: (Date | null)[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(cur <= today ? new Date(cur) : null);
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
      const d = week.find(Boolean);
      if (d) {
        const m = d.getMonth();
        if (m !== last) { out.push({ label: MONTHS[m], col }); last = m; }
      }
    });
    return out;
  }, [weeks]);

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
          {DAYS.map((d, i) => (
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
                      return (
                        <div
                          key={di}
                          style={{ width: 12, height: 12, borderRadius: 2, background: COLORS[level(n)], flexShrink: 0, cursor: 'default' }}
                          title={`${format(day, 'd MMM', { locale: vi })}: ${n} task`}
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
        <span>Ít</span>
        {COLORS.map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />)}
        <span>Nhiều</span>
      </div>
    </div>
  );
}
