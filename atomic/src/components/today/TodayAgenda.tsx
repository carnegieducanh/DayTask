import { IconCheck, IconClock } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type { Task, TaskTimeEntry } from "../../types";

export default function TodayAgenda({
  label,
  tasks,
  entries,
  pendingCheckIds,
  onToggle,
}: {
  label: string;
  tasks: Task[];
  entries: TaskTimeEntry[];
  pendingCheckIds: Set<number>;
  onToggle: (taskId: number) => void;
}) {
  const t = useT();
  const categoryColors = useAppStore((s) => s.categoryColors);

  return (
    <div className="today-agenda">
      <span className="today-agenda-pill">{label}</span>
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
        <div className="today-panel-empty">{t.today.noScheduled}</div>
      )}
    </div>
  );
}
