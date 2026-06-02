import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconTrash, IconCalendarEvent } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type { Goal, GoalStatus } from "../../types";

const PROGRESS_COLOR: Record<GoalStatus, string> = {
  todo: "#888780",
  doing: "#3B9FE8",
  review: "#EF9F27",
  done: "#639922",
};

interface Props {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  status: GoalStatus;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function GoalCard({ goal, onEdit, status }: Props) {
  const t = useT();
  const { softDeleteGoal, checklistItems, categoryColors } = useAppStore();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: undefined,
  };

  const progressColor = PROGRESS_COLOR[status];
  const cardBg = hexToRgba(categoryColors[goal.category], 1);
  const items = checklistItems[goal.id] ?? [];
  const totalItems = items.length;
  const doneItems = items.filter((i) => i.is_done).length;
  const pct = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: cardBg }}
      className={`goal-card goal-card--colored${isDragging ? " goal-card-ghost" : ""}`}
      data-card-id={goal.id}
      {...listeners}
      {...attributes}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
        <div
          className="goal-card-body"
          style={{ flex: 1 }}
          onClick={() => onEdit(goal)}
        >
          <div className="goal-title">{goal.title}</div>
          {goal.description && (
            <div className="goal-desc">{goal.description}</div>
          )}

          {totalItems > 0 && (
            <div className="goal-checklist-progress">
              <div className="goal-progress-wrap" style={{ flex: 1 }}>
                <div
                  className="goal-progress-fill"
                  style={{ width: `${pct}%`, background: progressColor }}
                />
              </div>
              <span
                className="goal-progress-xy"
                style={{ color: progressColor }}
              >
                {doneItems}/{totalItems}
              </span>
            </div>
          )}

          <div className="goal-meta">
            <span className={`tag tag-${goal.category}`}>
              {t.cat[goal.category]}
            </span>
            <span className="goal-quarter">
              <IconCalendarEvent
                size={10}
                style={{ verticalAlign: "middle", marginRight: 2 }}
              />
              {t.quarterShort[goal.quarter]}
            </span>
          </div>
        </div>

        <button
          className="icon-btn goal-card-delete"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            softDeleteGoal(goal.id);
          }}
          title={t.kanban.deleteGoal}
        >
          <IconTrash size={14} />
        </button>
      </div>
    </div>
  );
}
