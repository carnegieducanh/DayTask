import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconClock, IconTrash, IconTag } from '@tabler/icons-react';
import type { Task } from '../../types';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';

const COLOR_PALETTE: string[] = [
  '#C05476', '#E3683E', '#D8BE5E', '#489160', '#6E72C3', '#A75ABA',
  '#D85675', '#DD7835', '#BCC256', '#429A8E', '#828BC2', '#957367',
  '#DA5234', '#E0963C', '#82AA57', '#4B99D2', '#AE9CCE', '#7C7C7C',
  '#D38179', '#E4B751', '#54AD7F', '#6489DF', '#A277AF', '#A3978B',
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Props {
  task: Task;
  onEdit: (task: Task) => void;
  onToggle?: (id: number) => void;
}

export default function TaskCard({ task, onEdit, onToggle }: Props) {
  const t = useT();
  const { toggleTask, softDeleteTask, updateTask, updateTaskColor, categoryColors, taskTimeEntries, saveTimeEntry, deleteTimeEntry, tags, taskTags } = useAppStore();
  const taskTagIds = taskTags[task.id] ?? [];
  const taskTagObjects = tags.filter((tg) => taskTagIds.includes(tg.id));
  const cardBg = hexToRgba(task.color ?? categoryColors[task.category], 1);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isEditingTime, setIsEditingTime] = useState(false);
  const timeEntry = taskTimeEntries.find((e) => e.task_id === task.id && e.date === task.date);
  const [editStart, setEditStart] = useState(timeEntry?.start_time ?? '');
  const [editEnd, setEditEnd] = useState(timeEntry?.end_time ?? '');
  const [timeError, setTimeError] = useState('');
  const startInputRef = useRef<HTMLInputElement>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    function handleClose(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null);
    }
    window.addEventListener('mousedown', handleClose);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClose);
      window.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const MENU_W = 180;
    const MENU_H = 170;
    let x = e.clientX;
    let y = e.clientY;
    if (x + MENU_W > window.innerWidth) x = window.innerWidth - MENU_W - 8;
    if (y + MENU_H > window.innerHeight) y = window.innerHeight - MENU_H - 8;
    setContextMenu({ x, y });
  }

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
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

  function openTimeEdit(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setEditStart(timeEntry?.start_time ?? '');
    setEditEnd(timeEntry?.end_time ?? '');
    setTimeError('');
    setIsEditingTime(true);
    setTimeout(() => startInputRef.current?.focus(), 0);
  }

  async function commitTime() {
    const s = editStart.trim();
    const en = editEnd.trim();

    if (!s && !en) {
      if (timeEntry) await deleteTimeEntry(task.id, task.date);
      setIsEditingTime(false);
      return;
    }
    if ((s && !en) || (!s && en)) {
      setTimeError(t.taskCard.timeEndBeforeStart.replace('kết thúc phải sau', 'cần điền cả').replace('End time must be after', 'Fill in both'));
      return;
    }
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = en.split(':').map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      setTimeError(t.taskCard.timeEndBeforeStart);
      return;
    }
    await saveTimeEntry(task.id, task.date, s, en);
    setIsEditingTime(false);
    setTimeError('');
  }

  function handleTimeKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitTime();
    if (e.key === 'Escape') setIsEditingTime(false);
  }

  const displayTime = timeEntry
    ? `${timeEntry.start_time} → ${timeEntry.end_time}`
    : `${t.taskCard.timePlaceholder} → ${t.taskCard.timePlaceholder}`;

  return (
    <div
      className={`task-item task-item--colored${task.is_done ? ' done' : ''}`}
      style={{ backgroundColor: cardBg, cursor: 'pointer' }}
      onClick={() => !isEditing && !isEditingTime && onEdit(task)}
      onContextMenu={handleContextMenu}
    >
      <button
        className={`task-check${task.is_done ? ' checked' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggle ? onToggle(task.id) : toggleTask(task.id); }}
        title={task.is_done ? t.taskCard.markUndone : t.taskCard.markDone}
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
            spellCheck={false}
          />
        ) : (
          <div
            className="task-name"
            onDoubleClick={startEdit}
            title={t.taskCard.clickHint}
          >
            <span
              className="task-name-text"
              style={task.description ? { maxWidth: '65%' } : undefined}
            >
              {task.title}
            </span>
            {task.description && (
              <span className="task-desc-preview">
                <span className="task-desc-sep">›</span>{task.description}
              </span>
            )}
          </div>
        )}

        <div className="task-meta">
          {isEditingTime ? (
            <div className="task-time-edit" onClick={(e) => e.stopPropagation()}>
              <input
                ref={startInputRef}
                type="time"
                className="task-time-input"
                value={editStart}
                onChange={(e) => { setEditStart(e.target.value); setTimeError(''); }}
                onKeyDown={handleTimeKeyDown}
              />
              <span className="task-time-sep">→</span>
              <input
                type="time"
                className="task-time-input"
                value={editEnd}
                onChange={(e) => { setEditEnd(e.target.value); setTimeError(''); }}
                onBlur={commitTime}
                onKeyDown={handleTimeKeyDown}
              />
              {timeError && <span className="task-time-error">{timeError}</span>}
            </div>
          ) : (
            <span
              className={`task-time-display${timeEntry ? ' has-time' : ''}`}
              onClick={openTimeEdit}
              title={t.taskCard.setTime}
            >
              <IconClock size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
              {displayTime}
            </span>
          )}
          <span className={`tag tag-${task.category}`}>
            {t.cat[task.category]}
          </span>
          {taskTagObjects.map((tag) => (
            <span key={tag.id} className="task-tag-chip">
              <IconTag size={10} style={{ flexShrink: 0 }} />
              {tag.name}
            </span>
          ))}
        </div>
      </div>

      <button
        className="icon-btn task-delete-btn"
        style={{ width: 32, height: 32, fontSize: 15, flexShrink: 0 }}
        onClick={(e) => { e.stopPropagation(); softDeleteTask(task.id); }}
        title={t.taskCard.delete}
      >
        <IconTrash size={20} />
      </button>

      {contextMenu && createPortal(
        <div
          ref={menuRef}
          className="task-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="day-context-item day-context-item-danger"
            onClick={() => { softDeleteTask(task.id); setContextMenu(null); }}
          >
            <IconTrash size={16} />
            {t.taskCard.delete}
          </button>
          <div className="task-context-divider" />
          <div className="task-context-colors">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                className="task-context-color-btn"
                style={{ backgroundColor: color }}
                onClick={() => { if ((task.color ?? categoryColors[task.category]) !== color) { updateTaskColor(task.category, color); } setContextMenu(null); }}
                title={color}
              >
                {(task.color ?? categoryColors[task.category]) === color && <IconCheck size={12} color="white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
