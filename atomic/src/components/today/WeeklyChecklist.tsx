import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconPlus, IconTrash } from '@tabler/icons-react';
import { useT } from '../../i18n';
import {
  WeeklyItem,
  dbLoadWeekItems,
  dbAddWeeklyItem,
  dbToggleWeeklyItem,
  dbUpdateWeeklyItem,
  dbDeleteWeeklyItem,
  getWeekKey,
  formatWeekRange,
} from '../../store/weeklyChecklistDb';

const UNDO_DURATION = 4000;

export function WeeklyChecklist({ selectedDate }: { selectedDate: string }) {
  const t = useT();
  const [items, setItems] = useState<WeeklyItem[]>([]);
  const [transitioningIds, setTransitioningIds] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [pendingDelete, setPendingDelete] = useState<WeeklyItem | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = new Date();
  const selectedDay = new Date(selectedDate + 'T00:00:00');
  const weekKey = getWeekKey(selectedDay);
  const todayWeekKey = getWeekKey(today);
  const weekRange = formatWeekRange(selectedDay);

  useEffect(() => {
    dbLoadWeekItems(weekKey, todayWeekKey).then(setItems);
  }, [weekKey]);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (editingId !== null) editInputRef.current?.focus();
  }, [editingId]);

  // Auto-confirm delete after UNDO_DURATION
  useEffect(() => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (!pendingDelete) return;
    deleteTimerRef.current = setTimeout(async () => {
      await dbDeleteWeeklyItem(pendingDelete.id);
      setPendingDelete(null);
    }, UNDO_DURATION);
    return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); };
  }, [pendingDelete]);

  async function handleToggle(item: WeeklyItem) {
    if (!item.is_done) {
      setTransitioningIds(prev => new Set(prev).add(item.id));
      setTimeout(async () => {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_done: true } : i));
        setTransitioningIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
        await dbToggleWeeklyItem(item.id, true);
      }, 350);
    } else {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_done: false } : i));
      await dbToggleWeeklyItem(item.id, false);
    }
  }

  async function handleAdd(keepAdding = false) {
    const text = newText.trim();
    setNewText('');
    if (!text) {
      setAdding(false);
      return;
    }
    if (!keepAdding) setAdding(false);
    const position = items.length;
    const id = await dbAddWeeklyItem(weekKey, text, position);
    if (id > 0) {
      setItems(prev => [...prev, { id, week_key: weekKey, text, is_done: false, position }]);
    }
    if (keepAdding) setTimeout(() => addInputRef.current?.focus(), 0);
  }

  function handleStartEdit(item: WeeklyItem) {
    setEditingId(item.id);
    setEditText(item.text);
  }

  async function handleSaveEdit() {
    if (editingId === null) return;
    const text = editText.trim();
    if (text) {
      setItems(prev => prev.map(i => (i.id === editingId ? { ...i, text } : i)));
      await dbUpdateWeeklyItem(editingId, text);
    }
    setEditingId(null);
    setEditText('');
  }

  function handleEditKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSaveEdit();
    else if (e.key === 'Escape') {
      setEditingId(null);
      setEditText('');
    }
  }

  function handleDelete(item: WeeklyItem) {
    // If there's already a pending delete, confirm it immediately
    if (pendingDelete) {
      dbDeleteWeeklyItem(pendingDelete.id);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    }
    setItems(prev => prev.filter(i => i.id !== item.id));
    setPendingDelete(item);
  }

  function handleUndoDelete() {
    if (!pendingDelete) return;
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setItems(prev => {
      const restored = [...prev, pendingDelete];
      return restored.sort((a, b) => a.position - b.position || a.id - b.id);
    });
    setPendingDelete(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd(true);
    else if (e.key === 'Escape') {
      setAdding(false);
      setNewText('');
    }
  }

  const pending = items.filter(i => !i.is_done);
  const done = items.filter(i => i.is_done);
  const sorted = [...pending, ...done];

  return (
    <div className="today-todo">
      <div className="today-todo-header">
        <span className="today-todo-title">{t.weeklyChecklist.title}</span>
        <span className="today-todo-range">{weekRange}</span>
        {items.length > 0 && (
          <span className="today-todo-stats">{done.length}/{items.length}</span>
        )}
        <button
          className="today-todo-add-btn labeled"
          onClick={() => setAdding(true)}
        >
          <IconPlus size={14} />
          <span>{t.weeklyChecklist.addLabel}</span>
        </button>
      </div>

      <div className="today-todo-items">
        {sorted.map(item => (
          <div
            key={item.id}
            className={`today-todo-item${item.is_done ? ' done' : ''}${transitioningIds.has(item.id) ? ' completing' : ''}`}
          >
            <button className="today-todo-check" onClick={() => handleToggle(item)}>
              <IconCheck size={12} strokeWidth={3} />
            </button>

            {editingId === item.id ? (
              <input
                ref={editInputRef}
                className="today-todo-input"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={handleSaveEdit}
                spellCheck={false}
              />
            ) : (
              <span className="today-todo-text" onClick={() => handleStartEdit(item)}>
                {item.text}
              </span>
            )}

            {editingId !== item.id && (
              <button className="today-todo-del" onClick={() => handleDelete(item)}>
                <IconTrash size={13} />
              </button>
            )}
          </div>
        ))}

        {adding && (
          <div className="today-todo-item">
            <span className="today-todo-check" aria-hidden="true" />
            <input
              ref={addInputRef}
              className="today-todo-input"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => handleAdd()}
              placeholder={t.weeklyChecklist.addPlaceholder}
              spellCheck={false}
            />
          </div>
        )}

        {items.length === 0 && !adding && (
          <div className="today-panel-empty today-todo-empty" onClick={() => setAdding(true)}>
            {t.weeklyChecklist.hintEmpty}
          </div>
        )}
      </div>

      {pendingDelete && createPortal(
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{t.toast.deleted(pendingDelete.text)}</span>
          <button className="delete-toast-undo" onClick={handleUndoDelete}>
            {t.toast.undo}
          </button>
        </div>,
        document.querySelector('.main-wrap') ?? document.body
      )}
    </div>
  );
}
