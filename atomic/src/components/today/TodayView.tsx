import { useState, useEffect, useRef } from "react";
import { IconBulb } from "@tabler/icons-react";
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
    taskTimeEntries,
    categoryColors,
  } = useAppStore();

  const [showModal, setShowModal] = useState(false);
  const [streak, setStreak] = useState(0);
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

  return (
    <>
      <div className="today-wrap" ref={scrollRef}>
        <div className="today-page">
          {/* Masthead: date + quote | greeting | word of the day — scrolls with the page */}
          <header className="today-head">
            <div className="today-head-ear">
              <span className="today-eyebrow">{dateLabel}</span>
              <TodayHeroQuote />
            </div>

            <DailyGreeting pendingCount={pending.length} isToday={selectedDate === todayStr} />

            <div className="today-head-ear today-head-vocab">
              <VocabWidget noteStyle />
            </div>
          </header>

          {/* Clock flanked by the mini calendar and the to-do checklist */}
          <div className="today-hero-row">
            <div className="today-hero-side today-hero-left">
              <div className="today-glass today-side-card">
                <MiniCalendar />
              </div>
            </div>

            <TodayClockHero />

            <div className="today-hero-side today-hero-right">
              <div className="today-todo-purpose">
                <IconBulb size={14} />
                <span>{t.weeklyChecklist.purposeHint}</span>
              </div>
              <div className="today-glass today-side-card">
                <WeeklyChecklist selectedDate={selectedDate} />
              </div>
            </div>
          </div>

          {/* stats + activity heatmap | time by category | Hôm nay (thứ tự cột do
              grid-template-areas quyết định) — ngay dưới đồng hồ để lịch hôm nay nằm
              trong màn hình đầu; dải tuần xuống cuối */}
          <div className="today-glass today-agenda-panel">
            <TodayAgenda
              label={agendaLabel}
              isToday={selectedDate === todayStr}
              tasks={scheduledTasks}
              entries={taskTimeEntries}
              onAdd={openAdd}
            />
            <div className="today-agenda-divider today-agenda-divider-1" aria-hidden="true" />
            <div className="today-agenda-cats">
              <div className="today-col-head">
                <span className="today-col-title">{t.today.categoryStatsTitle}</span>
              </div>
              {dayStats.length > 0 || otherDayMins > 0 ? (
                <>
                  {dayStats.length > 0 && (
                    <DayStatsSection stats={dayStats} doneMins={dayDoneMins} totalMins={dayTotalMins} showCatDone hoverPopup={false} />
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
              <div className="today-col-head">
                <span className="today-col-title">{t.today.overviewTitle}</span>
              </div>
              <div className="today-figures">
                <div className="today-figure">
                  <span className="today-figure-label">{t.today.statDone}</span>
                  <span className="today-figure-value">
                    {doneCount}
                    <span className="today-figure-unit">/{total}</span>
                  </span>
                  <span className="today-progress">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                </div>
                <div className="today-figure">
                  <span className="today-figure-label">{t.today.statStreak}</span>
                  <span className="today-figure-value">{streak}</span>
                  <span className="today-figure-sub">{t.today.streakDays}</span>
                </div>
                <div className="today-figure">
                  <span className="today-figure-label">{t.today.statScheduled}</span>
                  <span className="today-figure-value">{scheduled}</span>
                  <span className="today-figure-sub">{t.today.scheduledToday}</span>
                </div>
              </div>
              <div className="today-activity">
                <span className="today-eyebrow">{t.today.activityTitle}</span>
                <MiniHeatmap data={heatmap} />
              </div>
            </div>
          </div>

          <TodayWeekStrip />
        </div>
      </div>

      {showModal && (
        <AddTaskModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
