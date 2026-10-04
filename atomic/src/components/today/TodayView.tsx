import { useState, useEffect, useRef } from "react";
import "./today.css";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";
import { format } from "date-fns";
import { vi as viLocale } from "date-fns/locale";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import { isTauri } from "../../store/mockDb";
import AddTaskModal from "./AddTaskModal";
import MiniHeatmap from "./MiniHeatmap";
import MiniCalendar from "./MiniCalendar";
import DailyGreeting from "./DailyGreeting";
import { WeeklyChecklist } from "./WeeklyChecklist";
import TodayClockHero from "./TodayClockHero";
import TodayWeekStrip from "./TodayWeekStrip";
import TodayAgenda from "./TodayAgenda";
import VocabWidget from "./VocabWidget";
import { TodayHeroQuote } from "./TodayHeroQuote";
import DayStatsSection from "../calendar/DayStatsSection";
import OtherStatsSection from "../calendar/OtherStatsSection";
import {
  calcRangeCategoryStats,
  calcOtherDayMins,
  calcDayDoneMins,
  calcWeekTotalMins,
} from "../calendar/calendarUtils";

export default function TodayView() {
  const t = useT();
  const {
    tasks,
    selectedDate,
    heatmap,
    loadHeatmap,
    language,
    getStreak,
    setReminderPopup,
    toggleTask,
    taskTimeEntries,
    categoryColors,
  } = useAppStore();

  const [showModal, setShowModal] = useState(false);
  const [streak, setStreak] = useState(0);
  const [pendingCheckIds, setPendingCheckIds] = useState<Set<number>>(new Set());
  const demoPopupShown = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(scrollRef);

  useEffect(() => {
    getStreak().then(setStreak);
  }, [tasks]);

  useEffect(() => {
    loadHeatmap(new Date().getFullYear());
  }, []);

  // Demo: show reminder popup once on browser (not Tauri)
  useEffect(() => {
    if (isTauri() || demoPopupShown.current || tasks.length === 0) return;
    const taskIds = new Set(taskTimeEntries.map((e) => e.task_id));
    const first = tasks.find((task) => !task.is_done && taskIds.has(task.id));
    if (!first) return;
    demoPopupShown.current = true;
    const timer = setTimeout(() => setReminderPopup(first), 1200);
    return () => clearTimeout(timer);
  }, [tasks, taskTimeEntries]);

  const habitTasks = tasks.filter((task) => task.category !== "other");
  const otherTasks = tasks.filter((task) => task.category === "other");
  const pending = tasks.filter((task) => !task.is_done && taskTimeEntries.some((e) => e.task_id === task.id));
  const doneCount = tasks.filter((task) => task.is_done && taskTimeEntries.some((e) => e.task_id === task.id)).length;
  const total = pending.length + doneCount;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const scheduled = taskTimeEntries.length;

  const dayStats = calcRangeCategoryStats(tasks, taskTimeEntries, selectedDate, selectedDate, categoryColors).filter(
    (s) => s.totalMins > 0 && s.category !== "other",
  );
  const otherDayMins = calcOtherDayMins(tasks, taskTimeEntries, selectedDate);
  const otherDoneMins = calcDayDoneMins(otherTasks, taskTimeEntries, selectedDate);
  const dayDoneMins = calcDayDoneMins(habitTasks, taskTimeEntries, selectedDate);
  const dayTotalMins = calcWeekTotalMins(habitTasks, taskTimeEntries, selectedDate, selectedDate);

  const scheduledTasks = tasks
    .filter((task) => taskTimeEntries.some((e) => e.task_id === task.id))
    .sort((a, b) => {
      if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
      const ea = taskTimeEntries.find((e) => e.task_id === a.id);
      const eb = taskTimeEntries.find((e) => e.task_id === b.id);
      return (ea?.start_time ?? "").localeCompare(eb?.start_time ?? "");
    });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const selectedDay = new Date(selectedDate + "T00:00:00");
  const agendaLabel =
    selectedDate === todayStr
      ? t.today.title
      : t.today.heroDate(t.journal.dowShort[selectedDay.getDay()], selectedDay.getDate(), selectedDay.getMonth() + 1);

  const dateLabel = format(
    new Date(selectedDate + "T00:00:00"),
    "EEEE, d MMMM yyyy",
    language === "vi" ? { locale: viLocale } : undefined,
  );

  function openAdd() {
    setShowModal(true);
  }

  // Agenda tick: show the check immediately, flip the task a beat later so
  // the tick animation plays before the item re-sorts into the done group.
  function handleScheduleToggle(taskId: number) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.is_done) {
      toggleTask(taskId);
      return;
    }

    setPendingCheckIds((prev) => new Set(prev).add(taskId));
    setTimeout(() => {
      toggleTask(taskId);
      setPendingCheckIds((prev) => {
        const s = new Set(prev);
        s.delete(taskId);
        return s;
      });
    }, 400);
  }

  return (
    <>
      {/* Topbar */}
      <div className="view-topbar today-topbar">
        <div className="today-topbar-side">
          <div className="view-subtitle" style={{ textTransform: "capitalize" }}>
            {dateLabel}
          </div>
          <TodayHeroQuote />
        </div>

        <DailyGreeting pendingCount={pending.length} isToday={selectedDate === todayStr} />

        <div className="today-topbar-side today-topbar-actions">
          <VocabWidget noteStyle />
        </div>
      </div>

      <div className="view-content today-content" ref={scrollRef}>
        <div className="today-stack">
          {/* Clock flanked by the mini calendar and the to-do checklist */}
          <div className="today-hero-row">
            <div className="today-hero-side today-hero-left">
              <div className="today-glass today-side-card">
                <MiniCalendar />
              </div>
            </div>

            <TodayClockHero />

            <div className="today-hero-side today-hero-right">
              <div className="today-glass today-side-card">
                <WeeklyChecklist selectedDate={selectedDate} />
              </div>
            </div>
          </div>

          <TodayWeekStrip />

          {/* Hôm nay | time by category | stats + activity heatmap */}
          <div className="today-glass today-agenda-panel">
            <TodayAgenda
              label={agendaLabel}
              tasks={scheduledTasks}
              entries={taskTimeEntries}
              pendingCheckIds={pendingCheckIds}
              onToggle={handleScheduleToggle}
              onAdd={openAdd}
            />
            <div className="today-agenda-divider today-agenda-divider-1" aria-hidden="true" />
            <div className="today-agenda-cats">
              <div className="section-label">{t.today.categoryStatsTitle}</div>
              {dayStats.length > 0 || otherDayMins > 0 ? (
                <>
                  {dayStats.length > 0 && (
                    <DayStatsSection stats={dayStats} doneMins={dayDoneMins} totalMins={dayTotalMins} showCatDone />
                  )}
                  {otherDayMins > 0 && (
                    <OtherStatsSection totalMins={otherDayMins} doneMins={otherDoneMins} hasBorderTop={dayStats.length > 0} />
                  )}
                </>
              ) : (
                <div className="today-panel-empty">{t.today.noScheduled}</div>
              )}
            </div>
            <div className="today-agenda-divider today-agenda-divider-2" aria-hidden="true" />
            <div className="today-agenda-stats">
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-label">{t.today.statDone}</div>
                  <div className="stat-value">
                    {doneCount}
                    <span className="stat-value-total">/{total}</span>
                  </div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">{t.today.statStreak}</div>
                  <div className="stat-value">🔥{streak}</div>
                  <div className="stat-sub">{t.today.streakDays}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">{t.today.statScheduled}</div>
                  <div className="stat-value">{scheduled}</div>
                  <div className="stat-sub">{t.today.scheduledToday}</div>
                </div>
              </div>
              <div>
                <div className="section-label">{t.today.activityTitle}</div>
                <MiniHeatmap data={heatmap} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <AddTaskModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
