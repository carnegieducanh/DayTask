import { useEffect, useMemo, useRef } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { IconCheck } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type { Task, TaskTimeEntry } from "../../types";
import { UndoArrowIcon } from "./icons";
import { useTickCollapse } from "./useTickCollapse";

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
  } = useAppStore();

  // Sunday-first, same as the Calendar tab's week view.
  const weekStart = startOfWeek(new Date(selectedDate + "T00:00:00"), { weekStartsOn: 0 });
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

  // Calendar cache covers every day; tasks/taskTimeEntries (the loaded day)
  // override it since they're fresher and include lazily-created repeat
  // instances. Merging instead of switching sources per day means a newly
  // selected day never flashes empty while its tasks are still loading.
  const byDay = useMemo(() => {
    const map: Record<string, DayItem[]> = {};
    const taskById = new Map(calendarTasks.map((task) => [task.id, task]));
    for (const task of tasks) taskById.set(task.id, task);
    const seen = new Set<string>();
    for (const e of [...taskTimeEntries, ...calendarTimeEntries]) {
      if (e.date < startStr || e.date > endStr) continue;
      const key = `${e.task_id}|${e.date}`;
      const task = taskById.get(e.task_id);
      if (seen.has(key) || !task) continue;
      seen.add(key);
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push({ task, entry: e });
    }
    // Pending first, done sink to the bottom; each group by start time.
    for (const list of Object.values(map)) {
      list.sort(
        (a, b) =>
          Number(!!a.task.is_done) - Number(!!b.task.is_done) ||
          a.entry.start_time.localeCompare(b.entry.start_time),
      );
    }
    return map;
  }, [calendarTasks, calendarTimeEntries, tasks, taskTimeEntries, startStr, endStr]);

  const stripRef = useRef<HTMLDivElement>(null);
  const doneIds = useMemo(() => {
    const ids = new Set<number>();
    for (const list of Object.values(byDay)) for (const { task } of list) if (task.is_done) ids.add(task.id);
    return ids;
  }, [byDay]);
  const { checkingIds, blockRef, handleTick } = useTickCollapse(stripRef, doneIds);

  return (
    <div className="today-week-strip" ref={stripRef}>
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
                const checked = !!task.is_done || checkingIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    ref={blockRef(task.id)}
                    className={`tws-block${checked ? " done" : ""}`}
                    style={{ background: checked ? `color-mix(in srgb, ${color} 40%, transparent)` : color }}
                    title={`${entry.start_time} - ${entry.end_time}  ${task.title}`}
                  >
                    {/* Same slide-out drawer idea as TaskCard's .task-drawer */}
                    <button
                      className="tws-block-drawer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTick(task);
                      }}
                      title={task.is_done ? t.taskCard.markUndone : t.taskCard.markDone}
                    >
                      {/* Done tasks show an undo arrow — clicking un-ticks. Keyed on is_done, not
                          `checked`, so a task being ticked still pops the check while it collapses. */}
                      {task.is_done ? (
                        <UndoArrowIcon size={16} />
                      ) : (
                        <IconCheck size={16} strokeWidth={3} />
                      )}
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
