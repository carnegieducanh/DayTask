import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { IconSearch, IconPlus, IconDownload, IconSun } from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';
import { isTauri } from '../../store/mockDb';
import TaskCard from './TaskCard';
import AddTaskModal from './AddTaskModal';
import MiniHeatmap from './MiniHeatmap';
import type { Task } from '../../types';

export default function TodayView() {
  const {
    tasks, selectedDate, setSelectedDate,
    heatmap, loadHeatmap,
    getStreak, setReminderPopup,
  } = useAppStore();

  const [showModal, setShowModal]         = useState(false);
  const [editTask, setEditTask]           = useState<Task | null>(null);
  const [streak, setStreak]               = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
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
    const first = tasks.find((t) => !t.is_done && t.reminder);
    if (!first) return;
    demoPopupShown.current = true;
    const timer = setTimeout(() => setReminderPopup(first), 1200);
    return () => clearTimeout(timer);
  }, [tasks]);

  const pending   = tasks.filter((t) => !t.is_done);
  const done      = tasks.filter((t) => t.is_done);
  const total     = tasks.length;
  const pct       = total === 0 ? 0 : Math.round((done.length / total) * 100);
  const reminders = pending.filter((t) => t.reminder).length;

  const dateLabel = format(new Date(selectedDate + 'T00:00:00'), "EEEE, d MMMM yyyy", { locale: vi });

  function openAdd()        { setEditTask(null); setShowModal(true); }
  function openEdit(t: Task) { setEditTask(t);   setShowModal(true); }

  function exportData() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), date: selectedDate, tasks }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `daytask-${selectedDate}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <>
      {/* Topbar */}
      <div className="view-topbar">
        <div style={{ cursor: 'pointer' }} onClick={() => setShowDatePicker((v) => !v)}>
          <div className="view-title">Hôm nay</div>
          <div className="view-subtitle" style={{ textTransform: 'capitalize' }}>{dateLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {showDatePicker && (
            <input type="date" className="form-input" value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setShowDatePicker(false); }}
              style={{ width: 130, padding: '5px 8px', fontSize: 12 }}
              autoFocus onBlur={() => setShowDatePicker(false)}
            />
          )}
          {selectedDate !== format(new Date(), 'yyyy-MM-dd') && !showDatePicker && (
            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}
              onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}>
              Hôm nay
            </button>
          )}
          <button className="icon-btn" title="Xuất dữ liệu" onClick={exportData}><IconDownload size={16} /></button>
          <button className="icon-btn" title="Tìm kiếm" onClick={() => {}}><IconSearch size={16} /></button>
          <button className="icon-btn" title="Thêm task" onClick={openAdd}><IconPlus size={16} /></button>
        </div>
      </div>

      <div className="view-content">

        {/* Stat cards */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Hoàn thành</div>
            <div className="stat-value">
              {done.length}
              <span style={{ fontSize: 20, color: 'var(--text-secondary)', fontWeight: 400 }}>/{total}</span>
            </div>
            <div className="progress-bar-wrap" style={{ marginTop: 8 }}>
              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Streak</div>
            <div className="stat-value">🔥 {streak}</div>
            <div className="stat-sub">ngày liên tiếp</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Nhắc nhở</div>
            <div className="stat-value">{reminders}</div>
            <div className="stat-sub">còn lại hôm nay</div>
          </div>
        </div>

        {/* Chưa hoàn thành */}
        {pending.length > 0 && (
          <div>
            <div className="section-label">Chưa hoàn thành · {pending.length}</div>
            <div className="task-list">
              {pending.map((t) => <TaskCard key={t.id} task={t} onEdit={openEdit} />)}
            </div>
          </div>
        )}

        {/* Đã hoàn thành */}
        {done.length > 0 && (
          <div>
            <div className="section-label">Đã hoàn thành · {done.length}</div>
            <div className="task-list">
              {done.map((t) => <TaskCard key={t.id} task={t} onEdit={openEdit} />)}
            </div>
          </div>
        )}

        {/* Add task */}
        <div className="add-task-row" onClick={openAdd}>
          <IconPlus size={16} />
          Thêm task mới...
        </div>

        {/* Empty state */}
        {total === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>
            <IconSun size={32} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
            <div>Ngày mới, bắt đầu thêm task đầu tiên!</div>
          </div>
        )}

        {/* Mini heatmap */}
        <div>
          <div className="section-label">Hoạt động 3 tháng qua</div>
          <MiniHeatmap data={heatmap} />
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
