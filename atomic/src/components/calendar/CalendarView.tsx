import { useEffect, useMemo, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
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
  addDays,
  subDays,
} from "date-fns";
import AddTaskModal from "../today/AddTaskModal";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type { Category, Task } from "../../types";
import WeekView from "./WeekView";
import MonthView from "./MonthView";
import DayView from "./DayView";
import CalendarFilterSidebar from "./CalendarFilterSidebar";
import MiniCalendar from "../today/MiniCalendar";
import VocabWidget from "../today/VocabWidget";
import DayStatsSection from "./DayStatsSection";
import OtherStatsSection from "./OtherStatsSection";
import { calcDayStats, calcOtherDayMins } from "./calendarUtils";

type CalViewType = "day" | "week" | "month";

const VI_DAY_NAMES = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

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
    view === "day"
      ? language === "vi"
        ? `${VI_DAY_NAMES[currentDate.getDay()]}, ${format(currentDate, "d/MM/yyyy")}`
        : format(currentDate, "EEEE, MMMM d, yyyy")
      : view === "month"
      ? language === "vi"
        ? format(currentDate, "'Tháng' M, yyyy")
        : format(currentDate, "MMMM yyyy")
      : `${format(weekStart, "d/MM")} – ${format(weekEnd, "d/MM, yyyy")}`;

  function handlePrev() {
    if (view === "day") setCurrentDate(subDays(currentDate, 1));
    else if (view === "month") setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  }

  function handleNext() {
    if (view === "day") setCurrentDate(addDays(currentDate, 1));
    else if (view === "month") setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  }

  return (
    <div className="cal-toolbar">
      <div className="cal-toolbar-views">
        <button
          className={`cal-toolbar-btn cal-view-btn${view === "day" ? " active" : ""}`}
          onClick={() => setView("day")}
        >
          {t.calendar.day}
        </button>
        <button
          className={`cal-toolbar-btn cal-view-btn${view === "week" ? " active" : ""}`}
          onClick={() => setView("week")}
        >
          {t.calendar.week}
        </button>
        <button
          className={`cal-toolbar-btn cal-view-btn${view === "month" ? " active" : ""}`}
          onClick={() => setView("month")}
        >
          {t.calendar.month}
        </button>
      </div>
      <div className="cal-toolbar-nav">
        <button className="cal-toolbar-btn cal-nav-arrow" onClick={handlePrev}><IconChevronLeft size={32} stroke={3} /></button>
        <button className="cal-toolbar-btn cal-nav-arrow" onClick={handleNext}><IconChevronRight size={32} stroke={3} /></button>
        <span className="cal-toolbar-label">{label}</span>
        <button
          className="cal-toolbar-btn cal-today-btn"
          onClick={() => setCurrentDate(new Date())}
        >
          {t.calendar.today}
        </button>
      </div>
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
    selectedDate,
    setSelectedDate,
    setActiveTab,
  } = useAppStore();

  const [view, setView] = useState<CalViewType>("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loadedYear, setLoadedYear] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [highlightDate, setHighlightDate] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(new Set());
  const [activeTags, setActiveTags] = useState<Set<number>>(new Set());
  useEffect(() => {
    const year = currentDate.getFullYear();
    if (year !== loadedYear) {
      loadCalendarTasks(`${year}-01-01`, `${year}-12-31`);
      setLoadedYear(year);
    }
  }, [currentDate, loadedYear, loadCalendarTasks]);

  // On mount: if day view and store's selectedDate differs from currentDate, reload tasks
  useEffect(() => {
    if (view === "day") {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      if (dateStr !== selectedDate) {
        setSelectedDate(dateStr);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync selectedDate → currentDate when MiniCalendar is clicked in Day view
  useEffect(() => {
    if (view !== "day") return;
    const d = new Date(selectedDate + "T00:00:00");
    if (format(d, "yyyy-MM-dd") !== format(currentDate, "yyyy-MM-dd")) {
      setCurrentDate(d);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // When switching to Day view, sync currentDate → selectedDate so tasks are loaded
  function handleSetView(v: CalViewType) {
    setView(v);
    if (v === "day") {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      if (dateStr !== selectedDate) {
        setSelectedDate(dateStr);
      }
    }
  }

  // When navigating in Day view, also update selectedDate to load tasks for that day
  function handleSetCurrentDate(d: Date) {
    setCurrentDate(d);
    if (view === "day") {
      setSelectedDate(format(d, "yyyy-MM-dd"));
    }
  }

  const visibleRange = useMemo(() => {
    if (view === "month") {
      return {
        startDate: format(startOfMonth(currentDate), "yyyy-MM-dd"),
        endDate: format(endOfMonth(currentDate), "yyyy-MM-dd"),
      };
    }
    if (view === "week") {
      return {
        startDate: format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        endDate: format(endOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    // day
    const d = format(currentDate, "yyyy-MM-dd");
    return { startDate: d, endDate: d };
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

  const dayStats = calcDayStats(calendarTasks, calendarTimeEntries, selectedDate, categoryColors).filter(s => s.category !== 'other');
  const otherDayMins = calcOtherDayMins(calendarTasks, calendarTimeEntries, selectedDate);

  return (
    <div className="cal-wrap">
      <CalToolbar
        view={view}
        setView={handleSetView}
        currentDate={currentDate}
        setCurrentDate={handleSetCurrentDate}
      />
      <div className="cal-body">
        {view === "day" ? (
          <div className="cal-day-sidebar">
            <MiniCalendar />
            <div className="cal-day-sidebar-extras">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <DayStatsSection stats={dayStats} />
                  <OtherStatsSection totalMins={otherDayMins} hasBorderTop={dayStats.length > 0} />
                </div>
              </div>
              <div style={{ padding: "0 8px" }}>
                <VocabWidget noteStyle />
              </div>
            </div>
          </div>
        ) : (
          <CalendarFilterSidebar
            tasks={calendarTasks}
            filteredTasks={filteredTasks}
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
            view={view}
          />
        )}
        <div className="cal-main">
          {view === "month" && (
            <MonthView
              tasks={filteredTasks}
              currentDate={currentDate}
              categoryColors={categoryColors}
              onTaskClick={(task) => setEditingTask(task)}
              onDayClick={(dateStr) => {
                setCurrentDate(new Date(dateStr + 'T00:00:00'));
                setHighlightDate(dateStr);
                setView('week');
              }}
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
              highlightDate={highlightDate ?? undefined}
            />
          )}
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              onTaskClick={(task) => setEditingTask(task)}
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
