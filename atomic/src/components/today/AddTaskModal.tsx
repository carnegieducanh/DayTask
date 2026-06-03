import { useState, useEffect, useRef } from "react";
import type React from "react";
import {
  IconChevronDown,
  IconDotsVertical,
  IconCheck,
  IconClock,
  IconClockOff,
  IconTag,
  IconX,
  IconPencil,
  IconTrash,
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
import { useT } from "../../i18n";
import type { Task, Category } from "../../types";

function TimeDropdown({
  label,
  value,
  open,
  setOpen,
  onChange,
  dropRef,
  listRef,
}: {
  label: string;
  value: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  onChange: (v: string) => void;
  dropRef: React.RefObject<HTMLDivElement | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useT();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  function handleClick() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        right: 'auto',
      });
    }
    setOpen(!open);
  }

  return (
    <div className="form-group" style={{ flex: 1 }}>
      <label className="form-label">{label}</label>
      <div className="time-dropdown" ref={dropRef}>
        <button
          ref={triggerRef}
          type="button"
          className={`time-dropdown-trigger${open ? " open" : ""}`}
          onClick={handleClick}
        >
          {value ? (
            <IconClock size={14} className="time-dropdown-icon" />
          ) : (
            <IconClockOff size={14} className="time-dropdown-icon muted" />
          )}
          <span className={`time-dropdown-value${!value ? " placeholder" : ""}`}>
            {value || t.taskModal.noTime}
          </span>
          <IconChevronDown
            size={13}
            className={`cat-dropdown-chevron${open ? " open" : ""}`}
          />
        </button>
        {open && (
          <div className="time-dropdown-panel" style={panelStyle}>
            <div className="time-dropdown-list" ref={listRef}>
              <button
                type="button"
                className={`time-option${!value ? " selected" : ""}`}
                onClick={() => { onChange(""); setOpen(false); }}
              >
                <IconClockOff size={13} className="time-option-icon" />
                {t.taskModal.noTime}
              </button>
              <div className="time-option-divider" />
              {TIME_OPTIONS.map((time) => (
                <button
                  key={time}
                  type="button"
                  className={`time-option${value === time ? " selected" : ""}`}
                  onClick={() => { onChange(time); setOpen(false); }}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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

function getDefaultStartTime(): string {
  const now = new Date();
  const totalMin = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil(totalMin / 15) * 15;
  const h = Math.floor(rounded / 60) % 24;
  const m = rounded % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface Props {
  editTask?: Task | null;
  onClose: () => void;
  initialStartTime?: string;
  initialEndTime?: string;
}

export default function AddTaskModal({ editTask, onClose, initialStartTime, initialEndTime }: Props) {
  const t = useT();
  const {
    selectedDate,
    addTask,
    updateTask,
    categoryColors,
    updateCategoryColor,
    taskTimeEntries,
    saveTimeEntry,
    deleteTimeEntry,
    tags,
    taskTags,
    addTag,
    updateTag,
    softDeleteTag,
    setTaskTags,
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

  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [category, setCategory] = useState<Category>("work");
  const [startTime, setStartTime] = useState(() => editTask ? "" : (initialStartTime ?? getDefaultStartTime()));
  const [endTime, setEndTime] = useState(() => editTask ? "" : (initialEndTime ?? getDefaultStartTime()));
  const [repeatDaily, setRepeatDaily] = useState(!editTask);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [catPanelStyle, setCatPanelStyle] = useState<React.CSSProperties>({});
  const [colorPickerFor, setColorPickerFor] = useState<Category | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [timeError, setTimeError] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [renamingTagId, setRenamingTagId] = useState<number | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [tagPanelStyle, setTagPanelStyle] = useState<React.CSSProperties>({});
  const newTagInputRef = useRef<HTMLInputElement>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const catTriggerRef = useRef<HTMLButtonElement>(null);
  const tagDropRef = useRef<HTMLDivElement>(null);
  const tagTriggerRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const startListRef = useRef<HTMLDivElement>(null);
  const endListRef = useRef<HTMLDivElement>(null);

  // Only lock the toggle for instances (series_id != null); templates can still turn off repeat
  const isSeriesInstance = !!(editTask && editTask.series_id != null);

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDesc(editTask.description ?? "");
      setCategory(editTask.category);
      setRepeatDaily(editTask.repeat_daily === 1 || editTask.series_id != null);
      setSelectedTagIds(taskTags[editTask.id] ?? []);
      const entry = taskTimeEntries.find(
        (e) => e.task_id === editTask.id && e.date === editTask.date,
      );
      if (entry) {
        setStartTime(entry.start_time);
        setEndTime(entry.end_time);
      }
    }
  }, [editTask]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setColorPickerFor(null);
      }
      if (tagDropRef.current && !tagDropRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
        setShowNewTagInput(false);
        setNewTagInput("");
      }
      if (startRef.current && !startRef.current.contains(e.target as Node)) {
        setStartOpen(false);
      }
      if (endRef.current && !endRef.current.contains(e.target as Node)) {
        setEndOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!startOpen || !startListRef.current) return;
    const selected = startListRef.current.querySelector(".time-option.selected") as HTMLElement | null;
    if (selected) selected.scrollIntoView({ block: "center" });
  }, [startOpen]);

  useEffect(() => {
    if (!endOpen || !endListRef.current) return;
    const selected = endListRef.current.querySelector(".time-option.selected") as HTMLElement | null;
    if (selected) selected.scrollIntoView({ block: "center" });
  }, [endOpen]);

  function validateTimes(): boolean {
    if (!startTime && !endTime) return true;
    if (startTime && !endTime) { setTimeError(t.taskModal.endTimeLabel + " ?"); return false; }
    if (!startTime && endTime) { setTimeError(t.taskModal.startTimeLabel + " ?"); return false; }
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      setTimeError(t.taskCard.timeEndBeforeStart);
      return false;
    }
    setTimeError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (!validateTimes()) return;

    const date = editTask ? editTask.date : selectedDate;
    const timeEntry = startTime && endTime ? { startTime, endTime } : undefined;

    if (editTask) {
      await updateTask(editTask.id, {
        title: title.trim(),
        description: description.trim() || null,
        category,
        repeat_daily: repeatDaily ? 1 : 0,
      });
      await setTaskTags(editTask.id, selectedTagIds);
      if (timeEntry) {
        await saveTimeEntry(editTask.id, editTask.date, timeEntry.startTime, timeEntry.endTime);
      } else {
        await deleteTimeEntry(editTask.id, editTask.date);
      }
    } else {
      await addTask(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          date,
          repeat_daily: repeatDaily ? 1 : 0,
        },
        timeEntry,
        selectedTagIds.length ? selectedTagIds : undefined,
      );
    }
    onClose();
  }

  function handleTagDropdownClick() {
    if (!tagDropdownOpen && tagTriggerRef.current) {
      const rect = tagTriggerRef.current.getBoundingClientRect();
      setTagPanelStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 200),
        right: 'auto',
      });
    }
    setTagDropdownOpen((v) => !v);
  }

  function toggleTag(id: number) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleCreateTag() {
    const name = newTagInput.trim();
    if (!name) return;
    const newId = await addTag(name);
    setSelectedTagIds((prev) => [...prev, newId]);
    setNewTagInput("");
    setShowNewTagInput(false);
  }

  function handleNewTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); }
    if (e.key === "Escape") { setShowNewTagInput(false); setNewTagInput(""); }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-title">
          {editTask ? t.taskModal.editTitle : t.taskModal.addTitle}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t.taskModal.taskNameLabel}</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.taskModal.taskNamePlaceholder}
              autoFocus
              spellCheck={false}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t.taskModal.descLabel}</label>
            <textarea
              className="form-input"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={t.taskModal.descPlaceholder}
              rows={2}
              style={{ resize: "vertical" }}
              spellCheck={false}
            />
          </div>

          <div className="form-row" style={{ marginBottom: 14 }}>
            {/* Category */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{t.taskModal.categoryLabel}</label>
              <div className="cat-dropdown" ref={dropdownRef}>
                <button
                  ref={catTriggerRef}
                  type="button"
                  className="cat-dropdown-trigger"
                  onClick={() => {
                    if (!dropdownOpen && catTriggerRef.current) {
                      const rect = catTriggerRef.current.getBoundingClientRect();
                      setCatPanelStyle({
                        position: 'fixed',
                        top: rect.bottom + 4,
                        left: rect.left,
                        width: rect.width,
                        right: 'auto',
                      });
                    }
                    setDropdownOpen((v) => !v);
                    setColorPickerFor(null);
                  }}
                >
                  <span className="cat-color-dot" style={{ background: categoryColors[category] }} />
                  <span className="cat-dropdown-label">
                    {CATEGORIES.find((c) => c.value === category)?.label}
                  </span>
                  <IconChevronDown
                    size={13}
                    className={`cat-dropdown-chevron${dropdownOpen ? " open" : ""}`}
                  />
                </button>
                {dropdownOpen && (
                  <div className="cat-dropdown-panel" style={catPanelStyle}>
                    {CATEGORIES.map((cat) => (
                      <div
                        key={cat.value}
                        className={`cat-dropdown-item${category === cat.value ? " selected" : ""}`}
                      >
                        <button
                          type="button"
                          className="cat-dropdown-item-btn"
                          onClick={() => { setCategory(cat.value); setDropdownOpen(false); setColorPickerFor(null); }}
                        >
                          <span className="cat-color-dot" style={{ background: categoryColors[cat.value] }} />
                          <span>{cat.label}</span>
                        </button>
                        <button
                          type="button"
                          className={`cat-item-dots${colorPickerFor === cat.value ? " active" : ""}`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setColorPickerFor((prev) => prev === cat.value ? null : cat.value);
                          }}
                          title={t.taskModal.changeColor}
                        >
                          <IconDotsVertical size={16} />
                        </button>
                        {colorPickerFor === cat.value && (
                          <div className="cat-color-popup" onMouseDown={(e) => e.stopPropagation()}>
                            {COLOR_PALETTE.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`color-swatch${categoryColors[cat.value] === color ? " color-swatch-active" : ""}`}
                                style={{ background: color }}
                                onClick={(e) => { e.stopPropagation(); updateCategoryColor(cat.value, color); }}
                                title={color}
                              >
                                {categoryColors[cat.value] === color && (
                                  <IconCheck size={10} strokeWidth={3} color="#fff" />
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

            {/* Tag dropdown */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                <IconTag size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {t.taskModal.tagLabel}
              </label>
              <div className="tag-dropdown" ref={tagDropRef}>
                <button
                  ref={tagTriggerRef}
                  type="button"
                  className={`tag-dropdown-trigger${tagDropdownOpen ? " open" : ""}`}
                  onClick={handleTagDropdownClick}
                >
                  {selectedTagIds.length === 0 ? (
                    <>
                      <IconTag size={13} className="time-dropdown-icon muted" />
                      <span className="tag-dropdown-label placeholder">{t.taskModal.noTag}</span>
                    </>
                  ) : (
                    <span className="tag-dropdown-label">
                      {(() => {
                        const sel = tags.filter((tg) => selectedTagIds.includes(tg.id));
                        return sel.length === 1
                          ? sel[0].name
                          : `${sel[0]?.name ?? ''} +${sel.length - 1}`;
                      })()}
                    </span>
                  )}
                  <IconChevronDown size={13} className={`cat-dropdown-chevron${tagDropdownOpen ? " open" : ""}`} />
                </button>
                {tagDropdownOpen && (
                  <div className="tag-dropdown-panel" style={tagPanelStyle}>
                    <div className="tag-dropdown-list">
                      {tags.length === 0 && (
                        <div className="tag-dropdown-empty">{t.tags.noTags}</div>
                      )}
                      {tags.map((tag) => {
                        const selected = selectedTagIds.includes(tag.id);
                        return (
                          <div
                            key={tag.id}
                            className={`tag-dropdown-item${selected ? " selected" : ""}`}
                          >
                            {renamingTagId === tag.id ? (
                              <>
                                <input
                                  className="tag-dropdown-rename-input"
                                  value={renameInput}
                                  onChange={(e) => setRenameInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      if (renameInput.trim()) updateTag(tag.id, renameInput.trim());
                                      setRenamingTagId(null);
                                    }
                                    if (e.key === "Escape") setRenamingTagId(null);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                  spellCheck={false}
                                />
                                <button
                                  type="button"
                                  className="tag-dropdown-action-btn"
                                  onClick={(e) => { e.stopPropagation(); if (renameInput.trim()) updateTag(tag.id, renameInput.trim()); setRenamingTagId(null); }}
                                >
                                  <IconCheck size={12} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="tag-dropdown-item-select"
                                  onClick={() => toggleTag(tag.id)}
                                >
                                  <span className="tag-dropdown-check">
                                    {selected && <IconCheck size={13} strokeWidth={3} />}
                                  </span>
                                  <span>{tag.name}</span>
                                </button>
                                <div className="tag-dropdown-item-actions">
                                  <button
                                    type="button"
                                    className="tag-dropdown-action-btn"
                                    onClick={(e) => { e.stopPropagation(); setRenamingTagId(tag.id); setRenameInput(tag.name); }}
                                  >
                                    <IconPencil size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    className="tag-dropdown-action-btn tag-dropdown-action-delete"
                                    onClick={(e) => { e.stopPropagation(); softDeleteTag(tag.id); setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id)); }}
                                  >
                                    <IconTrash size={12} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="tag-dropdown-footer">
                      {showNewTagInput ? (
                        <div className="tag-picker-new-input">
                          <input
                            ref={newTagInputRef}
                            className="tag-picker-input"
                            value={newTagInput}
                            onChange={(e) => setNewTagInput(e.target.value)}
                            onKeyDown={handleNewTagKeyDown}
                            placeholder={t.tags.addPlaceholder}
                            autoFocus
                            spellCheck={false}
                          />
                          <button type="button" className="tag-picker-confirm" onClick={handleCreateTag}>
                            <IconCheck size={12} strokeWidth={3} />
                          </button>
                          <button type="button" className="tag-picker-cancel" onClick={() => { setShowNewTagInput(false); setNewTagInput(""); }}>
                            <IconX size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="tag-dropdown-add-btn"
                          onClick={() => { setShowNewTagInput(true); setTimeout(() => newTagInputRef.current?.focus(), 0); }}
                        >
                          {t.tags.createNew}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-row">
            <TimeDropdown
              label={t.taskModal.startTimeLabel}
              value={startTime}
              open={startOpen}
              setOpen={setStartOpen}
              onChange={(v) => { if (!editTask && endTime === startTime) setEndTime(v); setStartTime(v); setTimeError(""); }}
              dropRef={startRef}
              listRef={startListRef}
            />
            <TimeDropdown
              label={t.taskModal.endTimeLabel}
              value={endTime}
              open={endOpen}
              setOpen={setEndOpen}
              onChange={(v) => { setEndTime(v); setTimeError(""); }}
              dropRef={endRef}
              listRef={endListRef}
            />
          </div>
          {timeError && (
            <div className="time-error">{timeError}</div>
          )}

          <div className="form-group">
            <div className="repeat-row">
              <div>
                <div className="form-label" style={{ marginBottom: 2 }}>{t.taskModal.repeatLabel}</div>
                <div className="repeat-hint">
                  {isSeriesInstance ? t.taskModal.repeatSeriesHint : t.taskModal.repeatHint}
                </div>
              </div>
              <button
                type="button"
                className={`toggle-switch${repeatDaily ? " on" : ""}`}
                onClick={() => !isSeriesInstance && setRepeatDaily((v) => !v)}
                aria-pressed={repeatDaily}
                style={isSeriesInstance ? { opacity: 0.5, cursor: 'default' } : undefined}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t.taskModal.cancel}
            </button>
            <button type="submit" className="btn btn-primary">
              {editTask ? t.taskModal.save : t.taskModal.add}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
