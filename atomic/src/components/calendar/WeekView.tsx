import { useState, useRef, useEffect } from 'react';
import { attachSmoothScroll } from '../../hooks/useSmoothScroll';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';

import { IconTrash, IconCheck } from '@tabler/icons-react';
import { useT } from '../../i18n';
import type { Task, CategoryColors, TaskTimeEntry } from '../../types';
import { useAppStore } from '../../store/appStore';
import { calcDayStats, calcOtherDayMins } from './calendarUtils';
import DayStatsSection from './DayStatsSection';

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
        const stats = calcDayStats(tasks, timeEntries, dateStr, categoryColors).filter(s => s.category !== 'other');
        const otherMins = calcOtherDayMins(tasks, timeEntries, dateStr);
        const otherColor = categoryColors['other'] ?? '#7C7C7C';

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
            <DayStatsSection stats={stats} otherMins={otherMins} otherColor={otherColor} />
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
