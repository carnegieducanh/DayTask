import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { IconChevronLeft, IconChevronRight, IconFilter, IconSearch, IconPlus } from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';
import KanbanColumn from './KanbanColumn';
import AddGoalModal from './AddGoalModal';
import type { Goal, GoalStatus } from '../../types';

const STATUSES: GoalStatus[] = ['todo', 'doing', 'review', 'done'];

const STATUS_CONFIG: Record<GoalStatus, { label: string; dot: string }> = {
  todo:   { label: 'Chưa bắt đầu',  dot: '#888780' },
  doing:  { label: 'Đang thực hiện', dot: '#185FA5' },
  review: { label: 'Đang review',    dot: '#EF9F27' },
  done:   { label: 'Hoàn thành',     dot: '#639922' },
};

export default function KanbanView() {
  const { goals, selectedYear, setSelectedYear, moveGoal } = useAppStore();
  const [showModal, setShowModal]         = useState(false);
  const [editGoal, setEditGoal]           = useState<Goal | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<GoalStatus>('todo');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const total   = goals.length;
  const done    = goals.filter((g) => g.status === 'done').length;
  const yearPct = total === 0 ? 0 : Math.round((done / total) * 100);

  function openAdd(status: GoalStatus) {
    setEditGoal(null);
    setDefaultStatus(status);
    setShowModal(true);
  }

  function openEdit(goal: Goal) {
    setEditGoal(goal);
    setShowModal(true);
  }

  function handleDragEnd(event: DragEndEvent) {
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
    if (STATUSES.includes(overId as GoalStatus)) {
      const dragGoal = goals.find((g) => g.id === goalId);
      if (dragGoal && dragGoal.status !== overId) {
        moveGoal(goalId, overId as GoalStatus, 999);
      }
    }
  }

  return (
    <>
      {/* Topbar */}
      <div className="view-topbar">
        <div>
          <div className="view-title">Kế hoạch năm</div>
          <div className="view-subtitle">{done}/{total} mục tiêu hoàn thành</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div className="year-pill">
            <button className="icon-btn" style={{ border: 'none' }} onClick={() => setSelectedYear(selectedYear - 1)}>
              <IconChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 500, minWidth: 36, textAlign: 'center' }}>{selectedYear}</span>
            <button className="icon-btn" style={{ border: 'none' }} onClick={() => setSelectedYear(selectedYear + 1)}>
              <IconChevronRight size={14} />
            </button>
          </div>
          <button className="icon-btn" title="Lọc"><IconFilter size={16} /></button>
          <button className="icon-btn" title="Tìm kiếm"><IconSearch size={16} /></button>
          <button className="icon-btn" title="Thêm mục tiêu" onClick={() => openAdd('todo')}>
            <IconPlus size={16} />
          </button>
        </div>
      </div>

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

      {/* Kanban board */}
      <div className="kanban-board">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
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
