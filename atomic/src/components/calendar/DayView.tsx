import { useState, useRef, useEffect, useCallback } from "react";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";
import { format } from "date-fns";
import { IconTag, IconTrash, IconCheck, IconCalendarMinus } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";

const COLOR_PALETTE: string[] = [
  "#C05476",
  "#E3683E",
  "#D8BE5E",
  "#489160",
  "#6E72C3",
  "#A75ABA",
  "#D85675",
  "#DD7835",
  "#BCC256",
  "#429A8E",
  "#828BC2",
  "#957367",
  "#DA5234",
  "#E0963C",
  "#82AA57",
  "#4B99D2",
  "#AE9CCE",
  "#7C7C7C",
  "#D38179",
  "#E4B751",
  "#54AD7F",
  "#6489DF",
  "#A277AF",
  "#A3978B",
];
import { useT } from "../../i18n";
import AddTaskModal from "../today/AddTaskModal";
import type { Task, TaskTimeEntry } from "../../types";

const HOUR_HEIGHT = 72; // px per hour
const MIN_DRAG_DURATION = 15; // minimum minutes to trigger task creation
const DEFAULT_DURATION = 60; // default task duration in minutes for tasks without time entry
const DRAG_MOVE_THRESHOLD = 4; // px before a mousedown on a task is treated as a move
const MIN_RESIZE_DURATION = 15; // minimum minutes when resizing
const DECK_OFFSET = 28; // px each unscheduled card is offset from the one below
const CARD_HEIGHT = 52; // px height of each deck card
const MAX_DECK = 5; // max visible cards in deck

function timeToMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minToTime(min: number): string {
  const clamped = Math.max(0, Math.min(Math.round(min), 1439));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function minToPx(min: number): number {
  return (min / 60) * HOUR_HEIGHT;
}

function pxToMin(px: number): number {
  return (px / HOUR_HEIGHT) * 60;
}

const OVERLAP_OFFSET = 18; // px offset per overlap level

interface LayoutItem {
  task: Task;
  entry: TaskTimeEntry | null;
  startMin: number;
  endMin: number;
  zIndex: number;
  hasOverlapAbove: boolean;
  overlapLevel: number;
}

function computeLayout(tasks: Task[], entries: TaskTimeEntry[], date: string): LayoutItem[] {
  const items = tasks.map((task) => {
    const entry = entries.find((e) => e.task_id === task.id && e.date === date) ?? null;
    const startMin = entry ? timeToMin(entry.start_time) : 0;
    const rawEnd = entry ? timeToMin(entry.end_time) : startMin + DEFAULT_DURATION;
    return { task, entry, startMin, endMin: Math.min(rawEnd, 1440) };
  });

  if (items.length === 0) return [];

  // Sort by startMin; use task.id as stable tiebreaker
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.task.id - b.task.id);

  // Compute overlapLevel: each task gets level = max(level of overlapping predecessors) + 1
  const levels: number[] = new Array(sorted.length).fill(0);
  for (let i = 1; i < sorted.length; i++) {
    let maxPred = -1;
    for (let j = 0; j < i; j++) {
      if (sorted[j].startMin < sorted[i].endMin && sorted[i].startMin < sorted[j].endMin) {
        maxPred = Math.max(maxPred, levels[j]);
      }
    }
    levels[i] = maxPred >= 0 ? maxPred + 1 : 0;
  }

  return sorted.map((item, i) => {
    const hasOverlapAbove = sorted
      .slice(0, i)
      .some((prev) => prev.startMin < item.endMin && item.startMin < prev.endMin);
    return { ...item, zIndex: i + 1, hasOverlapAbove, overlapLevel: levels[i] };
  });
}

interface DragCreate {
  startMin: number;
  endMin: number;
  startY: number;
}

interface DragMove {
  taskId: number;
  task: Task;
  offsetPx: number;
  origStartMin: number;
  origEndMin: number;
  newStartMin: number;
  newEndMin: number;
  startClientY: number;
  moved: boolean;
}

interface DragResize {
  taskId: number;
  task: Task;
  entry: TaskTimeEntry | null;
  direction: "top" | "bottom";
  origStartMin: number;
  origEndMin: number;
  newStartMin: number;
  newEndMin: number;
}

interface DragDeckTask {
  taskId: number;
  task: Task;
  startMin: number; // -1 = cursor not yet on timeline
  endMin: number;
  cursorX: number;
  cursorY: number;
  cardWidth: number;
  grabOffsetX: number;
  grabOffsetY: number;
}

