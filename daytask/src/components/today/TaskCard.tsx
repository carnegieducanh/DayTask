import { useState, useRef } from 'react';
import { IconCheck, IconBell, IconBellOff, IconTrash } from '@tabler/icons-react';
import type { Task } from '../../types';
import { useAppStore } from '../../store/appStore';

const CAT_LABEL: Record<string, string> = {
  work: 'Công việc', personal: 'Cá nhân', health: 'Sức khỏe', learn: 'Học tập',
};

interface Props {
  task: Task;
  onEdit: (task: Task) => void;
}

export default function TaskCard({ task, onEdit }: Props) {
  const { toggleTask, deleteTask, updateTask } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditTitle(task.title);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commitEdit() {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      updateTask(task.id, { title: trimmed });
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') { setEditTitle(task.title); setIsEditing(false); }
  }

  return (
    <div className={`task-item${task.is_done ? ' done' : ''}`}>
      <button
        className={`task-check${task.is_done ? ' checked' : ''}`}
        onClick={() => toggleTask(task.id)}
        title={task.is_done ? 'Đánh dấu chưa xong' : 'Đánh dấu xong'}
      >
        <IconCheck size={22} strokeWidth={2.5} />
      </button>

      <div className="task-body">
        {isEditing ? (
          <input
            ref={inputRef}
            className="task-inline-input"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="task-name"
            onDoubleClick={startEdit}
            onClick={() => onEdit(task)}
            style={{ cursor: 'pointer' }}
            title="Click để mở, double-click để sửa nhanh"
          >
            {task.title}
          </div>
        )}
        <div className="task-meta">
          {task.reminder && (
            <span className="task-time">
              <IconBell size={11} style={{ verticalAlign: 'middle' }} /> {task.reminder}
            </span>
          )}
          <span className={`tag tag-${task.category}`}>
            {CAT_LABEL[task.category]}
          </span>
        </div>
      </div>

      <span className="task-bell-btn">
        {task.reminder ? (
          <IconBell size={20} style={{ color: '#60a5fa', flexShrink: 0 }} />
        ) : (
          <IconBellOff size={20} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        )}
      </span>

      <button
        className="icon-btn task-delete-btn"
        style={{ width: 30, height: 30, fontSize: 14, flexShrink: 0 }}
        onClick={() => deleteTask(task.id)}
        title="Xóa"
      >
        <IconTrash size={18} />
      </button>
    </div>
  );
}
