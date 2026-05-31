import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Goal, Category, Priority, Quarter, GoalStatus } from '../../types';

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
  const { selectedYear, addGoal, updateGoal } = useAppStore();

  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [category, setCategory] = useState<Category>('work');
  const [priority, setPriority] = useState<Priority>('mid');
  const [quarter,  setQuarter]  = useState<Quarter>('Q1');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (editGoal) {
      setTitle(editGoal.title);
      setDesc(editGoal.description ?? '');
      setCategory(editGoal.category);
      setPriority(editGoal.priority);
      setQuarter(editGoal.quarter);
      setProgress(editGoal.progress);
    }
  }, [editGoal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    if (editGoal) {
      await updateGoal(editGoal.id, {
        title: title.trim(),
        description: desc.trim() || undefined,
        category, priority, quarter, progress,
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

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{editGoal ? 'Sửa mục tiêu' : 'Thêm mục tiêu'}</div>

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

          {editGoal && (
            <div className="form-group">
              <label className="form-label">Tiến độ: {progress}%</label>
              <input
                type="range" min={0} max={100} step={5}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
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