export default function DayView({
  currentDate,
  onTaskClick,
}: {
  currentDate: Date;
  onTaskClick: (task: Task) => void;
}) {
  const t = useT();
  const {
    tasks,
    taskTimeEntries,
    saveTimeEntry,
    deleteTimeEntry,
    softDeleteTask,
    updateTaskColor,
    categoryColors,
    tags,
    taskTags,
  } = useAppStore();
  const [creating, setCreating] = useState<{ startTime: string; endTime: string } | null>(null);
  const [pendingCreate, setPendingCreate] = useState<{ startMin: number; endMin: number } | null>(null);
  const [dragCreate, setDragCreate] = useState<DragCreate | null>(null);
  const [dragMove, setDragMove] = useState<DragMove | null>(null);
  const [dragResize, setDragResize] = useState<DragResize | null>(null);
  const [dragDeckTask, setDragDeckTask] = useState<DragDeckTask | null>(null);
  const [contextMenu, setContextMenu] = useState<{ taskId: number; task: Task; x: number; y: number } | null>(null);
  const [deckExpanded, setDeckExpanded] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(gridRef);

  const [currentTimeMin, setCurrentTimeMin] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const dateStr = format(currentDate, "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isToday = dateStr === todayStr;

  const dateEntries = taskTimeEntries.filter((e) => e.date === dateStr);
  const scheduledTaskIds = new Set(dateEntries.map((e) => e.task_id));
  const scheduledTasks = tasks.filter((t) => scheduledTaskIds.has(t.id));
  const unscheduledTasks = tasks.filter(
    (t) => !scheduledTaskIds.has(t.id) && t.is_done === 0 && t.id !== dragDeckTask?.taskId,
  );

  const layoutItems = computeLayout(scheduledTasks, taskTimeEntries, dateStr);

  const collapsedDeckCount = Math.min(MAX_DECK, unscheduledTasks.length);
  const collapsedDeckHeight = collapsedDeckCount > 0 ? CARD_HEIGHT + (collapsedDeckCount - 1) * DECK_OFFSET : 0;
  const expandedDeckHeight = unscheduledTasks.length > 0 ? CARD_HEIGHT + (unscheduledTasks.length - 1) * DECK_OFFSET : 0;
  const deckHeight = deckExpanded ? expandedDeckHeight : collapsedDeckHeight;
  const hiddenCount = deckExpanded ? 0 : Math.max(0, unscheduledTasks.length - MAX_DECK);
  const pendingCount = unscheduledTasks.length;

  // Update current-time indicator every minute
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setCurrentTimeMin(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Scroll to current time (−1h) or 08:00 when date changes
  useEffect(() => {
    if (!gridRef.current) return;
    const targetMin = isToday ? Math.max(0, currentTimeMin - 60) : 8 * 60;
    gridRef.current.scrollTop = minToPx(targetMin);
  }, [dateStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    function close() {
      setContextMenu(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setContextMenu(null);
    }
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  function handleTaskContextMenu(e: React.MouseEvent, task: Task) {
    e.preventDefault();
    e.stopPropagation();
    const MENU_W = 180;
    const MENU_H = 170;
    let x = e.clientX;
    let y = e.clientY;
    if (x + MENU_W > window.innerWidth) x = window.innerWidth - MENU_W - 8;
    if (y + MENU_H > window.innerHeight) y = window.innerHeight - MENU_H - 8;
    setContextMenu({ taskId: task.id, task, x, y });
  }

  function getRelY(clientY: number): number {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    return clientY - rect.top + gridRef.current.scrollTop;
  }

  // ── Drag-create: mousedown on the grid background ──
  function handleGridMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".day-task-block")) return;
    const y = getRelY(e.clientY);
    const startMin = Math.round(Math.max(0, Math.min(pxToMin(y), 1425)) / 15) * 15;
    setDragCreate({ startMin, endMin: startMin, startY: e.clientY });
    e.preventDefault();
  }

  // ── Drag-move: mousedown on a task block body ──
  function handleTaskMouseDown(e: React.MouseEvent, item: LayoutItem) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const y = getRelY(e.clientY);
    setDragMove({
      taskId: item.task.id,
      task: item.task,
      offsetPx: y - minToPx(item.startMin),
      origStartMin: item.startMin,
      origEndMin: item.endMin,
      newStartMin: item.startMin,
      newEndMin: item.endMin,
      startClientY: e.clientY,
      moved: false,
    });
    e.preventDefault();
  }

  // ── Drag-resize: mousedown on a resize handle ──
  function handleResizeMouseDown(e: React.MouseEvent, item: LayoutItem, direction: "top" | "bottom") {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setDragResize({
      taskId: item.task.id,
      task: item.task,
      entry: item.entry,
      direction,
      origStartMin: item.startMin,
      origEndMin: item.endMin,
      newStartMin: item.startMin,
      newEndMin: item.endMin,
    });
  }

  // ── Drag-deck: mousedown on an unscheduled card ──
  function handleDeckCardMouseDown(e: React.MouseEvent, task: Task) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragDeckTask({
      taskId: task.id,
      task,
      startMin: -1,
      endMin: -1,
      cursorX: e.clientX,
      cursorY: e.clientY,
      cardWidth: rect.width,
      grabOffsetX: e.clientX - rect.left,
      grabOffsetY: e.clientY - rect.top,
    });
  }

  // ── Global mouse-move and mouse-up handlers (window-level) ──
  const handleWindowMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragCreate) {
        const y = getRelY(e.clientY);
        const endMin = Math.round(Math.max(0, Math.min(pxToMin(y), 1440)) / 15) * 15;
        setDragCreate((prev) => (prev ? { ...prev, endMin: Math.max(endMin, prev.startMin + 15) } : null));
      }
      if (dragMove) {
        const dy = Math.abs(e.clientY - dragMove.startClientY);
        const y = getRelY(e.clientY);
        const duration = dragMove.origEndMin - dragMove.origStartMin;
        const rawStart = Math.max(0, Math.min(pxToMin(y - dragMove.offsetPx), 1440 - duration));
        const newStartMin = Math.round(rawStart / 15) * 15;
        setDragMove((prev) =>
          prev
            ? {
                ...prev,
                newStartMin,
                newEndMin: newStartMin + duration,
                moved: prev.moved || dy > DRAG_MOVE_THRESHOLD,
              }
            : null,
        );
      }
      if (dragResize) {
        const y = getRelY(e.clientY);
        const rawMin = Math.round(pxToMin(y) / 5) * 5; // snap to 5-min grid
        if (dragResize.direction === "bottom") {
          const newEndMin = Math.max(dragResize.newStartMin + MIN_RESIZE_DURATION, Math.min(rawMin, 1440));
          setDragResize((prev) => (prev ? { ...prev, newEndMin } : null));
        } else {
          const newStartMin = Math.min(dragResize.newEndMin - MIN_RESIZE_DURATION, Math.max(rawMin, 0));
          setDragResize((prev) => (prev ? { ...prev, newStartMin } : null));
        }
      }
      if (dragDeckTask) {
        const rect = gridRef.current?.getBoundingClientRect();
        if (!rect) return;
        const viewportY = e.clientY - rect.top;
        const cursorX = e.clientX;
        const cursorY = e.clientY;
        if (viewportY < 0) {
          // Cursor back above the grid (deck area) — reset placement, keep cursor pos
          setDragDeckTask((prev) => {
            if (!prev) return null;
            const next = { ...prev, cursorX, cursorY };
            return prev.startMin !== -1 ? { ...next, startMin: -1, endMin: -1 } : next;
          });
        } else {
          // Ghost follows cursor with fixed DEFAULT_DURATION height
          const y = getRelY(e.clientY);
          const startMin = Math.max(0, Math.min(Math.round(pxToMin(y) / 15) * 15, 1380));
          setDragDeckTask((prev) =>
            prev ? { ...prev, startMin, endMin: Math.min(startMin + DEFAULT_DURATION, 1440), cursorX, cursorY } : null,
          );
        }
      }
    },
    [dragCreate, dragMove, dragResize, dragDeckTask], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleWindowMouseUp = useCallback(async () => {
    if (dragCreate) {
      const { startMin, endMin } = dragCreate;
      if (endMin - startMin >= MIN_DRAG_DURATION) {
        const clampedEnd = Math.min(endMin, 1440);
        setPendingCreate({ startMin, endMin: clampedEnd });
        setCreating({
          startTime: minToTime(startMin),
          endTime: minToTime(clampedEnd),
        });
      }
      setDragCreate(null);
    }
    if (dragMove) {
      if (dragMove.moved) {
        if (dragMove.newStartMin !== dragMove.origStartMin) {
          await saveTimeEntry(dragMove.taskId, dateStr, minToTime(dragMove.newStartMin), minToTime(dragMove.newEndMin));
        }
      } else {
        onTaskClick(dragMove.task);
      }
      setDragMove(null);
    }
    if (dragResize) {
      if (dragResize.newStartMin !== dragResize.origStartMin || dragResize.newEndMin !== dragResize.origEndMin) {
        await saveTimeEntry(
          dragResize.taskId,
          dateStr,
          minToTime(dragResize.newStartMin),
          minToTime(dragResize.newEndMin),
        );
      }
      setDragResize(null);
    }
    if (dragDeckTask) {
      if (dragDeckTask.startMin !== -1) {
        await saveTimeEntry(
          dragDeckTask.taskId,
          dateStr,
          minToTime(dragDeckTask.startMin),
          minToTime(dragDeckTask.endMin),
        );
      }
      // else: card returns to deck naturally (dragDeckTask cleared)
      setDragDeckTask(null);
    }
  }, [dragCreate, dragMove, dragResize, dragDeckTask, dateStr, saveTimeEntry, onTaskClick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dragCreate && !dragMove && !dragResize && !dragDeckTask) return;
    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [dragCreate, dragMove, dragResize, dragDeckTask, handleWindowMouseMove, handleWindowMouseUp]);

  const tzOffset = -new Date().getTimezoneOffset() / 60;
  const tzLabel = `GMT${tzOffset >= 0 ? "+" : ""}${tzOffset}`;

  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const ghostTop = dragCreate ? minToPx(Math.min(dragCreate.startMin, dragCreate.endMin)) : 0;
  const ghostHeight = dragCreate ? Math.max(minToPx(Math.abs(dragCreate.endMin - dragCreate.startMin)), 4) : 0;

  return (
    <div className="day-view">
      {/* Unscheduled task deck — fixed row above the scrollable grid */}
      {unscheduledTasks.length > 0 && (
        <div className="day-deck-row" style={{ height: deckHeight + 28 }}>
          <div className="day-deck-gutter-spacer" />
          <div className="day-deck-events-area">
            <div className="day-deck-cards-clip" style={{ height: deckHeight }}>
              {unscheduledTasks.map((task, i) => {
                const color = task.color ?? categoryColors[task.category];
                return (
                  <div
                    key={task.id}
                    className="day-deck-card"
                    style={{
                      top: i * DECK_OFFSET,
                      zIndex: i + 1,
                      backgroundColor: color,
                      borderLeft: `3px solid ${color}`,
                    }}
                    onMouseDown={(e) => handleDeckCardMouseDown(e, task)}
                    onContextMenu={(e) => handleTaskContextMenu(e, task)}
                  >
                    <div className="day-task-title">{task.title}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="day-deck-info-strip">
            <span className="day-tz-label">{tzLabel}</span>
            {pendingCount > 0 && (
              <div className="day-pending-count">
                <span className="day-pending-dot" />
                {t.calendar.pendingTasks(pendingCount)}
              </div>
            )}
            {hiddenCount > 0 && (
              <div className="day-deck-badge" onClick={() => setDeckExpanded(true)}>
                +{hiddenCount}
              </div>
            )}
            {deckExpanded && unscheduledTasks.length > MAX_DECK && (
              <div className="day-deck-badge" onClick={() => setDeckExpanded(false)}>
                −
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className="day-grid"
        ref={gridRef}
        style={{
          cursor: dragCreate
            ? "ns-resize"
            : dragMove?.moved || dragDeckTask
              ? "grabbing"
              : dragResize
                ? "ns-resize"
                : "default",
        }}
      >
        {/* Time gutter */}
        <div className="day-gutter">
          {HOURS.map((h) => (
            <div key={h} className="day-gutter-slot">
              {h > 0 && <span className="day-hour-label">{`${String(h).padStart(2, "0")}:00`}</span>}
            </div>
          ))}
        </div>

        {/* Events column */}
        <div className="day-events-col" onMouseDown={handleGridMouseDown}>
          {/* Hour lines */}
          {HOURS.map((h) => (
            <div key={h} className="day-hour-line" style={{ top: minToPx(h * 60) }} />
          ))}
          {/* Half-hour lines */}
          {HOURS.map((h) => (
            <div key={`hh-${h}`} className="day-half-line" style={{ top: minToPx(h * 60 + 30) }} />
          ))}

          {/* Task blocks */}
          {layoutItems.map((item) => {
            const isMoving = dragMove?.taskId === item.task.id && dragMove.moved;
            const isResizing = dragResize?.taskId === item.task.id;
            const startMin = isMoving ? dragMove!.newStartMin : isResizing ? dragResize!.newStartMin : item.startMin;
            const endMin = isMoving ? dragMove!.newEndMin : isResizing ? dragResize!.newEndMin : item.endMin;
            const top = minToPx(startMin);
            const height = Math.max(minToPx(endMin - startMin), 22);
            const color = item.task.color ?? categoryColors[item.task.category];
            const tagIds = taskTags[item.task.id] ?? [];
            const taskTagObjects = tags.filter((t) => tagIds.includes(t.id));

            const isDragging = isMoving || isResizing;
            const level = isDragging ? 0 : item.overlapLevel;
            const leftPx = level * OVERLAP_OFFSET;

            return (
              <div
                key={item.task.id}
                className={`day-task-block${isMoving ? " dragging" : ""}${isResizing ? " resizing" : ""}`}
                style={{
                  top,
                  height,
                  left: `calc(0.5% + ${leftPx}px)`,
                  width: `calc(97% - ${leftPx}px)`,
                  backgroundColor: color,
                  borderLeft: `3px solid ${color}`,
                  zIndex: isMoving || isResizing ? 50 : item.zIndex,
                }}
                onMouseDown={(e) => handleTaskMouseDown(e, item)}
                onContextMenu={(e) => handleTaskContextMenu(e, item.task)}
              >
                {/* Top resize handle */}
                <div
                  className="day-resize-handle day-resize-handle-top"
                  onMouseDown={(e) => handleResizeMouseDown(e, item, "top")}
                />
                {height < 48 ? (
                  <div className="day-task-compact-row">
                    <div className="day-task-title">{item.task.title}</div>
                    {item.task.description && (
                      <span className="day-task-desc-inline">{item.task.description}</span>
                    )}
                    {item.entry && (
                      <span className="day-task-time">
                        {minToTime(startMin)} – {minToTime(endMin)}
                      </span>
                    )}
                    <span className={`tag tag-${item.task.category}`}>{t.cat[item.task.category]}</span>
                    {taskTagObjects.map((tag) => (
                      <span key={tag.id} className="task-tag-chip">
                        <IconTag size={10} style={{ flexShrink: 0 }} />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="day-task-title">{item.task.title}</div>
                    {item.task.description && (
                      <div className="day-task-desc">{item.task.description}</div>
                    )}
                    {height >= 34 && (
                      <div className="day-task-meta">
                        {item.entry && (
                          <span className="day-task-time">
                            {minToTime(startMin)} – {minToTime(endMin)}
                          </span>
                        )}
                        <span className={`tag tag-${item.task.category}`}>{t.cat[item.task.category]}</span>
                        {taskTagObjects.map((tag) => (
                          <span key={tag.id} className="task-tag-chip">
                            <IconTag size={10} style={{ flexShrink: 0 }} />
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {/* Bottom resize handle */}
                <div
                  className="day-resize-handle day-resize-handle-bottom"
                  onMouseDown={(e) => handleResizeMouseDown(e, item, "bottom")}
                />
              </div>
            );
          })}

          {/* Deck drag ghost — shows on timeline while dragging from deck */}
          {dragDeckTask && dragDeckTask.startMin !== -1 && (
            <div
              className="day-task-block"
              style={{
                top: minToPx(dragDeckTask.startMin),
                height: Math.max(minToPx(dragDeckTask.endMin - dragDeckTask.startMin), 22),
                left: "0.5%",
                width: "98%",
                backgroundColor: dragDeckTask.task.color ?? categoryColors[dragDeckTask.task.category],
                borderLeft: `3px solid ${dragDeckTask.task.color ?? categoryColors[dragDeckTask.task.category]}`,
                opacity: 0.8,
                zIndex: 100,
                cursor: "grabbing",
                pointerEvents: "none",
              }}
            >
              <div className="day-task-title">{dragDeckTask.task.title}</div>
              <div className="day-task-meta">
                <span className="day-task-time">
                  {minToTime(dragDeckTask.startMin)} – {minToTime(dragDeckTask.endMin)}
                </span>
              </div>
            </div>
          )}

          {/* Drag-create ghost */}
          {dragCreate &&
            dragCreate.endMin - dragCreate.startMin >= 2 &&
            (() => {
              const ghostColor = categoryColors["work"];
              const h = ghostHeight;
              return (
                <div
                  className="day-task-block"
                  style={{
                    top: ghostTop,
                    height: Math.max(h, 22),
                    left: "0.5%",
                    width: "98%",
                    backgroundColor: ghostColor,
                    borderLeft: `3px solid ${ghostColor}`,
                    opacity: 0.75,
                    zIndex: 5,
                    cursor: "ns-resize",
                    pointerEvents: "none",
                  }}
                >
                  <div className="day-task-title" style={{ fontStyle: "italic" }}>
                    {t.calendar.noTitle}
                  </div>
                  {h >= 34 && (
                    <div className="day-task-meta">
                      <span className="day-task-time">
                        {minToTime(dragCreate.startMin)} – {minToTime(dragCreate.endMin)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Pending-create preview block (shown while modal is open) */}
          {pendingCreate &&
            (() => {
              const color = categoryColors["work"];
              const h = minToPx(pendingCreate.endMin - pendingCreate.startMin);
              return (
                <div
                  className="day-task-block day-task-block-pending"
                  style={{
                    top: minToPx(pendingCreate.startMin),
                    height: Math.max(h, 22),
                    left: "0.5%",
                    width: "98%",
                    backgroundColor: color,
                    borderLeft: `3px solid ${color}`,
                    opacity: 0.85,
                    cursor: "default",
                    zIndex: 6,
                  }}
                >
                  <div className="day-task-title" style={{ fontStyle: "italic" }}>
                    {t.calendar.noTitle}
                  </div>
                  {h >= 34 && (
                    <div className="day-task-meta">
                      <span className="day-task-time">
                        {minToTime(pendingCreate.startMin)} – {minToTime(pendingCreate.endMin)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Current-time indicator — rendered last so it always appears above task blocks */}
          {isToday && (
            <div className="day-now-line" style={{ top: minToPx(currentTimeMin) }}>
              <div className="day-now-dot" />
            </div>
          )}
        </div>
      </div>

      {/* Floating cursor ghost — visible while dragging a deck card over the deck area */}
      {dragDeckTask && dragDeckTask.startMin === -1 && (
        <div
          style={{
            position: "fixed",
            left: dragDeckTask.cursorX - dragDeckTask.grabOffsetX,
            top: dragDeckTask.cursorY - dragDeckTask.grabOffsetY,
            width: dragDeckTask.cardWidth,
            height: CARD_HEIGHT,
            borderRadius: 4,
            padding: "3px 6px",
            fontSize: "0.88rem",
            overflow: "hidden",
            boxSizing: "border-box",
            userSelect: "none",
            boxShadow: "0 6px 20px rgba(0,0,0,0.32)",
            backgroundColor: dragDeckTask.task.color ?? categoryColors[dragDeckTask.task.category],
            borderLeft: `3px solid ${dragDeckTask.task.color ?? categoryColors[dragDeckTask.task.category]}`,
            opacity: 0.92,
            pointerEvents: "none",
            zIndex: 9999,
            transform: "rotate(-2deg) scale(1.03)",
          }}
        >
          <div className="day-task-title">{dragDeckTask.task.title}</div>
        </div>
      )}

      {contextMenu && (
        <div
          className="task-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {taskTimeEntries.some((e) => e.date === dateStr && e.task_id === contextMenu.taskId) && (
            <button
              className="day-context-item"
              onClick={() => {
                deleteTimeEntry(contextMenu.taskId, dateStr);
                setContextMenu(null);
              }}
            >
              <IconCalendarMinus size={16} />
              {t.calendar.removeFromCalendar}
            </button>
          )}
          <button
            className="day-context-item day-context-item-danger"
            onClick={() => {
              softDeleteTask(contextMenu.taskId);
              setContextMenu(null);
            }}
          >
            <IconTrash size={16} />
            {t.taskCard.delete}
          </button>
          <div className="task-context-divider" />
          <div className="task-context-colors">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                className="task-context-color-btn"
                style={{ backgroundColor: color }}
                onClick={() => {
                  if ((contextMenu.task.color ?? categoryColors[contextMenu.task.category]) !== color) {
                    updateTaskColor(contextMenu.task.category, color);
                  }
                  setContextMenu(null);
                }}
                title={color}
              >
                {(contextMenu.task.color ?? categoryColors[contextMenu.task.category]) === color && (
                  <IconCheck size={12} color="white" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {creating && (
        <AddTaskModal
          onClose={() => {
            setCreating(null);
            setPendingCreate(null);
          }}
          initialStartTime={creating.startTime}
          initialEndTime={creating.endTime}
        />
      )}
    </div>
  );
}
