import { useMemo, useRef } from "react";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type { Task, TaskTimeEntry } from "../../types";
import { useTickCollapse } from "./useTickCollapse";

export default function TodayAgenda({
  label,
  isToday,
  tasks,
  entries,
  onAdd,
}: {
  label: string;
  isToday: boolean;
  tasks: Task[];
  entries: TaskTimeEntry[];
  onAdd: () => void;
}) {
  const t = useT();
  const categoryColors = useAppStore((s) => s.categoryColors);

  const listRef = useRef<HTMLDivElement>(null);
  const doneIds = useMemo(() => new Set(tasks.filter((task) => task.is_done).map((task) => task.id)), [tasks]);
  const { checkingIds, blockRef, handleTick } = useTickCollapse(listRef, doneIds);

  return (
    <div className="today-agenda">
      <div className="today-col-head">
        <span className={`today-col-title${isToday ? " is-today" : ""}`}>{label}</span>
        <button className="today-add-btn" onClick={onAdd} title={t.today.addTask}>
          <IconPlus size={15} strokeWidth={2.25} />
        </button>
      </div>
      {tasks.length > 0 ? (
        <div className="today-agenda-list" ref={listRef}>
          {tasks.map((task) => {
            const entry = entries.find((e) => e.task_id === task.id);
            const color = task.color ?? categoryColors[task.category];
            const checked = !!task.is_done || checkingIds.has(task.id);
            // Same block as the week strip (.tws-block); the whole block ticks,
            // the drawer click just bubbles up.
            return (
              <div
                key={task.id}
                ref={blockRef(task.id)}
                className={`tws-block today-agenda-block${checked ? " done" : ""}`}
                style={{ background: checked ? `color-mix(in srgb, ${color} 40%, transparent)` : color }}
                onClick={() => handleTick(task)}
                title={task.is_done ? t.taskCard.markUndone : t.taskCard.markDone}
              >
                <button className="tws-block-drawer">
                  <IconCheck size={18} strokeWidth={3} />
                </button>
                <div className="tws-block-body">
                  <div className="tws-block-time">
                    {entry?.start_time} - {entry?.end_time}
                  </div>
                  <div className="tws-block-title">{task.title}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="today-empty" onClick={onAdd}>
          {t.today.emptyState}
        </div>
      )}
    </div>
  );
}
