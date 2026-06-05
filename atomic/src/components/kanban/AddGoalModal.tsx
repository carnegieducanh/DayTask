import { useState, useEffect, useRef } from "react";
import {
  IconX,
  IconPlus,
  IconCheck,
  IconDotsVertical,
  IconChevronDown,
} from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type {
  Goal,
  Category,
  Priority,
  Quarter,
  GoalStatus,
} from "../../types";

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

interface Props {
  editGoal?: Goal | null;
  defaultStatus?: GoalStatus;
  onClose: () => void;
}

export default function AddGoalModal({
  editGoal,
  defaultStatus = "todo",
  onClose,
}: Props) {
  const t = useT();
  const {
    selectedYear,
    addGoal,
    updateGoal,
    checklistItems,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    categoryColors,
    updateCategoryColor,
  } = useAppStore();

  const CATEGORIES: { value: Category; label: string }[] = [
    { value: "work",         label: t.cat.work },
    { value: "personal",     label: t.cat.personal },
    { value: "health",       label: t.cat.health },
    { value: "learn",        label: t.cat.learn },
    { value: "creative",     label: t.cat.creative },
    { value: "mindfulness",  label: t.cat.mindfulness },
    { value: "finance",      label: t.cat.finance },
  ];

  const PRIORITIES: { value: Priority; label: string }[] = [
    { value: "high", label: t.priority.high },
    { value: "mid",  label: t.priority.mid },
    { value: "low",  label: t.priority.low },
  ];

  const QUARTERS: { value: Quarter; label: string }[] = [
    { value: "Q1",   label: t.quarter.Q1 },
    { value: "Q2",   label: t.quarter.Q2 },
    { value: "Q3",   label: t.quarter.Q3 },
    { value: "Q4",   label: t.quarter.Q4 },
    { value: "full", label: t.quarter.full },
  ];

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<Category>("work");
  const [priority, setPriority] = useState<Priority>("mid");
  const [quarter, setQuarter] = useState<Quarter>("Q1");

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [colorPickerFor, setColorPickerFor] = useState<Category | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [newItemText, setNewItemText] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editGoal) {
      setTitle(editGoal.title);
      setDesc(editGoal.description ?? "");
      setCategory(editGoal.category);
      setPriority(editGoal.priority);
      setQuarter(editGoal.quarter);
    }
  }, [editGoal]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
        setColorPickerFor(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    if (editGoal) {
      await updateGoal(editGoal.id, {
        title: title.trim(),
        description: desc.trim() || undefined,
        category,
        priority,
        quarter,
      });
    } else {
      await addGoal({
        title: title.trim(),
        description: desc.trim() || undefined,
        category,
        priority,
        quarter,
        year: selectedYear,
        status: defaultStatus,
      });
    }
    onClose();
  }

  async function handleAddItem() {
    if (!editGoal || !newItemText.trim()) return;
    await addChecklistItem(editGoal.id, newItemText.trim());
    setNewItemText("");
    addInputRef.current?.focus();
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  }

  const items = editGoal ? (checklistItems[editGoal.id] ?? []) : [];
  const doneCount = items.filter((i) => i.is_done).length;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal modal-goal-detail">
        <div className="modal-title">
          {editGoal ? t.goalModal.editTitle : t.goalModal.addTitle}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t.goalModal.goalNameLabel}</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.goalModal.goalNamePlaceholder}
              autoFocus
              spellCheck={false}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t.goalModal.descLabel}</label>
            <textarea
              className="form-input"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              spellCheck={false}
              style={{ resize: "vertical" }}
              spellCheck={false}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t.goalModal.categoryLabel}</label>
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
                          title={t.goalModal.changeColor}
                        >
                          <IconDotsVertical size={16} />
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
              <label className="form-label">{t.goalModal.priorityLabel}</label>
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
            <label className="form-label">{t.goalModal.quarterLabel}</label>
            <select
              className="form-input"
              value={quarter}
              onChange={(e) => setQuarter(e.target.value as Quarter)}
            >
              {QUARTERS.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>

          {/* Checklist section — chỉ hiện khi đang edit goal đã có */}
          {editGoal && (
            <div className="checklist-section">
              <div className="checklist-header">
                <span className="checklist-title">{t.goalModal.checklistTitle}</span>
                {items.length > 0 && (
                  <span className="checklist-count">
                    {doneCount}/{items.length}
                  </span>
                )}
              </div>

              {items.length > 0 && (
                <div className="checklist-progress-bar">
                  <div
                    className="checklist-progress-fill"
                    style={{
                      width: `${Math.round((doneCount / items.length) * 100)}%`,
                    }}
                  />
                </div>
              )}

              <div className="checklist-items">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`checklist-item${item.is_done ? " checklist-item-done" : ""}`}
                    onClick={() => toggleChecklistItem(item.id, editGoal.id)}
                  >
                    <button
                      type="button"
                      className={`checklist-checkbox${item.is_done ? " checked" : ""}`}
                      onClick={(e) => e.stopPropagation()}
                      title={item.is_done ? t.goalModal.markUndone : t.goalModal.markDone}
                    >
                      {!!item.is_done && (
                        <IconCheck size={11} strokeWidth={3} />
                      )}
                    </button>
                    <span className="checklist-item-text">{item.text}</span>
                    <button
                      type="button"
                      className="checklist-item-delete"
                      onClick={(e) => { e.stopPropagation(); deleteChecklistItem(item.id, editGoal.id); }}
                      title={t.goalModal.delete}
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
                  spellCheck={false}
                  onKeyDown={handleAddKeyDown}
                  placeholder={t.goalModal.addItemPlaceholder}
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="checklist-add-btn"
                  onClick={handleAddItem}
                  disabled={!newItemText.trim()}
                  title={t.goalModal.add}
                >
                  <IconPlus size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t.goalModal.cancel}
            </button>
            <button type="submit" className="btn btn-primary">
              {editGoal ? t.goalModal.save : t.goalModal.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
