import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  IconCircleDashed,
  IconLoader,
  IconEye,
  IconCircleCheck,
  IconPlus,
} from '@tabler/icons-react';
import GoalCard from './GoalCard';
import type { Goal, GoalStatus } from '../../types';

const COL_CONFIG: Record<GoalStatus, {
  label: string;
  icon: React.ReactNode;
  headerBg: string;
  badgeBg: string;
  badgeColor: string;
  titleColor: string;
}> = {
  todo:   {
    label: 'Chưa bắt đầu',
    icon: <IconCircleDashed size={14} />,
    headerBg: 'var(--col-todo-bg)',
    badgeBg: 'var(--col-todo-badge)',
    badgeColor: '#444441',
    titleColor: '#444441',
  },
  doing:  {
    label: 'Đang thực hiện',
    icon: <IconLoader size={14} />,
    headerBg: 'var(--col-doing-bg)',
    badgeBg: 'var(--col-doing-badge)',
    badgeColor: '#0C447C',
    titleColor: '#0C447C',
  },
  review: {
    label: 'Đang review',
    icon: <IconEye size={14} />,
    headerBg: 'var(--col-review-bg)',
    badgeBg: 'var(--col-review-badge)',
    badgeColor: '#633806',
    titleColor: '#633806',
  },
  done:   {
    label: 'Hoàn thành',
    icon: <IconCircleCheck size={14} />,
    headerBg: 'var(--col-done-bg)',
    badgeBg: 'var(--col-done-badge)',
    badgeColor: '#27500A',
    titleColor: '#27500A',
  },
};

interface Props {
  status: GoalStatus;
  goals: Goal[];
  onEdit: (goal: Goal) => void;
  onAddGoal: (status: GoalStatus) => void;
}

export default function KanbanColumn({ status, goals, onEdit, onAddGoal }: Props) {
  const cfg = COL_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      className="kanban-column"
      style={{ outline: isOver ? `2px solid var(--primary)` : undefined }}
    >
      <div className="kanban-col-header" style={{ background: cfg.headerBg }}>
        <div className="kanban-col-title" style={{ color: cfg.titleColor, display: 'flex', alignItems: 'center', gap: 6 }}>
          {cfg.icon}
          {cfg.label}
        </div>
        <span className="kanban-col-badge" style={{ background: cfg.badgeBg, color: cfg.badgeColor }}>
          {goals.length}
        </span>
      </div>

      <SortableContext items={goals.map((g) => g.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="kanban-col-body">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} onEdit={onEdit} status={status} />
          ))}
          {goals.length === 0 && (
            <div className="kanban-empty">Không có mục tiêu nào</div>
          )}
        </div>
      </SortableContext>

      <button className="kanban-add-btn" onClick={() => onAddGoal(status)}>
        <IconPlus size={14} />
        Thêm mục tiêu
      </button>
    </div>
  );
}
