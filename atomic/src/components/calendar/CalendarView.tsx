import { useEffect, useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
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
import type { Category, Task } from "../../types";
import WeekView from "./WeekView";
import MonthView from "./MonthView";
import CalendarFilterSidebar from "./CalendarFilterSidebar";

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
    calendarTaskTags,
    loadCalendarTasks,
    categoryColors,
    tags,
    setSelectedDate,
    setActiveTab,
  } = useAppStore();

  const [view, setView] = useState<CalViewType>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loadedYear, setLoadedYear] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(new Set());
  const [activeTags, setActiveTags] = useState<Set<number>>(new Set());

  useEffect(() => {
    const year = currentDate.getFullYear();
    if (year !== loadedYear) {
      loadCalendarTasks(`${year}-01-01`, `${year}-12-31`);
      setLoadedYear(year);
    }
  }, [currentDate, loadedYear, loadCalendarTasks]);

  const visibleRange = useMemo(() => {
    if (view === "month") {
      return {
        startDate: format(startOfMonth(currentDate), "yyyy-MM-dd"),
        endDate: format(endOfMonth(currentDate), "yyyy-MM-dd"),
      };
    }
    return {
      startDate: format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      endDate: format(endOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    };
  }, [view, currentDate]);

  const filteredTasks = useMemo(() => {
    if (activeCategories.size === 0 && activeTags.size === 0) return calendarTasks;
    return calendarTasks.filter((task) => {
      const matchCat = activeCategories.size === 0 || activeCategories.has(task.category);
      const tagIds = calendarTaskTags[task.id] ?? [];
      const matchTag = activeTags.size === 0 || tagIds.some((id) => activeTags.has(id));
      return matchCat && matchTag;
    });
  }, [calendarTasks, calendarTaskTags, activeCategories, activeTags]);

  const toggleCategory = (cat: Category) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleTag = (tagId: number) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      next.has(tagId) ? next.delete(tagId) : next.add(tagId);
      return next;
    });
  };

  const resetFilter = () => {
    setActiveCategories(new Set());
    setActiveTags(new Set());
  };

  return (
    <div className="cal-wrap">
      <CalToolbar
        view={view}
        setView={setView}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
      />
      <div className="cal-body">
        <CalendarFilterSidebar
          tasks={calendarTasks}
          timeEntries={calendarTimeEntries}
          taskTags={calendarTaskTags}
          tags={tags}
          categoryColors={categoryColors}
          startDate={visibleRange.startDate}
          endDate={visibleRange.endDate}
          activeCategories={activeCategories}
          activeTags={activeTags}
          onToggleCategory={toggleCategory}
          onToggleTag={toggleTag}
          onReset={resetFilter}
        />
        <div className="cal-main">
          {view === "month" && (
            <MonthView
              tasks={filteredTasks}
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
              tasks={filteredTasks}
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
        </div>
      </div>
      {editingTask && (
        <AddTaskModal
          editTask={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
