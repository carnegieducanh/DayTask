import { useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { useT } from '../../i18n';
import type { CategoryColors, Task, TaskTimeEntry } from '../../types';
import { formatMins } from './calendarUtils';

export interface YearViewProps {
  tasks: Task[];
  timeEntries: TaskTimeEntry[];
  year: number;
  categoryColors: CategoryColors;
  language: string;
  onMonthClick: (monthIndex: number) => void;
  onDayClick: (dateStr: string) => void;
}

type Segment = { color: string; weight: number };
type DaySummary = { count: number; mins: number; segments: Segment[] };

function entryMins(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/**
 * Tóm tắt từng ngày trong năm từ task ĐÃ XONG (giống Tuần/Tháng chỉ hiện task đã xong):
 * số task, tổng phút, và các đoạn màu cho dải dưới số ngày — mỗi màu (màu riêng của task
 * hoặc màu danh mục) dài theo số phút; ngày chưa có phút nào thì chia theo số task.
 * Tính 1 lần O(task + entry) bằng map, vì cả năm có thể vài nghìn task.
 */
function summarizeYear(
  tasks: Task[],
  timeEntries: TaskTimeEntry[],
  year: number,
  categoryColors: CategoryColors,
): Map<string, DaySummary> {
  const minsByTaskDate = new Map<string, number>();
  for (const e of timeEntries) {
    const key = `${e.task_id}|${e.date}`;
    minsByTaskDate.set(key, (minsByTaskDate.get(key) ?? 0) + entryMins(e.start_time, e.end_time));
  }

  const prefix = `${year}-`;
  const byDay = new Map<string, { count: number; mins: number; colors: Map<string, { mins: number; count: number }> }>();
  for (const task of tasks) {
    if (!task.is_done || !task.date.startsWith(prefix)) continue;
    const mins = minsByTaskDate.get(`${task.id}|${task.date}`) ?? 0;
    const color = task.color ?? categoryColors[task.category] ?? '#7DD3FC';
    let day = byDay.get(task.date);
    if (!day) {
      day = { count: 0, mins: 0, colors: new Map() };
      byDay.set(task.date, day);
    }
    day.count += 1;
    day.mins += mins;
    const c = day.colors.get(color) ?? { mins: 0, count: 0 };
    c.mins += mins;
    c.count += 1;
    day.colors.set(color, c);
  }

  const result = new Map<string, DaySummary>();
  for (const [date, day] of byDay) {
    const segments = [...day.colors.entries()]
      .map(([color, c]) => ({ color, weight: day.mins > 0 ? c.mins : c.count }))
      .filter((s) => s.weight > 0)
      .sort((a, b) => b.weight - a.weight);
    result.set(date, { count: day.count, mins: day.mins, segments });
  }
  return result;
}

export default function YearView({
  tasks,
  timeEntries,
  year,
  categoryColors,
  language,
  onMonthClick,
  onDayClick,
}: YearViewProps) {
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(scrollRef);

  const summary = useMemo(
    () => summarizeYear(tasks, timeEntries, year, categoryColors),
    [tasks, timeEntries, year, categoryColors],
  );

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const currentMonth = now.getFullYear() === year ? now.getMonth() : -1;
  const dow = t.calendar.weekDowShort;

  return (
    <div className="cal-year" ref={scrollRef}>
      <div className="cal-year-grid">
        {Array.from({ length: 12 }, (_, m) => {
          const first = new Date(year, m, 1);
          const lead = first.getDay(); // tuần bắt đầu Chủ nhật, giống Tuần/Tháng
          const daysInMonth = new Date(year, m + 1, 0).getDate();
          const monthLabel = language === 'vi' ? `Tháng ${m + 1}` : format(first, 'MMMM');

          let monthMins = 0;
          let monthDone = 0;
          for (let d = 1; d <= daysInMonth; d++) {
            const info = summary.get(format(new Date(year, m, d), 'yyyy-MM-dd'));
            monthMins += info?.mins ?? 0;
            monthDone += info?.count ?? 0;
          }
          // Tổng giờ của tháng; task xong mà chưa ghi giờ nào thì hiện số task thay vì "–"
          const monthTotal = formatMins(monthMins) || (monthDone > 0 ? t.calendar.yearDayDone(monthDone) : '–');

          return (
            <section key={m} className={`cal-year-month${m === currentMonth ? ' is-current' : ''}`}>
              <header className="cal-year-month-head">
                <button className="cal-year-month-name" onClick={() => onMonthClick(m)}>
                  {monthLabel}
                </button>
                <span className="cal-year-month-total">{monthTotal}</span>
              </header>
              <div className="cal-year-dow-row">
                {dow.map((d) => (
                  <span key={d} className="cal-year-dow">{d}</span>
                ))}
              </div>
              <div className="cal-year-days">
                {Array.from({ length: 42 }, (_, i) => {
                  const dayNum = i - lead + 1;
                  if (dayNum < 1 || dayNum > daysInMonth) {
                    return <span key={i} className="cal-year-day-blank" />;
                  }
                  const date = new Date(year, m, dayNum);
                  const ds = format(date, 'yyyy-MM-dd');
                  const info = summary.get(ds);
                  const isToday = ds === todayStr;
                  const dateLabel = language === 'vi' ? format(date, 'd/M/yyyy') : format(date, 'MMM d, yyyy');
                  const tip = info
                    ? `${dateLabel} — ${t.calendar.yearDayDone(info.count)}${info.mins > 0 ? ` · ${formatMins(info.mins)}` : ''}`
                    : dateLabel;
                  return (
                    <button
                      key={i}
                      className={`cal-year-day${info ? ' has-activity' : ''}${isToday ? ' is-today' : ''}`}
                      title={tip}
                      onClick={() => onDayClick(ds)}
                    >
                      <span className="cal-year-day-num">{dayNum}</span>
                      <span className="cal-year-day-strip">
                        {info?.segments.map((s) => (
                          <span key={s.color} style={{ flexGrow: s.weight, background: s.color }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
