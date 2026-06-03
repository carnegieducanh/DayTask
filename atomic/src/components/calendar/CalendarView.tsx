import { useEffect, useState } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from "date-fns";
import AddTaskModal from "../today/AddTaskModal";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type { Task } from "../../types";
import WeekView from "./WeekView";
import MonthView from "./MonthView";

type CalViewType = "month" | "week";

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
    view === "month"
      ? language === "vi"
        ? format(currentDate, "'Tháng' M, yyyy")
        : format(currentDate, "MMMM yyyy")
      : `${format(weekStart, "d/MM")} – ${format(weekEnd, "d/MM, yyyy")}`;

  return (
    <div className="cal-toolbar">
      <button
        className="cal-toolbar-btn"
        onClick={() => setCurrentDate(new Date())}
      >
        {t.calendar.today}
      </button>
      <button
        className="cal-toolbar-btn"
        onClick={() =>
          setCurrentDate(
            view === "month"
              ? subMonths(currentDate, 1)
              : subWeeks(currentDate, 1),
          )
        }
      >
        ‹
      </button>
      <button
        className="cal-toolbar-btn"
        onClick={() =>
          setCurrentDate(
            view === "month"
              ? addMonths(currentDate, 1)
              : addWeeks(currentDate, 1),
          )
        }
      >
        ›
      </button>
      <span className="cal-toolbar-label">{label}</span>
      <button
        className={`cal-toolbar-btn${view === "month" ? " active" : ""}`}
        onClick={() => setView("month")}
      >
        {t.calendar.month}
      </button>
      <button
        className={`cal-toolbar-btn${view === "week" ? " active" : ""}`}
        onClick={() => setView("week")}
      >
        {t.calendar.week}
      </button>
    </div>
  );
}

export default function CalendarView() {
  const language = useAppStore((s) => s.language);
  const {
    calendarTasks,
    calendarTimeEntries,
    loadCalendarTasks,
    categoryColors,
    setSelectedDate,
    setActiveTab,
  } = useAppStore();

  const [view, setView] = useState<CalViewType>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loadedYear, setLoadedYear] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    const year = currentDate.getFullYear();
    if (year !== loadedYear) {
      loadCalendarTasks(`${year}-01-01`, `${year}-12-31`);
      setLoadedYear(year);
    }
  }, [currentDate, loadedYear, loadCalendarTasks]);

  return (
    <div className="cal-wrap">
      <CalToolbar
        view={view}
        setView={setView}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
      />
      {view === "month" && (
        <MonthView
          tasks={calendarTasks}
          currentDate={currentDate}
          categoryColors={categoryColors}
          onTaskClick={(task) => setEditingTask(task)}
          onDayClick={(date) => setSelectedDate(date)}
          timeEntries={calendarTimeEntries}
          language={language}
        />
      )}
      {view === "week" && (
        <WeekView
          tasks={calendarTasks}
          currentDate={currentDate}
          categoryColors={categoryColors}
          onTaskClick={(task) => setEditingTask(task)}
          onDayClick={(date) => {
            setSelectedDate(date);
            setActiveTab("today");
          }}
          timeEntries={calendarTimeEntries}
        />
      )}
      {editingTask && (
        <AddTaskModal
          editTask={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
