import { useState, useEffect, useRef } from "react";
import {
  IconChevronDown,
  IconDotsVertical,
  IconCheck,
  IconBell,
  IconBellOff,
} from "@tabler/icons-react";

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    );
  }
}
import { useAppStore } from "../../store/appStore";
import type { Task, Category, Priority } from "../../types";

const COLOR_PALETTE: string[] = [
  "#C05476",
  "#E3683E",
  "#D8BE5E",
  "#489160",
  "#6E72C3",
  "#A75ABA",
  "#D85675",
  "#DD7835",
  "#BCC256",
  "#429A8E",
  "#828BC2",
  "#957367",
  "#DA5234",
  "#E0963C",
  "#82AA57",
  "#4B99D2",
  "#AE9CCE",
  "#7C7C7C",
  "#D38179",
  "#E4B751",
  "#54AD7F",
  "#6489DF",
  "#A277AF",
  "#A3978B",
];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "work", label: "Công việc" },
  { value: "personal", label: "Cá nhân" },
  { value: "health", label: "Sức khỏe" },
  { value: "learn", label: "Học tập" },
];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: "Cao" },
  { value: "mid", label: "Trung bình" },
  { value: "low", label: "Thấp" },
];

interface Props {
  editTask?: Task | null;
  onClose: () => void;
}

export default function AddTaskModal({ editTask, onClose }: Props) {
  const {
    selectedDate,
    addTask,
    updateTask,
    categoryColors,
    updateCategoryColor,
  } = useAppStore();

  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [category, setCategory] = useState<Category>("work");
  const [priority, setPriority] = useState<Priority>("mid");
  const [reminder, setReminder] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [colorPickerFor, setColorPickerFor] = useState<Category | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const reminderRef = useRef<HTMLDivElement>(null);
  const reminderListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDesc(editTask.description ?? "");
      setCategory(editTask.category);
      setPriority(editTask.priority);
      setReminder(editTask.reminder ?? "");
    }
  }, [editTask]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
        setColorPickerFor(null);
      }
      if (
        reminderRef.current &&
        !reminderRef.current.contains(e.target as Node)
      ) {
        setReminderOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!reminderOpen || !reminderListRef.current) return;
    const selected = reminderListRef.current.querySelector(
      ".time-option.selected",
    ) as HTMLElement | null;
    if (selected) selected.scrollIntoView({ block: "center" });
  }, [reminderOpen]);

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
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-title">
          {editTask ? "Sửa task" : "Thêm task mới"}
        </div>

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
              style={{ resize: "vertical" }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Danh mục</label>
              <div className="cat-dropdown" ref={dropdownRef}>
                <button
                  type="button"
                  className="cat-dropdown-trigger"
                  onClick={() => {
                    setDropdownOpen((v) => !v);
                    setColorPickerFor(null);
                  }}
                >
                  <span
                    className="cat-color-dot"
                    style={{ background: categoryColors[category] }}
                  />
                  <span className="cat-dropdown-label">
                    {CATEGORIES.find((c) => c.value === category)?.label}
                  </span>
                  <IconChevronDown
                    size={13}
                    className={`cat-dropdown-chevron${dropdownOpen ? " open" : ""}`}
                  />
                </button>
                {dropdownOpen && (
                  <div className="cat-dropdown-panel">
                    {CATEGORIES.map((cat) => (
                      <div
                        key={cat.value}
                        className={`cat-dropdown-item${category === cat.value ? " selected" : ""}`}
                      >
                        <button
                          type="button"
                          className="cat-dropdown-item-btn"
                          onClick={() => {
                            setCategory(cat.value);
                            setDropdownOpen(false);
                            setColorPickerFor(null);
                          }}
                        >
                          <span
                            className="cat-color-dot"
                            style={{ background: categoryColors[cat.value] }}
                          />
                          <span>{cat.label}</span>
                        </button>
                        <button
                          type="button"
                          className={`cat-item-dots${colorPickerFor === cat.value ? " active" : ""}`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setColorPickerFor((prev) =>
                              prev === cat.value ? null : cat.value,
                            );
                          }}
                          title="Đổi màu"
                        >
                          <IconDotsVertical size={13} />
                        </button>
                        {colorPickerFor === cat.value && (
                          <div
                            className="cat-color-popup"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            {COLOR_PALETTE.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`color-swatch${categoryColors[cat.value] === color ? " color-swatch-active" : ""}`}
                                style={{ background: color }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCategoryColor(cat.value, color);
                                }}
                                title={color}
                              >
                                {categoryColors[cat.value] === color && (
                                  <IconCheck
                                    size={10}
                                    strokeWidth={3}
                                    color="#fff"
                                  />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Ưu tiên</label>
              <select
                className="form-input"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Giờ nhắc nhở</label>
            <div className="time-dropdown" ref={reminderRef}>
              <button
                type="button"
                className={`time-dropdown-trigger${reminderOpen ? " open" : ""}`}
                onClick={() => setReminderOpen((v) => !v)}
              >
                {reminder ? (
                  <IconBell size={14} className="time-dropdown-icon" />
                ) : (
                  <IconBellOff size={14} className="time-dropdown-icon muted" />
                )}
                <span
                  className={`time-dropdown-value${!reminder ? " placeholder" : ""}`}
                >
                  {reminder || "Không nhắc nhở"}
                </span>
                <IconChevronDown
                  size={13}
                  className={`cat-dropdown-chevron${reminderOpen ? " open" : ""}`}
                />
              </button>
              {reminderOpen && (
                <div className="time-dropdown-panel">
                  <div className="time-dropdown-list" ref={reminderListRef}>
                    <button
                      type="button"
                      className={`time-option${!reminder ? " selected" : ""}`}
                      onClick={() => {
                        setReminder("");
                        setReminderOpen(false);
                      }}
                    >
                      <IconBellOff size={13} className="time-option-icon" />
                      Không nhắc nhở
                    </button>
                    <div className="time-option-divider" />
                    {TIME_OPTIONS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`time-option${reminder === t ? " selected" : ""}`}
                        onClick={() => {
                          setReminder(t);
                          setReminderOpen(false);
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              {editTask ? "Lưu thay đổi" : "Thêm task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
