import { useState, useMemo, useEffect } from 'react';
import { format, getDaysInMonth, getDay, addMonths, subMonths } from 'date-fns';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function MiniCalendar() {
  const { selectedDate, setSelectedDate } = useAppStore();

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Sync calendar view when selectedDate changes externally (e.g. topbar datepicker)
  useEffect(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    if (d.getMonth() !== viewDate.getMonth() || d.getFullYear() !== viewDate.getFullYear()) {
      setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [selectedDate]);

  const { cells, startOffset } = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    // Convert Sunday=0 to Monday=0 offset
    const offset = (getDay(firstDay) + 6) % 7;
    const daysInMonth = getDaysInMonth(viewDate);

    const allCells: Date[] = [];
    const gridStart = new Date(year, month, 1 - offset);
    for (let i = 0; i < 42; i++) {
      allCells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
    }
    return { cells: allCells, startOffset: offset };
  }, [viewDate]);

  // Trim to 5 rows if month fits, else keep 6
  const visibleCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewDate);
    const needed = startOffset + daysInMonth;
    const rows = needed <= 35 ? 5 : 6;
    return cells.slice(0, rows * 7);
  }, [cells, startOffset, viewDate]);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const selectedD = useMemo(() => new Date(selectedDate + 'T00:00:00'), [selectedDate]);

  function isSame(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  return (
    <div className="mini-calendar">
      <div className="mini-cal-header">
        <button className="mini-cal-nav" onClick={() => setViewDate(subMonths(viewDate, 1))}>
          <IconChevronLeft size={13} />
        </button>
        <span className="mini-cal-month">
          {format(viewDate, 'MMMM yyyy')}
        </span>
        <button className="mini-cal-nav" onClick={() => setViewDate(addMonths(viewDate, 1))}>
          <IconChevronRight size={13} />
        </button>
      </div>

      <div className="mini-cal-grid">
        {DOW.map((d, i) => (
          <div key={i} className="mini-cal-dow">{d}</div>
        ))}
        {visibleCells.map((day, i) => {
          const ds = format(day, 'yyyy-MM-dd');
          const isToday = isSame(day, today);
          const isSelected = isSame(day, selectedD);
          const isCurrentMonth = day.getMonth() === viewDate.getMonth();

          return (
            <button
              key={i}
              className={[
                'mini-cal-day',
                isSelected ? 'selected' : isToday ? 'today' : '',
                !isCurrentMonth ? 'other-month' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDate(ds)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
