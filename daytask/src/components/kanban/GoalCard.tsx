import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical, IconX, IconCalendarEvent } from '@tabler/icons-react';
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
  doing:  '#185FA5',
  review: '#EF9F27',
  done:   '#639922',
};

interface Props {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  status: GoalStatus;
}

export default function GoalCard({ goal, onEdit, status }: Props) {
  const { deleteGoal, updateGoal } = useAppStore();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : status === 'done' ? 0.75 : 1,
  };

  const progressColor = PROGRESS_COLOR[status];

  return (
    <div ref={setNodeRef} style={style} className="goal-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        {/* Drag handle */}
        <div
          className="goal-drag-handle"
          {...listeners}
          {...attributes}
          title="Kéo để di chuyển"
        >
          <IconGripVertical size={14} />
        </div>

        {/* Card content */}
        <div className="goal-card-body" style={{ flex: 1 }} onClick={() => onEdit(goal)}>
          <div className="goal-title">{goal.title}</div>
          {goal.description && (
            <div className="goal-desc">{goal.description}</div>
          )}

          {/* Progress bar */}
          <div className="goal-progress-wrap">
            <div className="goal-progress-fill" style={{ width: `${goal.progress}%`, background: progressColor }} />
          </div>

          {/* Footer */}
          <div className="goal-meta">
            <span className={`tag tag-${goal.category}`}>{CAT_LABEL[goal.category]}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="goal-quarter">
                <IconCalendarEvent size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                {QUARTER_LABEL[goal.quarter]}
              </span>
              <span className="priority-dot" style={{
                background: goal.priority === 'high' ? 'var(--pri-high)'
                  : goal.priority === 'mid' ? 'var(--pri-mid)'
                  : 'var(--pri-low)',
              }} />
            </div>
          </div>
        </div>

        <button
          className="icon-btn"
          style={{ width: 22, height: 22, fontSize: 12, flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id); }}
          title="Xóa"
        >
          <IconX size={12} />
        </button>
      </div>

      {/* Progress slider */}
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={goal.progress}
        onChange={(e) => updateGoal(goal.id, { progress: Number(e.target.value) })}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', accentColor: progressColor, marginTop: 4 }}
        title={`Tiến độ: ${goal.progress}%`}
      />
    </div>
  );
}
