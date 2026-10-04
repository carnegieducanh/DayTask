import { IconCheck, IconClock, IconPlus, IconSun } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type { Task, TaskTimeEntry } from "../../types";

export default function TodayAgenda({
  label,
  tasks,
  entries,
  pendingCheckIds,
  onToggle,
  onAdd,
}: {
  label: string;
  tasks: Task[];
  entries: TaskTimeEntry[];
  pendingCheckIds: Set<number>;
  onToggle: (taskId: number) => void;
  onAdd: () => void;
}) {
  const t = useT();
  const categoryColors = useAppStore((s) => s.categoryColors);

  return (
    <div className="today-agenda">
      <div className="today-agenda-header">
        <span className="today-agenda-pill">{label}</span>
        <button className="today-todo-add-btn" onClick={onAdd} title={t.today.addTask}>
          <IconPlus size={16} />
        </button>
      </div>
      {tasks.length > 0 ? (
        <div className="today-agenda-list">
          {tasks.map((task) => {
            const entry = entries.find((e) => e.task_id === task.id);
            const checked = !!task.is_done || pendingCheckIds.has(task.id);
            return (
              <div
                key={task.id}
                className={`today-agenda-item${checked ? " done" : ""}`}
                onClick={() => onToggle(task.id)}
                title={task.is_done ? t.taskCard.markUndone : t.taskCard.markDone}
              >
                <span
                  className="today-agenda-bar"
                  style={{ background: task.color ?? categoryColors[task.category] }}
                />
                <div className="today-agenda-body">
                  <div className="today-agenda-title">{task.title}</div>
                  <div className="today-agenda-time">
                    <IconClock size="0.85em" />
                    {entry?.start_time} - {entry?.end_time}
                  </div>
                </div>
                <button
                  className={`today-schedule-tick${checked ? " checked" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(task.id);
                  }}
                >
                  <IconCheck size={12} strokeWidth={3} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="today-empty" onClick={onAdd}>
          <IconSun size={28} />
          <div>{t.today.emptyState}</div>
        </div>
      )}
    </div>
  );
}
