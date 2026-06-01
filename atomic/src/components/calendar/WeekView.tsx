import { startOfWeek, addDays, format, isSameDay } from 'date-fns';
import type { Task, CategoryColors } from '../../types';

const DOW_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const CATEGORY_VI: Record<string, string> = {
  work: 'Công việc',
  personal: 'Cá nhân',
  health: 'Sức khỏe',
  learn: 'Học tập',
};

interface WeekViewProps {
  tasks: Task[];
  currentDate: Date;
  categoryColors: CategoryColors;
  onTaskClick: (date: string) => void;
  onDayClick: (date: string) => void;
}

export default function WeekView({
  tasks,
  currentDate,
  categoryColors,
  onTaskClick,
  onDayClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="cal-week-grid">
      {days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayTasks = tasks.filter((t) => t.date === dateStr);
        const isToday = isSameDay(day, today);

        return (
          <div key={dateStr} className="cal-week-col">
            <div
              className={`cal-week-header${isToday ? ' today' : ''}`}
              onClick={() => onDayClick(dateStr)}
            >
              <div className="cal-week-header-day">{DOW_VI[day.getDay()]}</div>
              <div className="cal-week-header-date">{format(day, 'd')}</div>
            </div>
            <div className="cal-week-tasks">
              {dayTasks.map((task) => {
                const color = categoryColors[task.category] ?? '#7DD3FC';
                return (
                  <div
                    key={task.id}
                    className="cal-week-task-card"
                    style={{ borderLeftColor: color }}
                    onClick={() => onTaskClick(dateStr)}
                  >
                    <span className="cal-week-task-title">{task.title}</span>
                    {task.description && (
                      <span className="cal-week-task-desc">{task.description}</span>
                    )}
                    <span
                      className="cal-week-task-badge"
                      style={{ background: color + '33', color }}
                    >
                      {CATEGORY_VI[task.category] ?? task.category}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
