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
import { vi as viLocale } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import type { Task } from '../../types';
import WeekView from './WeekView';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { vi: viLocale },
});

interface CalEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  allDay: true;
  resource: Task;
}

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
  const t = useT();
  const language = useAppStore((s) => s.language);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const label =
    view === 'month'
      ? language === 'vi'
        ? format(currentDate, "'Tháng' M, yyyy")
        : format(currentDate, 'MMMM yyyy')
      : `${format(weekStart, 'd/MM')} – ${format(weekEnd, 'd/MM, yyyy')}`;

  return (
    <div className="cal-toolbar">
      <button className="cal-toolbar-btn" onClick={() => setCurrentDate(new Date())}>{t.calendar.today}</button>
      <button className="cal-toolbar-btn" onClick={() => setCurrentDate(view === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1))}>‹</button>
      <button className="cal-toolbar-btn" onClick={() => setCurrentDate(view === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1))}>›</button>
      <span className="cal-toolbar-label">{label}</span>
      <button
        className={`cal-toolbar-btn${view === 'month' ? ' active' : ''}`}
        onClick={() => setView('month')}
      >
        {t.calendar.month}
      </button>
      <button
        className={`cal-toolbar-btn${view === 'week' ? ' active' : ''}`}
        onClick={() => setView('week')}
      >
        {t.calendar.week}
      </button>
    </div>
  );
}

export default function CalendarView() {
  const t = useT();
  const language = useAppStore((s) => s.language);
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

  const messages = {
    allDay: t.calendar.allDay,
    previous: '‹',
    next: '›',
    today: t.calendar.today,
    month: t.calendar.month,
    week: t.calendar.week,
    noEventsInRange: t.calendar.noEvents,
    showMore: (n: number) => `+${n}`,
  };

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
          culture={language === 'vi' ? 'vi' : undefined}
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
