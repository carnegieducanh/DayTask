import { useState, useRef, useEffect } from 'react';
import { attachSmoothScroll } from '../../hooks/useSmoothScroll';
import { createPortal } from 'react-dom';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';

import { IconClock, IconTrash, IconCheck } from '@tabler/icons-react';
import { useT } from '../../i18n';
import type { Task, CategoryColors, TaskTimeEntry } from '../../types';
import { useAppStore } from '../../store/appStore';
import { calcDayStats, formatMins, type DayStat } from './calendarUtils';

const COLOR_PALETTE: string[] = [
  '#C05476', '#E3683E', '#D8BE5E', '#489160', '#6E72C3', '#A75ABA',
  '#D85675', '#DD7835', '#BCC256', '#429A8E', '#828BC2', '#957367',
  '#DA5234', '#E0963C', '#82AA57', '#4B99D2', '#AE9CCE', '#7C7C7C',
  '#D38179', '#E4B751', '#54AD7F', '#6489DF', '#A277AF', '#A3978B',
];

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
  highlightDate?: string;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) return attachSmoothScroll(scrollRef.current);
  }, []);

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
        ref={scrollRef}
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
  highlightDate,
}: WeekViewProps) {
  const t = useT();
  const { softDeleteTask, updateTaskColor } = useAppStore();
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

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    function handleClose(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null);
    }
    window.addEventListener('mousedown', handleClose);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClose);
      window.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  function handleTaskContextMenu(e: React.MouseEvent, task: Task) {
    e.preventDefault();
    e.stopPropagation();
    const MENU_W = 180;
    const MENU_H = 170;
    let x = e.clientX;
    let y = e.clientY;
    if (x + MENU_W > window.innerWidth) x = window.innerWidth - MENU_W - 8;
    if (y + MENU_H > window.innerHeight) y = window.innerHeight - MENU_H - 8;
    setContextMenu({ x, y, task });
  }

  return (
    <div className="cal-week-grid">
      {days.map((day, i) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayTasks = tasks
          .filter((task) => task.date === dateStr)
          .sort((a, b) => {
            const ea = timeEntries.find((e) => e.task_id === a.id && e.date === dateStr);
            const eb = timeEntries.find((e) => e.task_id === b.id && e.date === dateStr);
            if (!ea && !eb) return 0;
            if (!ea) return 1;
            if (!eb) return -1;
            return ea.start_time.localeCompare(eb.start_time);
          });
        const isToday = isSameDay(day, today);
        const stats = calcDayStats(tasks, timeEntries, dateStr, categoryColors);

        return (
          <div key={dateStr} className="cal-week-col">
            <div
              className={`cal-week-header${isToday ? ' today' : ''}${highlightDate === dateStr ? ' highlighted' : ''}`}
              onClick={() => onDayClick(dateStr)}
            >
              <div className="cal-week-header-day">{t.calendar.weekDowShort[day.getDay()]}</div>
              <div className="cal-week-header-date">{format(day, 'd')}</div>
            </div>
            <div className="cal-week-tasks" ref={(el) => { taskAreaRefs.current[i] = el; }}>
              {dayTasks.map((task) => {
                const color = task.color ?? categoryColors[task.category] ?? '#7DD3FC';
                const entry = timeEntries.find((e) => e.task_id === task.id && e.date === dateStr);
                const duration = entry ? calcDuration(entry.start_time, entry.end_time) : null;
                return (
                  <div
                    key={task.id}
                    className="cal-week-task-card"
                    style={{ backgroundColor: color }}
                    onClick={() => onTaskClick(task)}
                    onContextMenu={(e) => handleTaskContextMenu(e, task)}
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
      {contextMenu && (
        <div
          ref={menuRef}
          className="task-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="day-context-item day-context-item-danger"
            onClick={() => { softDeleteTask(contextMenu.task.id); setContextMenu(null); }}
          >
            <IconTrash size={16} />
            {t.taskCard.delete}
          </button>
          <div className="task-context-divider" />
          <div className="task-context-colors">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                className="task-context-color-btn"
                style={{ backgroundColor: color }}
                onClick={() => { if ((contextMenu.task.color ?? categoryColors[contextMenu.task.category]) !== color) { updateTaskColor(contextMenu.task.category, color); } setContextMenu(null); }}
                title={color}
              >
                {(contextMenu.task.color ?? categoryColors[contextMenu.task.category]) === color && <IconCheck size={12} color="white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
