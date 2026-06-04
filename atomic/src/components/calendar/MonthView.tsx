import { useEffect, useRef, useState } from 'react';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { createPortal } from 'react-dom';
import { format, startOfMonth, startOfWeek, addDays, isSameMonth, isToday } from 'date-fns';
import { IconClock, IconX } from '@tabler/icons-react';
import { useT } from '../../i18n';
import type { Task, CategoryColors, TaskTimeEntry } from '../../types';
import { calcDayStats, formatMins } from './calendarUtils';

export interface MonthViewProps {
  tasks: Task[];
  currentDate: Date;
  categoryColors: CategoryColors;
  onTaskClick: (task: Task) => void;
  onDayClick: (date: string) => void;
  timeEntries: TaskTimeEntry[];
  language: string;
}

function generateMonthGrid(currentDate: Date): Date[][] {
  const monthStart = startOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const weeks: Date[][] = [];
  let day = gridStart;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }
  if (!weeks[5].some((d) => isSameMonth(d, currentDate))) {
    weeks.pop();
  }
  return weeks;
}

function computeMaxVisible(containerH: number, numTasks: number): number {
  if (numTasks === 0) return 0;
  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const lineH = Math.max(16, Math.round(rootFontSize * 0.86 * 1.4 + 2));
  const fits = Math.floor(containerH / lineH);
  if (fits <= 0) return 0;
  if (fits >= numTasks) return numTasks;
  return Math.max(0, fits - 1); // reserve 1 slot for "+N more"
}

interface PopoverPos { top: number; left: number; }

function DayPopover({
  date,
  tasks,
  categoryColors,
  pos,
  onTaskClick,
  onClose,
  language,
}: {
  date: Date;
  tasks: Task[];
  categoryColors: CategoryColors;
  pos: PopoverPos;
  onTaskClick: (task: Task) => void;
  onClose: () => void;
  language: string;
}) {
  const dateLabel = language === 'vi'
    ? format(date, 'dd/MM/yyyy')
    : format(date, 'MMM d, yyyy');

  return createPortal(
    <div
      className="cal-day-popover"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="cal-day-popover-header">
        <span className="cal-day-popover-date">{dateLabel}</span>
        <button className="cal-day-popover-close" onClick={onClose}>
          <IconX size="0.85rem" />
        </button>
      </div>
      <div className="cal-day-popover-list">
        {tasks.length === 0 ? (
          <div className="cal-day-popover-empty">
            {language === 'vi' ? 'Không có task' : 'No tasks'}
          </div>
        ) : (
          tasks.map((task) => {
            const color = categoryColors[task.category] ?? '#7DD3FC';
            return (
              <div
                key={task.id}
                className="cal-day-popover-task"
                onClick={() => { onClose(); onTaskClick(task); }}
              >
                <span className="cal-month-dot" style={{ background: color }} />
                <span className="cal-day-popover-task-title">{task.title}</span>
              </div>
            );
          })
        )}
      </div>
    </div>,
    document.body
  );
}

function MonthDayCell({
  date,
  currentMonth,
  tasks,
  categoryColors,
  timeEntries,
  onTaskClick,
  language,
}: {
  date: Date;
  currentMonth: Date;
  tasks: Task[];
  categoryColors: CategoryColors;
  timeEntries: TaskTimeEntry[];
  onTaskClick: (task: Task) => void;
  language: string;
}) {
  const [maxVisible, setMaxVisible] = useState(99);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<PopoverPos>({ top: 0, left: 0 });
  const cellRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<HTMLDivElement>(null);
  const dayTasksLenRef = useRef(0);

  const dateStr = format(date, 'yyyy-MM-dd');
  const dayTasks = tasks.filter((task) => task.date === dateStr);
  dayTasksLenRef.current = dayTasks.length;

  // ResizeObserver: recalculate when container height changes
  useEffect(() => {
    const el = eventsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setMaxVisible(computeMaxVisible(el.clientHeight, dayTasksLenRef.current));
    });
    ro.observe(el);
    setMaxVisible(computeMaxVisible(el.clientHeight, dayTasksLenRef.current));
    return () => ro.disconnect();
  }, []);

  // Recalculate when task count changes
  useEffect(() => {
    const el = eventsRef.current;
    if (!el || el.clientHeight === 0) return;
    setMaxVisible(computeMaxVisible(el.clientHeight, dayTasks.length));
  }, [dayTasks.length]);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.cal-day-popover')) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [popoverOpen]);

  const openPopover = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cell = cellRef.current;
    if (!cell) return;
    const rect = cell.getBoundingClientRect();
    const popW = 248;
    const popH = Math.min(300, dayTasks.length * 34 + 52);
    let top = rect.bottom + 4;
    let left = rect.left;
    if (top + popH > window.innerHeight - 16) top = rect.top - popH - 4;
    if (left + popW > window.innerWidth - 16) left = window.innerWidth - popW - 16;
    if (left < 8) left = 8;
    setPopoverPos({ top, left });
    setPopoverOpen(true);
  };

  const visibleTasks = dayTasks.slice(0, maxVisible);
  const hiddenCount = dayTasks.length - visibleTasks.length;
  const inMonth = isSameMonth(date, currentMonth);
  const today = isToday(date);
  const stats = calcDayStats(tasks, timeEntries, dateStr, categoryColors);
  const total = stats.reduce((sum, s) => sum + s.totalMins, 0);

  return (
    <div
      ref={cellRef}
      className={`cal-month-day-cell${!inMonth ? ' off-range' : ''}${today ? ' is-today' : ''}`}
      onClick={openPopover}
    >
      <div className="cal-month-day-date">
        <span className={`cal-month-day-num${today ? ' today' : ''}`}>
          {date.getDate()}
        </span>
      </div>
      <div ref={eventsRef} className="cal-month-day-events">
        {visibleTasks.map((task) => {
          const color = categoryColors[task.category] ?? '#7DD3FC';
          return (
            <div
              key={task.id}
              className="cal-month-event"
              onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
            >
              <span className="cal-month-dot" style={{ background: color }} />
              <span className="cal-month-title">{task.title}</span>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <div className="cal-month-more-row" onClick={openPopover}>
            +{hiddenCount} {language === 'vi' ? 'nữa' : 'more'}
          </div>
        )}
      </div>
      {total > 0 && (
        <div className="cal-month-cell-stats">
          <IconClock size="0.65rem" />
          <span className="cal-month-stat-total-val">{formatMins(total)}</span>
        </div>
      )}
      {popoverOpen && (
        <DayPopover
          date={date}
          tasks={dayTasks}
          categoryColors={categoryColors}
          pos={popoverPos}
          onTaskClick={onTaskClick}
          onClose={() => setPopoverOpen(false)}
          language={language}
        />
      )}
    </div>
  );
}

export default function MonthView({
  tasks,
  currentDate,
  categoryColors,
  onTaskClick,
  timeEntries,
  language,
}: MonthViewProps) {
  const t = useT();
  const weeks = generateMonthGrid(currentDate);
  const dow = t.calendar.weekDowShort;
  const mondayFirstDow = [...dow.slice(1), dow[0]];
  const gridRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(gridRef);

  return (
    <div className="cal-month-grid" ref={gridRef}>
      <div className="cal-month-dow-row">
        {mondayFirstDow.map((d) => (
          <div key={d} className="cal-month-dow">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="cal-month-week-row">
          {week.map((date, di) => (
            <MonthDayCell
              key={di}
              date={date}
              currentMonth={currentDate}
              tasks={tasks}
              categoryColors={categoryColors}
              timeEntries={timeEntries}
              onTaskClick={onTaskClick}
              language={language}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
