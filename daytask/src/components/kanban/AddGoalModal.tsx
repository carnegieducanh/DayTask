import { useState, useEffect, useRef } from 'react';
import { IconX, IconPlus, IconCheck } from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';
import type { Goal, Category, Priority, Quarter, GoalStatus } from '../../types';

const COLOR_PALETTE: string[] = [
  '#F28B82', '#FAAFA8', '#E879AA', '#CE93D8', '#B39DDB',
  '#D50000', '#E67C73', '#EC4899', '#8E24AA', '#9E2626',
  '#F4511E', '#F6BF26', '#FEF08A', '#DDD6FE', '#A8C5A0',
  '#0B8043', '#33B679', '#86EFAC', '#039BE5', '#7986CB',
  '#292524', '#78716C', '#3F51B5', '#7C3AED', '#6B21A8',
];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'work',     label: 'Công việc' },
  { value: 'personal', label: 'Cá nhân' },
  { value: 'health',   label: 'Sức khỏe' },
  { value: 'learn',    label: 'Học tập' },
];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'high', label: 'Cao' },
  { value: 'mid',  label: 'Trung bình' },
  { value: 'low',  label: 'Thấp' },
];

const QUARTERS: { value: Quarter; label: string }[] = [
  { value: 'Q1',   label: 'Quý 1 (Jan–Mar)' },
  { value: 'Q2',   label: 'Quý 2 (Apr–Jun)' },
  { value: 'Q3',   label: 'Quý 3 (Jul–Sep)' },
  { value: 'Q4',   label: 'Quý 4 (Oct–Dec)' },
  { value: 'full', label: 'Cả năm' },
];

interface Props {
  editGoal?: Goal | null;
  defaultStatus?: GoalStatus;
  onClose: () => void;
}

export default function AddGoalModal({ editGoal, defaultStatus = 'todo', onClose }: Props) {
  const { selectedYear, addGoal, updateGoal, checklistItems, addChecklistItem, toggleChecklistItem, deleteChecklistItem, categoryColors, updateCategoryColor } = useAppStore();

  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [category, setCategory] = useState<Category>('work');
  const [priority, setPriority] = useState<Priority>('mid');
  const [quarter,  setQuarter]  = useState<Quarter>('Q1');

  const [newItemText, setNewItemText] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editGoal) {
      setTitle(editGoal.title);
      setDesc(editGoal.description ?? '');
      setCategory(editGoal.category);
      setPriority(editGoal.priority);
      setQuarter(editGoal.quarter);
    }
  }, [editGoal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    if (editGoal) {
      await updateGoal(editGoal.id, {
        title: title.trim(),
        description: desc.trim() || undefined,
        category, priority, quarter,
      });
    } else {
      await addGoal({
        title: title.trim(),
        description: desc.trim() || undefined,
        category, priority, quarter,
        year: selectedYear,
        status: defaultStatus,
      });
    }
    onClose();
  }

  async function handleAddItem() {
    if (!editGoal || !newItemText.trim()) return;
    await addChecklistItem(editGoal.id, newItemText.trim());
    setNewItemText('');
    addInputRef.current?.focus();
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  }

  const items = editGoal ? (checklistItems[editGoal.id] ?? []) : [];
  const doneCount = items.filter((i) => i.is_done).length;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-goal-detail">
        <div className="modal-title">{editGoal ? 'Chi tiết mục tiêu' : 'Thêm mục tiêu'}</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tên mục tiêu *</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập mục tiêu..."
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả</label>
            <textarea
              className="form-input"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Danh mục</label>
              <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <div className="cat-color-picker">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch${categoryColors[category] === color ? ' color-swatch-active' : ''}`}
                    style={{ background: color }}
                    onClick={() => updateCategoryColor(category, color)}
                    title={color}
                  >
                    {categoryColors[category] === color && <IconCheck size={10} strokeWidth={3} color="#fff" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Ưu tiên</label>
              <select className="form-input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Deadline theo quý</label>
            <select className="form-input" value={quarter} onChange={(e) => setQuarter(e.target.value as Quarter)}>
              {QUARTERS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
            </select>
          </div>

          {/* Checklist section — chỉ hiện khi đang edit goal đã có */}
          {editGoal && (
            <div className="checklist-section">
              <div className="checklist-header">
                <span className="checklist-title">Việc cần làm</span>
                {items.length > 0 && (
                  <span className="checklist-count">{doneCount}/{items.length}</span>
                )}
              </div>

              {items.length > 0 && (
                <div className="checklist-progress-bar">
                  <div
                    className="checklist-progress-fill"
                    style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }}
                  />
                </div>
              )}

              <div className="checklist-items">
                {items.map((item) => (
                  <div key={item.id} className={`checklist-item${item.is_done ? ' checklist-item-done' : ''}`}>
                    <button
                      type="button"
                      className={`checklist-checkbox${item.is_done ? ' checked' : ''}`}
                      onClick={() => toggleChecklistItem(item.id, editGoal.id)}
                      title={item.is_done ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'}
                    >
                      {!!item.is_done && <IconCheck size={11} strokeWidth={3} />}
                    </button>
                    <span className="checklist-item-text">{item.text}</span>
                    <button
                      type="button"
                      className="checklist-item-delete"
                      onClick={() => deleteChecklistItem(item.id, editGoal.id)}
                      title="Xóa"
                    >
                      <IconX size={11} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="checklist-add-row">
                <input
                  ref={addInputRef}
                  className="checklist-add-input"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={handleAddKeyDown}
                  placeholder="Thêm việc cần làm..."
                />
                <button
                  type="button"
                  className="checklist-add-btn"
                  onClick={handleAddItem}
                  disabled={!newItemText.trim()}
                  title="Thêm"
                >
                  <IconPlus size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary">
              {editGoal ? 'Lưu thay đổi' : 'Thêm mục tiêu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
