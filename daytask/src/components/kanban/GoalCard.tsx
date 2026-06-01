import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconX, IconCalendarEvent } from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';
import type { Goal, GoalStatus } from '../../types';

const CAT_LABEL: Record<string, string> = {
  work: 'Công việc', personal: 'Cá nhân', health: 'Sức khỏe', learn: 'Học tập',
};

const QUARTER_LABEL: Record<string, string> = {
  Q1: 'Q1', Q2: 'Q2', Q3: 'Q3', Q4: 'Q4', full: 'Cả năm',
};

const PROGRESS_COLOR: Record<GoalStatus, string> = {
  todo:   '#888780',
  doing:  '#3B9FE8',
  review: '#EF9F27',
  done:   '#639922',
};

interface Props {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  status: GoalStatus;
}

export default function GoalCard({ goal, onEdit, status }: Props) {
  const { deleteGoal, checklistItems } = useAppStore();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: !isDragging && status === 'done' ? 0.75 : undefined,
  };

  const progressColor = PROGRESS_COLOR[status];
  const items = checklistItems[goal.id] ?? [];
  const totalItems = items.length;
  const doneItems = items.filter((i) => i.is_done).length;
  const pct = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`goal-card${isDragging ? ' goal-card-ghost' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <div className="goal-card-body" style={{ flex: 1 }} onClick={() => onEdit(goal)}>
          <div className="goal-title">{goal.title}</div>
          {goal.description && (
            <div className="goal-desc">{goal.description}</div>
          )}

          {/* Checklist progress bar (only when items exist) */}
          {totalItems > 0 && (
            <div className="goal-checklist-progress">
              <div className="goal-progress-wrap" style={{ flex: 1 }}>
                <div className="goal-progress-fill" style={{ width: `${pct}%`, background: progressColor }} />
              </div>
              <span className="goal-progress-xy" style={{ color: progressColor }}>
                {doneItems}/{totalItems}
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="goal-meta">
            <span className={`tag tag-${goal.category}`}>{CAT_LABEL[goal.category]}</span>
            <span className="goal-quarter">
              <IconCalendarEvent size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
              {QUARTER_LABEL[goal.quarter]}
            </span>
          </div>
        </div>

        <button
          className="icon-btn"
          style={{ width: 22, height: 22, fontSize: 13, flexShrink: 0 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); }}
          title="Xóa"
        >
          <IconX size={12} />
        </button>
      </div>
    </div>
  );
}
