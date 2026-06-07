import { useState, useEffect, useRef, useCallback } from "react";
import { attachSmoothScroll } from "../../hooks/useSmoothScroll";
import { useModalClose } from "../../hooks/useModalClose";
import {
  IconX,
  IconPlus,
  IconCheck,
  IconPencil,
  IconDotsVertical,
  IconChevronDown,
} from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type {
  Goal,
  Category,
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
  const overlayHandlers = useModalClose(onClose);
  const {
    selectedYear,
    addGoal,
    updateGoal,
    checklistItems,
    addChecklistItem,
    toggleChecklistItem,
    updateChecklistItem,
    softDeleteChecklistItem,
    categoryColors,
    updateTaskColor,
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
  const [quarter, setQuarter] = useState<Quarter>("Q1");

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [colorPickerFor, setColorPickerFor] = useState<Category | null>(null);
  const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const smoothCleanup = useRef<(() => void) | null>(null);
  const panelRef = useCallback((el: HTMLDivElement | null) => {
    smoothCleanup.current?.();
    smoothCleanup.current = el ? attachSmoothScroll(el) : null;
  }, []);
  const modalSmoothCleanup = useRef<(() => void) | null>(null);
  const setModalRef = useCallback((el: HTMLDivElement | null) => {
    modalSmoothCleanup.current?.();
    modalSmoothCleanup.current = el ? attachSmoothScroll(el) : null;
  }, []);

  const [newItemText, setNewItemText] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const checklistItemsRef = useRef<HTMLDivElement>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [pendingItems, setPendingItems] = useState<{ id: number; text: string }[]>([]);
  const nextPendingId = useRef(0);

  useEffect(() => {
    if (editGoal) {
      setTitle(editGoal.title);
      setDesc(editGoal.description ?? "");
      setCategory(editGoal.category);
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
        setDropdownPos(null);
        setColorPickerFor(null);
        setColorPickerPos(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    if (editGoal) {
      await updateGoal(editGoal.id, {
        title: title.trim(),
        description: desc.trim() || undefined,
        category,
        quarter,
      });
    } else {
      const newId = await addGoal({
        title: title.trim(),
        description: desc.trim() || undefined,
        category,
        quarter,
        year: selectedYear,
        status: defaultStatus,
      });
      for (const item of pendingItems) {
        await addChecklistItem(newId, item.text);
      }
    }
    onClose();
  }

  async function handleAddItem() {
    if (!newItemText.trim()) return;
    if (editGoal) {
      await addChecklistItem(editGoal.id, newItemText.trim());
    } else {
      setPendingItems((prev) => [...prev, { id: nextPendingId.current++, text: newItemText.trim() }]);
    }
    setNewItemText("");
    addInputRef.current?.focus();
    setTimeout(() => {
      const el = checklistItemsRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  }

  function startEditItem(id: number, text: string) {
    setEditingItemId(id);
    setEditingText(text);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }

  async function commitEditItem() {
    if (editingItemId === null) return;
    const trimmed = editingText.trim();
    if (trimmed) {
      if (editGoal) {
        await updateChecklistItem(editingItemId, editGoal.id, trimmed);
      } else {
        setPendingItems((prev) => prev.map((item) => item.id === editingItemId ? { ...item, text: trimmed } : item));
      }
    }
    setEditingItemId(null);
    setEditingText("");
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commitEditItem(); }
    if (e.key === "Escape") { setEditingItemId(null); setEditingText(""); }
  }

  const items = editGoal ? (checklistItems[editGoal.id] ?? []) : [];
  const doneCount = items.filter((i) => i.is_done).length;

  return (
    <div
      className="modal-overlay"
      {...overlayHandlers}
    >
      <div className="modal modal-goal-detail" ref={setModalRef}>
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
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t.goalModal.categoryLabel}</label>
              <div className="cat-dropdown" ref={dropdownRef}>
                <button
                  ref={triggerRef}
                  type="button"
                  className="cat-dropdown-trigger"
                  onClick={() => {
                    const isOpening = !dropdownOpen;
                    if (isOpening && triggerRef.current) {
                      const r = triggerRef.current.getBoundingClientRect();
                      setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
                    } else {
                      setDropdownPos(null);
                    }
                    setDropdownOpen((v) => !v);
                    setColorPickerFor(null);
                    setColorPickerPos(null);
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
                {dropdownOpen && dropdownPos && (
                  <div
                    className="cat-dropdown-panel"
                    ref={panelRef}
                    style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
                  >
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
                            setDropdownPos(null);
                            setColorPickerFor(null);
                            setColorPickerPos(null);
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
                            const isOpening = colorPickerFor !== cat.value;
                            if (isOpening) {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setColorPickerPos({ top: rect.top, left: rect.right + 8 });
                            } else {
                              setColorPickerPos(null);
                            }
                            setColorPickerFor((prev) =>
                              prev === cat.value ? null : cat.value,
                            );
                          }}
                          title={t.goalModal.changeColor}
                        >
                          <IconDotsVertical size={16} />
                        </button>
                        {colorPickerFor === cat.value && colorPickerPos && (
                          <div
                            className="cat-color-popup"
                            style={{ position: 'fixed', top: colorPickerPos.top, left: colorPickerPos.left }}
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
                                  updateTaskColor(cat.value, color);
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
          </div>

          {/* Checklist section — hiện cả khi add mới lẫn edit */}
          <div className="checklist-section">
            <div className="checklist-header">
              <span className="checklist-title">{t.goalModal.checklistTitle}</span>
              {editGoal ? (
                items.length > 0 && (
                  <span className="checklist-count">{doneCount}/{items.length}</span>
                )
              ) : (
                pendingItems.length > 0 && (
                  <span className="checklist-count">{pendingItems.length}</span>
                )
              )}
            </div>

            {editGoal && items.length > 0 && (
              <div className="checklist-progress-bar">
                <div
                  className="checklist-progress-fill"
                  style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }}
                />
              </div>
            )}

            <div className="checklist-items" ref={checklistItemsRef}>
              {editGoal
                ? items.map((item) => (
                    <div
                      key={item.id}
                      className={`checklist-item${item.is_done ? " checklist-item-done" : ""}${editingItemId === item.id ? " checklist-item-editing" : ""}`}
                      onClick={() => editingItemId !== item.id && toggleChecklistItem(item.id, editGoal.id)}
                    >
                      <button
                        type="button"
                        className={`checklist-checkbox${item.is_done ? " checked" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggleChecklistItem(item.id, editGoal.id); }}
                        title={item.is_done ? t.goalModal.markUndone : t.goalModal.markDone}
                      >
                        {!!item.is_done && <IconCheck size={11} strokeWidth={3} />}
                      </button>
                      {editingItemId === item.id ? (
                        <input
                          ref={editInputRef}
                          className="checklist-item-edit-input"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={commitEditItem}
                          onKeyDown={handleEditKeyDown}
                          onClick={(e) => e.stopPropagation()}
                          spellCheck={false}
                        />
                      ) : (
                        <span className="checklist-item-text">{item.text}</span>
                      )}
                      <button
                        type="button"
                        className="checklist-item-edit"
                        onClick={(e) => { e.stopPropagation(); startEditItem(item.id, item.text); }}
                        title={t.goalModal.editItem}
                      >
                        <IconPencil size={11} />
                      </button>
                      <button
                        type="button"
                        className="checklist-item-delete"
                        onClick={(e) => { e.stopPropagation(); softDeleteChecklistItem(item.id, editGoal.id); }}
                        title={t.goalModal.delete}
                      >
                        <IconX size={11} />
                      </button>
                    </div>
                  ))
                : pendingItems.map((item) => (
                    <div
                      key={item.id}
                      className={`checklist-item${editingItemId === item.id ? " checklist-item-editing" : ""}`}
                    >
                      <button type="button" className="checklist-checkbox" disabled />
                      {editingItemId === item.id ? (
                        <input
                          ref={editInputRef}
                          className="checklist-item-edit-input"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={commitEditItem}
                          onKeyDown={handleEditKeyDown}
                          onClick={(e) => e.stopPropagation()}
                          spellCheck={false}
                        />
                      ) : (
                        <span className="checklist-item-text">{item.text}</span>
                      )}
                      <button
                        type="button"
                        className="checklist-item-edit"
                        onClick={(e) => { e.stopPropagation(); startEditItem(item.id, item.text); }}
                        title={t.goalModal.editItem}
                      >
                        <IconPencil size={11} />
                      </button>
                      <button
                        type="button"
                        className="checklist-item-delete"
                        onClick={(e) => { e.stopPropagation(); setPendingItems((prev) => prev.filter((i) => i.id !== item.id)); }}
                        title={t.goalModal.delete}
                      >
                        <IconX size={11} />
                      </button>
                    </div>
                  ))
              }
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
