import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  IconCircleDashed,
  IconLoader,
  IconEye,
  IconCircleCheck,
  IconPlus,
} from "@tabler/icons-react";
import { useT } from "../../i18n";
import GoalCard from "./GoalCard";
import type { Goal, GoalStatus } from "../../types";

interface Props {
  status: GoalStatus;
  goals: Goal[];
  onEdit: (goal: Goal) => void;
  onAddGoal: (status: GoalStatus) => void;
}

const COL_STYLE: Record<GoalStatus, {
  icon: React.ReactNode;
  headerBg: string;
  badgeBg: string;
  badgeColor: string;
  titleColor: string;
}> = {
  todo: {
    icon: <IconCircleDashed size={14} />,
    headerBg: "var(--col-todo-bg)",
    badgeBg: "var(--col-todo-badge)",
    badgeColor: "var(--col-todo-title)",
    titleColor: "var(--col-todo-title)",
  },
  doing: {
    icon: <IconLoader size={14} />,
    headerBg: "var(--col-doing-bg)",
    badgeBg: "var(--col-doing-badge)",
    badgeColor: "var(--col-doing-title)",
    titleColor: "var(--col-doing-title)",
  },
  review: {
    icon: <IconEye size={14} />,
    headerBg: "var(--col-review-bg)",
    badgeBg: "var(--col-review-badge)",
    badgeColor: "var(--col-review-title)",
    titleColor: "var(--col-review-title)",
  },
  done: {
    icon: <IconCircleCheck size={14} />,
    headerBg: "var(--col-done-bg)",
    badgeBg: "var(--col-done-badge)",
    badgeColor: "var(--col-done-title)",
    titleColor: "var(--col-done-title)",
  },
};

export default function KanbanColumn({
  status,
  goals,
  onEdit,
  onAddGoal,
}: Props) {
  const t = useT();
  const cfg = COL_STYLE[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      className="kanban-column"
      style={{ outline: isOver ? `2px solid var(--primary)` : undefined }}
    >
      <div className="kanban-col-header">
        <div
          className="kanban-col-title"
          style={{
            color: cfg.titleColor,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {cfg.icon}
          {t.kanban.status[status]}
        </div>
        <span
          className="kanban-col-badge"
          style={{ background: cfg.badgeBg, color: cfg.badgeColor }}
        >
          {goals.length}
        </span>
      </div>

      <SortableContext
        items={goals.map((g) => g.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className="kanban-col-body"
          data-kanban-col={status}
        >
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} onEdit={onEdit} status={status} />
          ))}
          {goals.length === 0 && (
            <div className="kanban-empty">{t.kanban.emptyColumn}</div>
          )}
        </div>
      </SortableContext>

      <button className="kanban-add-btn" onClick={() => onAddGoal(status)}>
        <IconPlus size={14} />
        {t.kanban.addGoal}
      </button>
    </div>
  );
}
