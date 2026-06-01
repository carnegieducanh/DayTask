import { useState, useEffect } from 'react';
import { IconGripHorizontal } from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';
import KanbanColumn from './KanbanColumn';
import AddGoalModal from './AddGoalModal';
import type { Goal, GoalStatus } from '../../types';

interface Props {
  liveGoals?: Goal[] | null;
}

const STATUSES: GoalStatus[] = ['todo', 'doing', 'review', 'done'];

const STATUS_CONFIG: Record<GoalStatus, { label: string; dot: string }> = {
  todo:   { label: 'Chưa bắt đầu',  dot: '#888780' },
  doing:  { label: 'Đang thực hiện', dot: '#3B9FE8' },
  review: { label: 'Đang review',    dot: '#EF9F27' },
  done:   { label: 'Hoàn thành',     dot: '#639922' },
};

export default function KanbanView({ liveGoals }: Props) {
  const { goals, openAddGoalModal, setOpenAddGoalModal } = useAppStore();
  const displayGoals = liveGoals ?? goals;
  const [showModal, setShowModal]         = useState(false);
  const [editGoal, setEditGoal]           = useState<Goal | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<GoalStatus>('todo');

  const total   = goals.length;
  const done    = goals.filter((g) => g.status === 'done').length;
  const yearPct = total === 0 ? 0 : Math.round((done / total) * 100);

  // Watch for add trigger from top nav
  useEffect(() => {
    if (openAddGoalModal) {
      setEditGoal(null);
      setDefaultStatus('todo');
      setShowModal(true);
      setOpenAddGoalModal(false);
    }
  }, [openAddGoalModal, setOpenAddGoalModal]);

  function openAdd(status: GoalStatus) {
    setEditGoal(null);
    setDefaultStatus(status);
    setShowModal(true);
  }

  function openEdit(goal: Goal) {
    setEditGoal(goal);
    setShowModal(true);
  }

  return (
    <>
      {/* Stats bar */}
      <div className="kanban-stats-bar">
        {STATUSES.map((s) => (
          <div key={s} className="kanban-stat-item">
            {STATUS_CONFIG[s].label}
            <span className="kanban-stat-num">{goals.filter((g) => g.status === s).length}</span>
          </div>
        ))}
        <div className="kanban-progress-wrap">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Tiến độ năm</span>
          <div className="kanban-prog-track">
            <div className="kanban-prog-fill" style={{ width: `${yearPct}%` }} />
          </div>
          <span className="kanban-prog-pct">{yearPct}%</span>
        </div>
      </div>

      {/* Drag hint */}
      <div className="kanban-drag-hint">
        <IconGripHorizontal size={13} />
        Kéo thả task giữa các cột để cập nhật trạng thái
      </div>

      {/* Kanban board — DndContext + DragOverlay sống ở App.tsx (ngoài scale wrapper) */}
      <div className="kanban-board">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            goals={displayGoals.filter((g) => g.status === status).sort((a, b) => a.position - b.position)}
            onEdit={openEdit}
            onAddGoal={openAdd}
          />
        ))}
      </div>

      {showModal && (
        <AddGoalModal
          editGoal={editGoal}
          defaultStatus={defaultStatus}
          onClose={() => { setShowModal(false); setEditGoal(null); }}
        />
      )}
    </>
  );
}
