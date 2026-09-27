import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { IconCheck } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type { Task, TaskTimeEntry } from "../../types";

const MAX_BLOCKS_PER_DAY = 3;
// Same timing as the old Today Pending list: collapse runs 600ms, the task
// flips to done once it's gone.
const COLLAPSE_MS = 640;

type DayItem = { task: Task; entry: TaskTimeEntry };

// Margin that cancels the flex gap next to a block, so a 0-height block takes
// no space at all while it collapses / grows.
function gapKeyframes(el: HTMLElement): [Keyframe, Keyframe] {
  const gap = parseFloat(getComputedStyle(el.parentElement!).rowGap) || 0;
  const side = el.nextElementSibling ? "marginBottom" : el.previousElementSibling ? "marginTop" : null;
  return side ? [{ [side]: "0px" }, { [side]: `${-gap}px` }] : [{}, {}];
}

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
  const blockEls = useRef(new Map<number, HTMLElement>());
  const prevPos = useRef(new Map<number, { x: number; y: number }>());

  // Completing a pending block replays the old Pending-list exit: tick shows
  // at once, the block collapses + fades + drops 10px, then the task flips
  // and grows back in at its done spot. `collapsing` holds the fill:forwards
  // animations that keep the block hidden until that re-sorted render.
  // No prefers-reduced-motion opt-out (same as the rest of the app): Windows
  // with "Animation effects" off reports it, and that hid these entirely.
  const [checkingIds, setCheckingIds] = useState<Set<number>>(new Set());
  const collapsing = useRef(new Map<number, { el: HTMLElement; container: HTMLElement; anims: Animation[] }>());
  // Day columns keep their height while a block leaves and comes back, so
  // the page below the strip doesn't bounce.
  const heightLocks = useRef(new Map<HTMLElement, number>());

  function lockHeight(container: HTMLElement) {
    const n = heightLocks.current.get(container) ?? 0;
    if (n === 0) container.style.minHeight = `${container.offsetHeight}px`;
    heightLocks.current.set(container, n + 1);
  }
  function unlockHeight(container: HTMLElement) {
    const n = (heightLocks.current.get(container) ?? 1) - 1;
    if (n > 0) {
      heightLocks.current.set(container, n);
      return;
    }
    heightLocks.current.delete(container);
    container.style.minHeight = "";
  }

  function recordPositions(container: Element) {
    const strip = stripRef.current;
    if (!strip) return;
    const origin = strip.getBoundingClientRect();
    blockEls.current.forEach((el, id) => {
      if (el.parentElement !== container) return;
      const r = el.getBoundingClientRect();
      prevPos.current.set(id, { x: r.left - origin.left, y: r.top - origin.top });
    });
  }

  function handleTick(task: Task) {
    const el = blockEls.current.get(task.id);
    const container = el?.parentElement;
    if (task.is_done || !el || !container) {
      toggleTask(task.id);
      return;
    }
    if (collapsing.current.has(task.id)) return;

    setCheckingIds((prev) => new Set(prev).add(task.id));
    lockHeight(container);
    const [gapShown, gapHidden] = gapKeyframes(el);
    collapsing.current.set(task.id, {
      el,
      container,
      anims: [
        el.animate([{ height: `${el.offsetHeight}px`, ...gapShown }, { height: "0px", ...gapHidden }], {
          duration: 600,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          fill: "forwards",
        }),
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: "ease", fill: "forwards" }),
        el.animate([{ transform: "none" }, { transform: "translateY(10px)" }], {
          duration: 550,
          easing: "ease",
          fill: "forwards",
        }),
      ],
    });

    setTimeout(() => {
      // The collapse already slid the blocks below into place — start the
      // re-sort FLIP from here, not from where they were before the tick.
      recordPositions(container);
      toggleTask(task.id).finally(() => {
        // Next macrotask: the re-sorted render has committed by now.
        setTimeout(() => {
          const stuck = collapsing.current.get(task.id);
          if (stuck) {
            // Toggle failed (task still pending) — bring the block back.
            stuck.anims.forEach((a) => a.cancel());
            collapsing.current.delete(task.id);
            unlockHeight(stuck.container);
          }
          setCheckingIds((prev) => {
            const s = new Set(prev);
            s.delete(task.id);
            return s;
          });
        }, 0);
      });
    }, COLLAPSE_MS);
  }

  // FLIP: when a tick re-sorts a day, slide blocks from their old spot to the
  // new one instead of jumping. Positions are relative to the strip so page
  // scrolling between renders never reads as movement.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const origin = strip.getBoundingClientRect();
    const hadPrev = prevPos.current.size > 0;

    // Collapsed blocks whose task is now done: drop the hold so they can grow
    // back in at their new (bottom) spot. Ones re-sorted out of view behind
    // "+n" just end there.
    const doneIds = new Set<number>();
    for (const list of Object.values(byDay)) for (const { task } of list) if (task.is_done) doneIds.add(task.id);
    const growIn = new Map<number, HTMLElement>();
    const busy = new Set<Element>();
    collapsing.current.forEach(({ el: held, container, anims }, id) => {
      const el = blockEls.current.get(id);
      if (el === held && !doneIds.has(id)) {
        busy.add(container);
        return;
      }
      anims.forEach((a) => a.cancel());
      collapsing.current.delete(id);
      if (el === held && el.parentElement === container) growIn.set(id, container);
      else unlockHeight(container);
    });

    const next = new Map<number, { x: number; y: number }>();
    blockEls.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      const pos = { x: r.left - origin.left, y: r.top - origin.top };
      next.set(id, pos);
      const container = growIn.get(id);
      if (container) {
        const [gapShown, gapHidden] = gapKeyframes(el);
        el.animate(
          [
            { height: "0px", opacity: 0, transform: "translateY(-6px)", ...gapHidden },
            { height: `${r.height}px`, opacity: 1, transform: "none", ...gapShown },
          ],
          { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        ).finished.then(
          () => unlockHeight(container),
          () => unlockHeight(container),
        );
        return;
      }
      // Its day column is mid-collapse; the layout itself is moving there.
      if (el.parentElement && busy.has(el.parentElement)) return;
      const prev = prevPos.current.get(id);
      if (prev) {
        const dx = prev.x - pos.x;
        const dy = prev.y - pos.y;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
            duration: 450,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          });
        }
      } else if (hadPrev) {
        // A block that was hidden behind "+n" slides into view.
        el.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], {
          duration: 300,
          easing: "ease-out",
        });
      }
    });
    prevPos.current = next;
  });

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
                    ref={(el) => {
                      if (el) blockEls.current.set(task.id, el);
                      else blockEls.current.delete(task.id);
                    }}
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
