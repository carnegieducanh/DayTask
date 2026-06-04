import { useState, useRef, useEffect } from 'react';
import { attachSmoothScroll } from '../../hooks/useSmoothScroll';
import { createPortal } from 'react-dom';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';
import { IconClock } from '@tabler/icons-react';
import { useT } from '../../i18n';
import type { Task, CategoryColors, TaskTimeEntry } from '../../types';
import { calcDayStats, formatMins, type DayStat } from './calendarUtils';

function calcDuration(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const total = eh * 60 + em - (sh * 60 + sm);
  if (total <= 0) return '';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface WeekViewProps {
  tasks: Task[];
  currentDate: Date;
  categoryColors: CategoryColors;
  onTaskClick: (task: Task) => void;
  onDayClick: (date: string) => void;
  timeEntries: TaskTimeEntry[];
}

function StatsPopover({ stats, pos }: { stats: DayStat[]; pos: { top: number; left: number } }) {
  const t = useT();
  const total = stats.reduce((sum, s) => sum + s.totalMins, 0);

  return createPortal(
    <div className="cal-stats-popup" style={{ top: pos.top, left: pos.left }}>
      <div className="cal-week-stat-total-row">
        <span className="cal-week-stat-total-label">
          <IconClock size="0.75rem" />
          {t.calendar.statsTotal}
        </span>
        <span className="cal-week-stat-total-val">{formatMins(total)}</span>
      </div>
      <div className="cal-week-stat-bar" style={{ marginBottom: 6 }}>
        {stats.map((s) => (
          <div
            key={s.category}
            className="cal-week-stat-bar-seg"
            style={{ width: `${(s.totalMins / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="cal-stats-popup-cats">
        {stats.map((s) => (
          <div key={s.category} className="cal-stats-popup-cat">
            <div className="cal-stats-popup-cat-left">
              <span className="cal-week-stat-dot" style={{ background: s.color }} />
              <span className="cal-stats-popup-cat-name">{t.cat[s.category]}</span>
            </div>
            <span className="cal-week-stat-cat-val">{formatMins(s.totalMins)}</span>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

function DayStatsSection({ stats }: { stats: DayStat[] }) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const [popPos, setPopPos] = useState({ top: 0, left: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!stats.length) return;
    const popW = 260;
    const popH = 220;
    let left = e.clientX + 14;
    if (left + popW > window.innerWidth - 8) left = e.clientX - popW - 14;
    if (left < 8) left = 8;
    let top = e.clientY - 10;
    if (top + popH > window.innerHeight - 8) top = window.innerHeight - popH - 8;
    if (top < 8) top = 8;
    setPopPos({ top, left });
    setHovered(true);
  };

  if (!stats.length) {
    return (
      <div className="cal-week-stats">
        <div className="cal-week-stats-empty">{t.calendar.noTasks}</div>
      </div>
    );
  }

  const total = stats.reduce((sum, s) => sum + s.totalMins, 0);

  return (
    <>
      <div
        className="cal-week-stats"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="cal-week-stat-total-row">
          <span className="cal-week-stat-total-label">
            <IconClock size="0.75rem" />
            {t.calendar.statsTotal}
          </span>
          <span className="cal-week-stat-total-val">{formatMins(total)}</span>
        </div>

        <div className="cal-week-stat-bar">
          {stats.map((s) => (
            <div
              key={s.category}
              className="cal-week-stat-bar-seg"
              style={{
                width: `${(s.totalMins / total) * 100}%`,
                background: s.color,
              }}
            />
          ))}
        </div>

        <div className="cal-week-stat-cats">
          {stats.map((s) => (
            <div key={s.category} className="cal-week-stat-cat">
              <div className="cal-week-stat-cat-left">
                <span className="cal-week-stat-dot" style={{ background: s.color }} />
                <span className="cal-week-stat-cat-name">{t.cat[s.category]}</span>
              </div>
              <span className="cal-week-stat-cat-val">{formatMins(s.totalMins)}</span>
            </div>
          ))}
        </div>
      </div>
      {hovered && <StatsPopover stats={stats} pos={popPos} />}
    </>
  );
}

export default function WeekView({
  tasks,
  currentDate,
  categoryColors,
  onTaskClick,
  onDayClick,
  timeEntries,
}: WeekViewProps) {
  const t = useT();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  // Smooth scroll for each day column's task area
  const taskAreaRefs = useRef<Array<HTMLDivElement | null>>(Array(7).fill(null));
  useEffect(() => {
    const cleanups = taskAreaRefs.current
      .filter((el): el is HTMLDivElement => el !== null)
      .map(attachSmoothScroll);
    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <div className="cal-week-grid">
      {days.map((day, i) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayTasks = tasks.filter((task) => task.date === dateStr);
        const isToday = isSameDay(day, today);
        const stats = calcDayStats(tasks, timeEntries, dateStr, categoryColors);

        return (
          <div key={dateStr} className="cal-week-col">
            <div
              className={`cal-week-header${isToday ? ' today' : ''}`}
              onClick={() => onDayClick(dateStr)}
            >
              <div className="cal-week-header-day">{t.calendar.weekDowShort[day.getDay()]}</div>
              <div className="cal-week-header-date">{format(day, 'd')}</div>
            </div>
            <div className="cal-week-tasks" ref={(el) => { taskAreaRefs.current[i] = el; }}>
              {dayTasks.map((task) => {
                const color = categoryColors[task.category] ?? '#7DD3FC';
                const entry = timeEntries.find((e) => e.task_id === task.id && e.date === dateStr);
                const duration = entry ? calcDuration(entry.start_time, entry.end_time) : null;
                return (
                  <div
                    key={task.id}
                    className="cal-week-task-card"
                    style={{ backgroundColor: color }}
                    onClick={() => onTaskClick(task)}
                  >
                    <span className="cal-week-task-title">{task.title}</span>
                    {task.description && (
                      <span className="cal-week-task-desc">{task.description}</span>
                    )}
                    <div className="cal-week-task-footer">
                      <span
                        className="cal-week-task-badge"
                        style={{ background: 'rgba(255,255,255,0.3)', color: 'rgba(0,0,0,0.72)' }}
                      >
                        {t.cat[task.category] ?? task.category}
                      </span>
                      {duration && (
                        <span className="cal-week-task-duration">{duration}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <DayStatsSection stats={stats} />
          </div>
        );
      })}
    </div>
  );
}
