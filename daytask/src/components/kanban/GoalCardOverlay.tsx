import { IconGripVertical, IconCalendarEvent } from '@tabler/icons-react';
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
  doing:  '#125680',
  review: '#EF9F27',
  done:   '#639922',
};

interface Props {
  goal: Goal;
}

export default function GoalCardOverlay({ goal }: Props) {
  const { checklistItems } = useAppStore();
  const progressColor = PROGRESS_COLOR[goal.status];
  const items = checklistItems[goal.id] ?? [];
  const totalItems = items.length;
  const doneItems = items.filter((i) => i.is_done).length;
  const pct = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  return (
    <div className="goal-card goal-card-drag-overlay">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <div className="goal-drag-handle" style={{ cursor: 'grabbing' }}>
          <IconGripVertical size={14} />
        </div>
        <div className="goal-card-body" style={{ flex: 1 }}>
          <div className="goal-title">{goal.title}</div>
          {goal.description && (
            <div className="goal-desc">{goal.description}</div>
          )}
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
      </div>
    </div>
  );
}
