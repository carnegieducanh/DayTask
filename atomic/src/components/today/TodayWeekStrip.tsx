import { useEffect, useMemo, useRef } from "react";
import { addDays, format, startOfISOWeek } from "date-fns";
import { IconCheck } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type { Task, TaskTimeEntry } from "../../types";

const MAX_BLOCKS_PER_DAY = 3;

type DayItem = { task: Task; entry: TaskTimeEntry };

export default function TodayWeekStrip() {
  const t = useT();
  const {
    selectedDate,
    setSelectedDate,
    tasks,
    taskTimeEntries,
    calendarTasks,
    calendarTimeEntries,
    loadCalendarTasks,
    categoryColors,
    toggleTask,
  } = useAppStore();

  const weekStart = startOfISOWeek(new Date(selectedDate + "T00:00:00"));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const startStr = format(days[0], "yyyy-MM-dd");
  const endStr = format(days[6], "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Load whole year(s) like CalendarView does, so switching weeks inside the
  // same year doesn't re-query and Calendar tab's own load stays compatible.
  const loadedRange = useRef<{ start: string; end: string } | null>(null);
  useEffect(() => {
    const loaded = loadedRange.current;
    if (loaded && loaded.start <= startStr && loaded.end >= endStr) return;
    const start = `${startStr.slice(0, 4)}-01-01`;
    const end = `${endStr.slice(0, 4)}-12-31`;
    loadedRange.current = { start, end };
    loadCalendarTasks(start, end);
  }, [startStr, endStr, loadCalendarTasks]);

  // Selected day comes from tasks/taskTimeEntries (always fresh, includes
  // lazily-created repeat instances); other days from the calendar cache.
  const byDay = useMemo(() => {
    const map: Record<string, DayItem[]> = {};
    const push = (task: Task | undefined, entry: TaskTimeEntry) => {
      if (!task) return;
      if (!map[entry.date]) map[entry.date] = [];
      map[entry.date].push({ task, entry });
    };
    const calTaskById = new Map(calendarTasks.map((task) => [task.id, task]));
    for (const e of calendarTimeEntries) {
      if (e.date < startStr || e.date > endStr || e.date === selectedDate) continue;
      push(calTaskById.get(e.task_id), e);
    }
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    for (const e of taskTimeEntries) {
      if (e.date === selectedDate) push(taskById.get(e.task_id), e);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => a.entry.start_time.localeCompare(b.entry.start_time));
    }
    return map;
  }, [calendarTasks, calendarTimeEntries, tasks, taskTimeEntries, selectedDate, startStr, endStr]);

  return (
    <div className="today-week-strip">
      {days.map((d) => {
        const ds = format(d, "yyyy-MM-dd");
        const items = byDay[ds] ?? [];
        const shown = items.slice(0, MAX_BLOCKS_PER_DAY);
        const more = items.length - shown.length;
        return (
          <div
            key={ds}
            className={`tws-day${ds === selectedDate ? " selected" : ""}${ds === todayStr ? " today" : ""}`}
            onClick={() => ds !== selectedDate && setSelectedDate(ds)}
          >
            <div className="tws-head">
              <span className="tws-dow">{t.journal.dowShort[d.getDay()]}</span>
              <span className="tws-num">{d.getDate()}</span>
            </div>
            <div className="tws-blocks">
              {shown.map(({ task, entry }) => {
                const color = task.color ?? categoryColors[task.category];
                return (
                  <div
                    key={task.id}
                    className={`tws-block${task.is_done ? " done" : ""}`}
                    style={{ background: task.is_done ? `color-mix(in srgb, ${color} 40%, transparent)` : color }}
                    title={`${entry.start_time} - ${entry.end_time}  ${task.title}`}
                  >
                    {/* Same slide-out drawer idea as TaskCard's .task-drawer */}
                    <button
                      className="tws-block-drawer"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTask(task.id);
                      }}
                      title={task.is_done ? t.taskCard.markUndone : t.taskCard.markDone}
                    >
                      <IconCheck size={16} strokeWidth={3} />
                    </button>
                    <div className="tws-block-body">
                      <div className="tws-block-time">
                        {entry.start_time} - {entry.end_time}
                      </div>
                      <div className="tws-block-title">{task.title}</div>
                    </div>
                  </div>
                );
              })}
              {more > 0 && <div className="tws-more">{t.today.weekMore(more)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
