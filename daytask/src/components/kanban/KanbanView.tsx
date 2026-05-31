import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { IconGripHorizontal } from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';
import KanbanColumn from './KanbanColumn';
import GoalCardOverlay from './GoalCardOverlay';
import AddGoalModal from './AddGoalModal';
import type { Goal, GoalStatus } from '../../types';

const STATUSES: GoalStatus[] = ['todo', 'doing', 'review', 'done'];

const STATUS_CONFIG: Record<GoalStatus, { label: string; dot: string }> = {
  todo:   { label: 'Chưa bắt đầu',  dot: '#888780' },
  doing:  { label: 'Đang thực hiện', dot: '#3B9FE8' },
  review: { label: 'Đang review',    dot: '#EF9F27' },
  done:   { label: 'Hoàn thành',     dot: '#639922' },
};

export default function KanbanView() {
  const { goals, moveGoal, openAddGoalModal, setOpenAddGoalModal } = useAppStore();
  const [showModal, setShowModal]         = useState(false);
  const [editGoal, setEditGoal]           = useState<Goal | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<GoalStatus>('todo');
  const [activeGoalId, setActiveGoalId]   = useState<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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

  function handleDragStart(event: DragStartEvent) {
    setActiveGoalId(Number(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveGoalId(null);
    const { active, over } = event;
    if (!over) return;
    const goalId = Number(active.id);
    const overId = over.id;
    if (STATUSES.includes(overId as GoalStatus)) {
      const newStatus = overId as GoalStatus;
      const colGoals  = goals.filter((g) => g.status === newStatus);
      moveGoal(goalId, newStatus, colGoals.length);
      return;
    }
    const overGoal = goals.find((g) => g.id === Number(overId));
    if (!overGoal) return;
    moveGoal(goalId, overGoal.status, overGoal.position);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const goalId = Number(active.id);
    const overId = over.id;

    // Hovering over a column directly (empty area)
    if (STATUSES.includes(overId as GoalStatus)) {
      const dragGoal = goals.find((g) => g.id === goalId);
      if (dragGoal && dragGoal.status !== overId) {
        moveGoal(goalId, overId as GoalStatus, 999);
      }
      return;
    }

    // Hovering over a card in another column
    const overGoal  = goals.find((g) => g.id === Number(overId));
    const dragGoal  = goals.find((g) => g.id === goalId);
    if (!overGoal || !dragGoal) return;
    if (dragGoal.status !== overGoal.status) {
      moveGoal(goalId, overGoal.status, overGoal.position);
    }
  }

  const overlayGoal = activeGoalId
    ? (goals.find((g) => g.id === activeGoalId) ?? null)
    : null;

  return (
    <>
      {/* Stats bar */}
      <div className="kanban-stats-bar">
        {STATUSES.map((s) => (
          <div key={s} className="kanban-stat-item">
            <span className="kanban-stat-dot" style={{ background: STATUS_CONFIG[s].dot }} />
            {STATUS_CONFIG[s].label}
            <span className="kanban-stat-num">{goals.filter((g) => g.status === s).length}</span>
          </div>
        ))}
        <div className="kanban-progress-wrap">
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Tiến độ năm</span>
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

      {/* Kanban board */}
      <div className="kanban-board">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
        >
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              goals={goals.filter((g) => g.status === status).sort((a, b) => a.position - b.position)}
              onEdit={openEdit}
              onAddGoal={openAdd}
            />
          ))}
          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: 'ease',
              sideEffects: defaultDropAnimationSideEffects({
                styles: { active: { opacity: '0.4' } },
              }),
            }}
          >
            {overlayGoal ? <GoalCardOverlay goal={overlayGoal} /> : null}
          </DragOverlay>
        </DndContext>
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
