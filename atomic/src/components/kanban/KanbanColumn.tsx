import { useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { IconPlus } from "@tabler/icons-react";
import { useT } from "../../i18n";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";
import GoalCard from "./GoalCard";
import type { Goal, GoalStatus } from "../../types";

interface Props {
  status: GoalStatus;
  goals: Goal[];
  onEdit: (goal: Goal) => void;
  onAddGoal: (status: GoalStatus) => void;
}

// Số La Mã đầu cột — phong cách "biên niên" giống tab Tầm nhìn
const NUMERAL: Record<GoalStatus, string> = {
  todo: "I",
  doing: "II",
  done: "III",
};

export default function KanbanColumn({
  status,
  goals,
  onEdit,
  onAddGoal,
}: Props) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const bodyRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(bodyRef);

  return (
    <div className={`kanban-column${isOver ? " is-over" : ""}`}>
      <div className="kanban-col-header">
        <span className="kanban-col-numeral">{NUMERAL[status]}</span>
        <h2 className="kanban-col-title">{t.kanban.status[status]}</h2>
        <span className="kanban-col-count">{String(goals.length).padStart(2, "0")}</span>
      </div>

      <SortableContext
        items={goals.map((g) => g.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={(node) => {
            setNodeRef(node);
            bodyRef.current = node;
          }}
          className="kanban-col-body"
          data-kanban-col={status}
        >
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} onEdit={onEdit} />
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
