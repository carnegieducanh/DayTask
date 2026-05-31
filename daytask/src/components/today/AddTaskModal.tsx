import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Task, Category, Priority } from '../../types';

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

interface Props {
  editTask?: Task | null;
  onClose: () => void;
}

export default function AddTaskModal({ editTask, onClose }: Props) {
  const { selectedDate, addTask, updateTask } = useAppStore();

  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [category, setCategory]   = useState<Category>('work');
  const [priority, setPriority]   = useState<Priority>('mid');
  const [reminder, setReminder]   = useState('');

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDesc(editTask.description ?? '');
      setCategory(editTask.category);
      setPriority(editTask.priority);
      setReminder(editTask.reminder ?? '');
    }
  }, [editTask]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    if (editTask) {
      await updateTask(editTask.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        priority,
        reminder: reminder || undefined,
      });
    } else {
      await addTask({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        priority,
        reminder: reminder || undefined,
        date: selectedDate,
      });
    }
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{editTask ? 'Sửa task' : 'Thêm task mới'}</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tên task *</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên task..."
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả</label>
            <textarea
              className="form-input"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Mô tả thêm (tùy chọn)..."
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Danh mục</label>
              <select
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ưu tiên</label>
              <select
                className="form-input"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Giờ nhắc nhở</label>
            <input
              className="form-input"
              type="time"
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              {editTask ? 'Lưu thay đổi' : 'Thêm task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
