import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';
import { IconPlus, IconSun } from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import { isTauri } from '../../store/mockDb';
import TaskCard from './TaskCard';
import AddTaskModal from './AddTaskModal';
import MiniHeatmap from './MiniHeatmap';
import MiniCalendar from './MiniCalendar';
import DailyGreeting from './DailyGreeting';
import type { Task } from '../../types';

export default function TodayView() {
  const t = useT();
  const {
    tasks, selectedDate, setSelectedDate,
    heatmap, loadHeatmap,
    language,
    getStreak, setReminderPopup,
  } = useAppStore();

  const [showModal, setShowModal]         = useState(false);
  const [editTask, setEditTask]           = useState<Task | null>(null);
  const [streak, setStreak]               = useState(0);
  const demoPopupShown = useRef(false);

  useEffect(() => {
    getStreak().then(setStreak);
  }, [tasks]);

  useEffect(() => {
    loadHeatmap(new Date().getFullYear());
  }, []);

  // Demo: show reminder popup once on browser (not Tauri)
  useEffect(() => {
    if (isTauri() || demoPopupShown.current || tasks.length === 0) return;
    const first = tasks.find((task) => !task.is_done && task.reminder);
    if (!first) return;
    demoPopupShown.current = true;
    const timer = setTimeout(() => setReminderPopup(first), 1200);
    return () => clearTimeout(timer);
  }, [tasks]);

  const pending   = tasks.filter((task) => !task.is_done);
  const done      = tasks.filter((task) => task.is_done);
  const total     = tasks.length;
  const pct       = total === 0 ? 0 : Math.round((done.length / total) * 100);
  const reminders = pending.filter((task) => task.reminder).length;

  const reminderTasks = tasks
    .filter((task) => task.reminder)
    .sort((a, b) => (a.reminder || '').localeCompare(b.reminder || ''));

  const dateLabel = format(
    new Date(selectedDate + 'T00:00:00'),
    "EEEE, d MMMM yyyy",
    language === 'vi' ? { locale: viLocale } : undefined,
  );

  const CAT_LABELS: Record<string, string> = {
    work: t.cat.work,
    personal: t.cat.personal,
    health: t.cat.health,
    learn: t.cat.learn,
  };

  function openAdd()         { setEditTask(null); setShowModal(true); }
  function openEdit(task: Task) { setEditTask(task); setShowModal(true); }

  return (
    <>
      {/* Topbar */}
      <div className="view-topbar today-topbar">
        <div className="today-topbar-side">
          <div className="view-title">{t.today.title}</div>
          <div className="view-subtitle" style={{ textTransform: 'capitalize' }}>{dateLabel}</div>
        </div>

        <DailyGreeting
          pendingCount={pending.length}
          isToday={selectedDate === format(new Date(), 'yyyy-MM-dd')}
        />

        <div className="today-topbar-side today-topbar-actions">
          {selectedDate !== format(new Date(), 'yyyy-MM-dd') && (
            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 13 }}
              onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}>
              {t.today.backToToday}
            </button>
          )}
        </div>
      </div>

      <div className="view-content today-content">
        <div className="today-layout">

          {/* ── Left column ── */}
          <div className="today-main">
            {/* Stat cards */}
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">{t.today.statDone}</div>
                <div className="stat-value">
                  {done.length}
                  <span style={{ fontSize: 20, color: 'var(--text-secondary)', fontWeight: 400 }}>/{total}</span>
                </div>
                <div className="progress-bar-wrap" style={{ marginTop: 8 }}>
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">{t.today.statStreak}</div>
                <div className="stat-value">🔥 {streak}</div>
                <div className="stat-sub">{t.today.streakDays}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">{t.today.statReminders}</div>
                <div className="stat-value">{reminders}</div>
                <div className="stat-sub">{t.today.remindersLeft}</div>
              </div>
            </div>

            {/* Add task */}
            <div className="add-task-row" onClick={openAdd}>
              <IconPlus size={16} />
              {t.today.addTask}
            </div>

            {/* Pending */}
            {pending.length > 0 && (
              <div>
                <div className="section-label">
                  {t.today.pending} <span style={{ fontWeight: 400 }}>· {pending.length} {t.today.taskUnit}</span>
                </div>
                <div className="task-list">
                  {pending.map((task) => <TaskCard key={task.id} task={task} onEdit={openEdit} />)}
                </div>
              </div>
            )}

            {/* Done */}
            {done.length > 0 && (
              <div>
                <div className="section-label">
                  {t.today.completed} <span style={{ fontWeight: 400 }}>· {done.length} {t.today.taskUnit}</span>
                </div>
                <div className="task-list">
                  {done.map((task) => <TaskCard key={task.id} task={task} onEdit={openEdit} />)}
                </div>
              </div>
            )}

            {/* Empty state */}
            {total === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>
                <IconSun size={32} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                <div>{t.today.emptyState}</div>
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="today-right">

            {/* Mini Calendar */}
            <div className="today-right-section">
              <MiniCalendar />
            </div>

            {/* Schedule */}
            {reminderTasks.length > 0 && (
              <div className="today-right-section">
                <div className="section-label">{t.today.todaySchedule}</div>
                <div className="today-schedule">
                  {reminderTasks.map((task) => (
                    <div key={task.id} className={`today-schedule-item${task.is_done ? ' done' : ''}`}>
                      <div className="today-schedule-time">{task.reminder}</div>
                      <div className="today-schedule-body">
                        <div className="today-schedule-title">{task.title}</div>
                        <div className="today-schedule-cat">{CAT_LABELS[task.category] ?? task.category}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Heatmap */}
            <div className="today-right-section">
              <div className="section-label">{t.today.activityTitle}</div>
              <MiniHeatmap data={heatmap} />
            </div>

          </div>
        </div>
      </div>

      {showModal && (
        <AddTaskModal
          editTask={editTask}
          onClose={() => { setShowModal(false); setEditTask(null); }}
        />
      )}
    </>
  );
}
