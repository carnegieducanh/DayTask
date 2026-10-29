import { useState, useEffect } from 'react';
import './kanban.css';
import { IconPlus, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { differenceInCalendarDays, getDaysInYear } from 'date-fns';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import KanbanColumn from './KanbanColumn';
import AddGoalModal from './AddGoalModal';
import type { Goal, GoalStatus } from '../../types';

interface Props {
  liveGoals?: Goal[] | null;
}

const STATUSES: GoalStatus[] = ['todo', 'doing', 'done'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;

export default function KanbanView({ liveGoals }: Props) {
  const t = useT();
  const { goals, openAddGoalModal, setOpenAddGoalModal, selectedYear, setSelectedYear } = useAppStore();
  const displayGoals = liveGoals ?? goals;
  const [showModal, setShowModal]         = useState(false);
  const [editGoal, setEditGoal]           = useState<Goal | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<GoalStatus>('todo');

  const total   = goals.length;
  const done    = goals.filter((g) => g.status === 'done').length;
  const goalPct = total === 0 ? 0 : Math.round((done / total) * 100);

  // Phần năm đã trôi qua của năm đang xem: năm cũ = 100%, năm sau = 0%
  const today    = new Date();
  const thisYear = today.getFullYear();
  const timePct =
    selectedYear < thisYear ? 100
    : selectedYear > thisYear ? 0
    : ((differenceInCalendarDays(today, new Date(thisYear, 0, 1)) + 1) / getDaysInYear(today)) * 100;
  const yearState =
    selectedYear < thisYear ? t.kanban.yearClosed
    : selectedYear > thisYear ? t.kanban.yearAhead
    : t.kanban.daysLeft(differenceInCalendarDays(new Date(thisYear, 11, 31), today));

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
    <div className="yp-wrap">
      <header className="yp-head">
        <div className="yp-head-main">
          <span className="yp-eyebrow">{t.kanban.eyebrow}</span>
          <div className="yp-title-row">
            <h1 className="yp-title">{t.kanban.yearTitle(selectedYear)}</h1>
            <div className="yp-year-nav">
              <button
                className="yp-round-btn"
                onClick={() => setSelectedYear(selectedYear - 1)}
                title={t.nav.prevYear}
                aria-label={t.nav.prevYear}
              >
                <IconChevronLeft size={16} />
              </button>
              <button
                className="yp-round-btn"
                onClick={() => setSelectedYear(selectedYear + 1)}
                title={t.nav.nextYear}
                aria-label={t.nav.nextYear}
              >
                <IconChevronRight size={16} />
              </button>
            </div>
          </div>
          <p className="yp-subtitle">{t.kanban.summary(total, done)} · {yearState}</p>
        </div>
        <button className="yp-add-btn" onClick={() => openAdd('todo')}>
          <IconPlus size={16} />
          {t.kanban.addGoal}
        </button>
      </header>

      {/* Thước năm: thời gian đã trôi so với tỷ lệ mục tiêu đã hoàn thành */}
      <section className="yp-ruler" aria-label={t.kanban.yearProgress}>
        <span />
        <div className="yp-ruler-quarters">
          {QUARTERS.map((q) => <span key={q}>{t.kanban.quarterHead[q]}</span>)}
        </div>
        <span />

        <span className="yp-ruler-label">{t.kanban.timeRow}</span>
        <div className="yp-track">
          <span className="yp-track-fill yp-track-fill--time" style={{ width: `${timePct}%` }} />
          <span className="yp-notch" style={{ left: '25%' }} />
          <span className="yp-notch" style={{ left: '50%' }} />
          <span className="yp-notch" style={{ left: '75%' }} />
          {selectedYear === thisYear && <span className="yp-today" style={{ left: `${timePct}%` }} />}
        </div>
        <span className="yp-ruler-pct">{Math.round(timePct)}%</span>

        <span className="yp-ruler-label">{t.kanban.goalRow}</span>
        <div className="yp-track">
          <span className="yp-track-fill yp-track-fill--goal" style={{ width: `${goalPct}%` }} />
          <span className="yp-notch" style={{ left: '25%' }} />
          <span className="yp-notch" style={{ left: '50%' }} />
          <span className="yp-notch" style={{ left: '75%' }} />
        </div>
        <span className="yp-ruler-pct yp-ruler-pct--goal">{goalPct}%</span>
      </section>

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
    </div>
  );
}
