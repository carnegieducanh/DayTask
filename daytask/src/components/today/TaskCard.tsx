import { useState, useRef } from 'react';
import { IconCheck, IconBell, IconBellOff, IconTrash } from '@tabler/icons-react';
import type { Task } from '../../types';
import { useAppStore } from '../../store/appStore';

const CAT_LABEL: Record<string, string> = {
  work: 'Công việc', personal: 'Cá nhân', health: 'Sức khỏe', learn: 'Học tập',
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Props {
  task: Task;
  onEdit: (task: Task) => void;
}

export default function TaskCard({ task, onEdit }: Props) {
  const { toggleTask, deleteTask, updateTask, categoryColors } = useAppStore();
  const cardBg = hexToRgba(categoryColors[task.category], 0.75);
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
    <div className={`task-item task-item--colored${task.is_done ? ' done' : ''}`} style={{ backgroundColor: cardBg }}>
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
          <IconBell size={22} className="task-bell-active" />
        ) : (
          <IconBellOff size={22} className="task-bell-inactive" />
        )}
      </span>

      <button
        className="icon-btn task-delete-btn"
        style={{ width: 32, height: 32, fontSize: 15, flexShrink: 0 }}
        onClick={() => deleteTask(task.id)}
        title="Xóa"
      >
        <IconTrash size={20} />
      </button>
    </div>
  );
}
