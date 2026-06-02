import { useCallback, useEffect, useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import {
  format,
  parse,
  startOfWeek,
  endOfWeek,
  getDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useAppStore } from '../../store/appStore';
import type { Task } from '../../types';
import WeekView from './WeekView';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { vi },
});

interface CalEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  allDay: true;
  resource: Task;
}

const messages = {
  allDay: 'Cả ngày',
  previous: '‹',
  next: '›',
  today: 'Hôm nay',
  month: 'Tháng',
  week: 'Tuần',
  noEventsInRange: 'Không có task nào trong khoảng này.',
  showMore: (n: number) => `+${n}`,
};

type CalViewType = 'month' | 'week';

function MonthEvent({ event }: { event: object }) {
  const e = event as CalEvent;
  const color = useAppStore.getState().categoryColors[e.resource.category] ?? '#7DD3FC';
  return (
    <span className="cal-month-event">
      <span className="cal-month-dot" style={{ background: color }} />
      <span className="cal-month-title">{e.title}</span>
    </span>
  );
}

function CalToolbar({
  view,
  setView,
  currentDate,
  setCurrentDate,
}: {
  view: CalViewType;
  setView: (v: CalViewType) => void;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const label =
    view === 'month'
      ? format(currentDate, "'Tháng' M, yyyy")
      : `${format(weekStart, 'd/MM')} – ${format(weekEnd, 'd/MM, yyyy')}`;

  function goToday() {
    setCurrentDate(new Date());
  }
  function goPrev() {
    setCurrentDate(view === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));
  }
  function goNext() {
    setCurrentDate(view === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));
  }

  return (
    <div className="cal-toolbar">
      <button className="cal-toolbar-btn" onClick={goToday}>Hôm nay</button>
      <button className="cal-toolbar-btn" onClick={goPrev}>‹</button>
      <button className="cal-toolbar-btn" onClick={goNext}>›</button>
      <span className="cal-toolbar-label">{label}</span>
      <button
        className={`cal-toolbar-btn${view === 'month' ? ' active' : ''}`}
        onClick={() => setView('month')}
      >
        Tháng
      </button>
      <button
        className={`cal-toolbar-btn${view === 'week' ? ' active' : ''}`}
        onClick={() => setView('week')}
      >
        Tuần
      </button>
    </div>
  );
}

export default function CalendarView() {
  const { calendarTasks, loadCalendarTasks, categoryColors, setActiveTab, setSelectedDate } =
    useAppStore();

  const [view, setView] = useState<CalViewType>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loadedYear, setLoadedYear] = useState<number | null>(null);

  useEffect(() => {
    const year = currentDate.getFullYear();
    if (year !== loadedYear) {
      loadCalendarTasks(`${year}-01-01`, `${year}-12-31`);
      setLoadedYear(year);
    }
  }, [currentDate, loadedYear, loadCalendarTasks]);

  const events: CalEvent[] = calendarTasks.map((task) => {
    const d = new Date(task.date + 'T00:00:00');
    return { id: task.id, title: task.title, start: d, end: d, allDay: true, resource: task };
  });

  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handleSelectEvent = useCallback(
    (event: object) => {
      const e = event as CalEvent;
      setSelectedDate(e.resource.date);
      setActiveTab('today');
    },
    [setSelectedDate, setActiveTab]
  );

  const handleSelectSlot = useCallback(
    ({ start }: { start: Date }) => {
      setSelectedDate(format(start, 'yyyy-MM-dd'));
      setActiveTab('today');
    },
    [setSelectedDate, setActiveTab]
  );

  const eventPropGetter = useCallback(() => {
    return {
      style: { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' },
    };
  }, []);

  return (
    <div className="cal-wrap">
      <CalToolbar
        view={view}
        setView={setView}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
      />
      {view === 'month' && (
        <Calendar
          localizer={localizer}
          events={events}
          views={['month']}
          view="month"
          date={currentDate}
          toolbar={false}
          onNavigate={handleNavigate}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          culture="vi"
          messages={messages}
          components={{ event: MonthEvent }}
          eventPropGetter={eventPropGetter}
          popup
        />
      )}
      {view === 'week' && (
        <WeekView
          tasks={calendarTasks}
          currentDate={currentDate}
          categoryColors={categoryColors}
          onTaskClick={(date) => {
            setSelectedDate(date);
            setActiveTab('today');
          }}
          onDayClick={(date) => {
            setSelectedDate(date);
            setActiveTab('today');
          }}
        />
      )}
    </div>
  );
}
