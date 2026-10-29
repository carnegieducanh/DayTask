import { useState, useEffect, useRef, useCallback } from 'react';
import './journal.css';
import {
  IconHeart, IconBulb, IconPencil,
  IconTrash, IconX, IconPlus, IconCheck,
  IconChevronLeft, IconChevronRight, IconFlame,
} from '@tabler/icons-react';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { useT } from '../../i18n';
import type { JournalEntry, JournalStats, JournalType } from '../../types';
import {
  dbGetJournal, dbSaveJournal, dbDeleteJournal,
  dbGetJournalHistory, dbGetJournalStreak,
  dbGetJournalStats, dbGetDatesWithEntries,
  seedJournalIfEmpty,
} from '../../store/journalDb';

// ─── Constants ───────────────────────────────────────────────────────────────

const LESSON_GROUP_SIZE = 4; // Vấn đề · Nguyên nhân · Trạng thái mong muốn · Hành động
type JTab = 'gratitude' | 'lesson';

// Số ô trống khi ngày đó chưa có ghi chép
const DEFAULT_COUNT: Record<JTab, number> = {
  gratitude: 3,
  lesson: LESSON_GROUP_SIZE,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(
  dateStr: string,
  dowFull: string[],
  formatFn: (dow: string, day: number, month: number) => string,
) {
  const d = new Date(dateStr + 'T00:00:00');
  return formatFn(dowFull[d.getDay()], d.getDate(), d.getMonth() + 1);
}

function fmtDateShort(
  dateStr: string,
  formatFn: (day: number, month: number, year: number) => string,
) {
  const d = new Date(dateStr + 'T00:00:00');
  return formatFn(d.getDate(), d.getMonth() + 1, d.getFullYear());
}

function formatSavedTime(updatedAt: string): string {
  // SQLite datetime('now') trả về UTC: "2026-06-05 08:30:00"
  const d = new Date(updatedAt.replace(' ', 'T') + 'Z');
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function emptyItems(type: JTab): string[] {
  return Array(DEFAULT_COUNT[type]).fill('');
}

function ensureLessonItems(items: string[]): string[] {
  if (items.length === 0) return Array(LESSON_GROUP_SIZE).fill('');
  const extra = items.length % LESSON_GROUP_SIZE;
  return extra === 0 ? items : [...items, ...Array(LESSON_GROUP_SIZE - extra).fill('')];
}

function chunkLessons(items: string[]): string[][] {
  if (items.length === 0) return [Array(LESSON_GROUP_SIZE).fill('')];
  const groups: string[][] = [];
  for (let i = 0; i < items.length; i += LESSON_GROUP_SIZE) {
    const group: string[] = [];
    for (let f = 0; f < LESSON_GROUP_SIZE; f++) group.push(items[i + f] ?? '');
    groups.push(group);
  }
  return groups;
}

// ─── AutoTextarea ────────────────────────────────────────────────────────────

function AutoTextarea({
  value, onChange, placeholder, className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { autoResize(ref.current); }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      placeholder={placeholder}
      className={className ?? 'jm-wc-ta'}
      spellCheck={false}
      style={{ resize: 'none', overflow: 'hidden' }}
      onChange={e => onChange(e.target.value)}
      onInput={e => autoResize(e.target as HTMLTextAreaElement)}
    />
  );
}

// ─── Write card: header + footer dùng chung cho Biết ơn và Bài học ─────────

function WriteHeader({
  isToday, dateLabel, savedEntry,
}: {
  isToday: boolean;
  dateLabel: string;
  savedEntry: JournalEntry | null;
}) {
  const { journal: jt } = useT();
  return (
    <div className="jm-wc-header">
      <span className="jm-wc-title">{isToday ? jt.writeToday : jt.writeDate(dateLabel)}</span>
      {savedEntry ? (
        <span className="jm-wc-status saved">
          <IconCheck size={13} /> {jt.savedAt(formatSavedTime(savedEntry.updated_at))}
        </span>
      ) : (
        <span className="jm-wc-status">{dateLabel}</span>
      )}
    </div>
  );
}

function WriteFooter({
  charCount, saving, isSaved, hasEntry, canSave, onSave,
}: {
  charCount: number;
  saving: boolean;
  isSaved: boolean;
  hasEntry: boolean;
  canSave: boolean;
  onSave: () => void;
}) {
  const { journal: jt } = useT();
  return (
    <div className="jm-wc-footer">
      <span className="jm-wc-char">{jt.charCount(charCount)}</span>
      <button className="jm-wc-save" disabled={saving || isSaved || !canSave} onClick={onSave}>
        {saving
          ? jt.saving
          : isSaved
            ? <><IconCheck size={14} /> {jt.saved}</>
            : hasEntry
              ? jt.update
              : jt.saveToday}
      </button>
    </div>
  );
}

// ─── WriteCard ───────────────────────────────────────────────────────────────

function WriteCard({
  items, setItems, dateLabel, onSave, onClear, saving, todayEntry, isDirty, isToday, placeholder,
}: {
  items: string[];
  setItems: (items: string[]) => void;
  dateLabel: string;
  onSave: () => void;
  onClear: () => void;
  saving: boolean;
  todayEntry: JournalEntry | null;
  isDirty: boolean;
  isToday: boolean;
  placeholder: string;
}) {
  const { journal: jt } = useT();
  const charCount = items.reduce((s, i) => s + i.length, 0);
  const hasContent = items.some(i => i.trim());
  const isSaved = !!todayEntry && !isDirty;

  function updateItem(idx: number, val: string) {
    const next = [...items]; next[idx] = val; setItems(next);
  }
  function removeItem(idx: number) {
    const next = items.length <= 1 ? [''] : items.filter((_, i) => i !== idx);
    setItems(next);
    if (todayEntry && !next.some(i => i.trim())) onClear();
  }
  function addItem() { setItems([...items, '']); }

  return (
    <div className="jm-write-card">
      <WriteHeader isToday={isToday} dateLabel={dateLabel} savedEntry={isSaved ? todayEntry : null} />

      <ol className="jm-wc-items">
        {items.map((val, idx) => (
          <li key={idx} className="jm-wc-item">
            <span className="jm-wc-num">{idx + 1}</span>
            <AutoTextarea
              value={val}
              onChange={v => updateItem(idx, v)}
              placeholder={placeholder}
              className="jm-wc-ta"
            />
            <button className="jm-wc-del" onClick={() => removeItem(idx)} title={jt.deleteItem} aria-label={jt.deleteItem}>
              <IconX size={12} />
            </button>
          </li>
        ))}
      </ol>

      <button className="jm-wc-add" onClick={addItem}>
        <IconPlus size={13} /> {jt.addItem}
      </button>

      <WriteFooter
        charCount={charCount}
        saving={saving}
        isSaved={isSaved}
        hasEntry={!!todayEntry}
        canSave={hasContent || (!!todayEntry && isDirty)}
        onSave={onSave}
      />
    </div>
  );
}

// ─── LessonWriteCard ─────────────────────────────────────────────────────────

function LessonWriteCard({
  items, setItems, dateLabel, onSave, onClear, saving, todayEntry, isDirty, isToday,
}: {
  items: string[];
  setItems: (items: string[]) => void;
  dateLabel: string;
  onSave: () => void;
  onClear: () => void;
  saving: boolean;
  todayEntry: JournalEntry | null;
  isDirty: boolean;
  isToday: boolean;
}) {
  const { journal: jt } = useT();
  const groups = chunkLessons(items);
  const charCount = items.reduce((s, i) => s + i.length, 0);
  const hasContent = items.some(i => i.trim());
  const isSaved = !!todayEntry && !isDirty;

  function updateField(groupIdx: number, fieldIdx: number, val: string) {
    const next = [...items];
    next[groupIdx * LESSON_GROUP_SIZE + fieldIdx] = val;
    setItems(next);
  }
  function addGroup() { setItems([...items, ...Array(LESSON_GROUP_SIZE).fill('')]); }
  function removeGroup(groupIdx: number) {
    const next = [...items];
    next.splice(groupIdx * LESSON_GROUP_SIZE, LESSON_GROUP_SIZE);
    const result = next.length ? next : Array(LESSON_GROUP_SIZE).fill('');
    setItems(result);
    if (todayEntry && !result.some(i => i.trim())) onClear();
  }

  return (
    <div className="jm-write-card">
      <WriteHeader isToday={isToday} dateLabel={dateLabel} savedEntry={isSaved ? todayEntry : null} />

      <div className="jm-wc-items">
        {groups.map((group, groupIdx) => (
          <div key={groupIdx} className="jm-lesson-group">
            {groups.length > 1 && (
              <div className="jm-lesson-group-header">
                <span className="jm-lesson-group-label">{jt.lessonGroup(groupIdx + 1)}</span>
                <button
                  className="jm-lesson-group-del"
                  onClick={() => removeGroup(groupIdx)}
                  title={jt.deleteLesson}
                  aria-label={jt.deleteLesson}
                >
                  <IconX size={12} />
                </button>
              </div>
            )}
            {jt.lessonFields.map((field, fieldIdx) => (
              <div key={fieldIdx} className="jm-lesson-field">
                <div className="jm-lesson-field-header">
                  <span className="jm-lesson-field-num">{fieldIdx + 1}.</span>
                  <span className="jm-lesson-field-label">{field.label}</span>
                  <span className="jm-lesson-field-prompt">{field.prompt}</span>
                </div>
                <AutoTextarea
                  value={group[fieldIdx] ?? ''}
                  onChange={v => updateField(groupIdx, fieldIdx, v)}
                  placeholder={field.placeholder}
                  className="jm-lesson-field-ta"
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <button className="jm-wc-add" onClick={addGroup}>
        <IconPlus size={13} /> {jt.addLesson}
      </button>

      <WriteFooter
        charCount={charCount}
        saving={saving}
        isSaved={isSaved}
        hasEntry={!!todayEntry}
        canSave={hasContent || (!!todayEntry && isDirty)}
        onSave={onSave}
      />
    </div>
  );
}

// ─── Entry cards (lịch sử) ───────────────────────────────────────────────────

interface EntryCardProps {
  entry: JournalEntry;
  isEditing: boolean;
  editItems: string[];
  setEditItems: (items: string[]) => void;
  onEdit: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDelete: () => void;
}

function EntryHeader({
  entry, isEditing, onEdit, onEditSave, onEditCancel, onDelete,
}: Omit<EntryCardProps, 'editItems' | 'setEditItems'>) {
  const { journal: jt } = useT();
  return (
    <div className="jm-ec-header">
      <span className="jm-ec-date">{fmtDate(entry.date, jt.dowFull, jt.formatDate)}</span>
      <div className="jm-ec-actions">
        {isEditing ? (
          <>
            <button className="jm-ec-btn confirm" onClick={onEditSave} title={jt.tooltipSave} aria-label={jt.tooltipSave}>
              <IconCheck size={15} />
            </button>
            <button className="jm-ec-btn" onClick={onEditCancel} title={jt.tooltipCancel} aria-label={jt.tooltipCancel}>
              <IconX size={15} />
            </button>
          </>
        ) : (
          <>
            <button className="jm-ec-btn" onClick={onEdit} title={jt.tooltipEdit} aria-label={jt.tooltipEdit}>
              <IconPencil size={15} stroke={1.6} />
            </button>
            <button className="jm-ec-btn danger" onClick={onDelete} title={jt.tooltipDelete} aria-label={jt.tooltipDelete}>
              <IconTrash size={15} stroke={1.6} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LessonEntryCard({ entry, isEditing, editItems, setEditItems, ...actions }: EntryCardProps) {
  const { journal: jt } = useT();
  const groups = chunkLessons(isEditing ? editItems : entry.items);

  return (
    <article className={`jm-entry-card${isEditing ? ' editing' : ''}`} id={`entry-${entry.date}`}>
      <EntryHeader entry={entry} isEditing={isEditing} {...actions} />

      <div className="jm-ec-items">
        {groups.map((group, groupIdx) => (
          <div key={groupIdx} className="jm-ec-lesson-group">
            {groups.length > 1 && (
              <div className="jm-lesson-group-header">
                <span className="jm-lesson-group-label">{jt.lessonGroup(groupIdx + 1)}</span>
              </div>
            )}
            {jt.lessonFields.map((field, fieldIdx) => (
              <div key={fieldIdx} className="jm-ec-lesson-field">
                <div className="jm-ec-lesson-label">
                  <span className="jm-lesson-field-num">{fieldIdx + 1}.</span>
                  {field.label}
                </div>
                {isEditing ? (
                  <AutoTextarea
                    value={group[fieldIdx] ?? ''}
                    onChange={v => {
                      const next = [...editItems];
                      next[groupIdx * LESSON_GROUP_SIZE + fieldIdx] = v;
                      setEditItems(next);
                    }}
                    className="jm-lesson-field-ta"
                  />
                ) : group[fieldIdx] ? (
                  <p className="jm-ec-lesson-value">{group[fieldIdx]}</p>
                ) : (
                  <p className="jm-ec-lesson-value empty">—</p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </article>
  );
}

function EntryCard({ entry, isEditing, editItems, setEditItems, ...actions }: EntryCardProps) {
  return (
    <article className={`jm-entry-card${isEditing ? ' editing' : ''}`} id={`entry-${entry.date}`}>
      <EntryHeader entry={entry} isEditing={isEditing} {...actions} />

      <div className="jm-ec-items">
        {isEditing ? (
          editItems.map((val, idx) => (
            <div key={idx} className="jm-wc-item">
              <span className="jm-wc-num">{idx + 1}</span>
              <AutoTextarea
                value={val}
                onChange={v => {
                  const next = [...editItems]; next[idx] = v; setEditItems(next);
                }}
                className="jm-wc-ta"
              />
            </div>
          ))
        ) : (
          entry.items.map((text, idx) => (
            <div key={idx} className="jm-ec-item">
              <span className="jm-ec-num">{idx + 1}</span>
              <p className="jm-ec-text">{text}</p>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

// ─── JournalView (main) ──────────────────────────────────────────────────────

export default function JournalView() {
  const t = useT();
  const jt = t.journal;
  const now = new Date();
  const todayStr = getToday();

  const [activeType, setActiveType] = useState<JTab>('gratitude');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [contentKey, setContentKey] = useState(0);
  const [items, setItems] = useState<string[]>(['', '', '']);
  const [showPrompt, setShowPrompt] = useState(true);
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState<JournalEntry[]>([]);

  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState<JournalStats>({ gratitudeDays: 0, lessonDays: 0 });

  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(new Set());

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editItems, setEditItems] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{
    entry: JournalEntry;
    wasSelected: boolean;
    prevItems: string[];
  } | null>(null);
  const [pendingClear, setPendingClear] = useState<{
    entry: JournalEntry;
    prevItems: string[];
  } | null>(null);

  const seededRef = useRef(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKnownTodayRef = useRef(todayStr);
  const activeTypeRef = useRef(activeType);
  const loadAllRef = useRef<((type: JTab, date: string) => Promise<void>) | null>(null);
  useSmoothScroll(mainRef);
  useSmoothScroll(sidebarRef);

  const isDirty = selectedEntry
    ? activeType === 'lesson'
      ? JSON.stringify(items) !== JSON.stringify(ensureLessonItems(selectedEntry.items))
      : JSON.stringify(items.filter(i => i.trim())) !== JSON.stringify(selectedEntry.items)
    : false;

  const loadAll = useCallback(async (type: JTab, date: string) => {
    const [entry, hist, s, st, dates] = await Promise.all([
      dbGetJournal(date, type),
      dbGetJournalHistory(type, date),
      dbGetJournalStreak(),
      dbGetJournalStats(calYear, calMonth),
      dbGetDatesWithEntries(calYear, calMonth),
    ]);

    setSelectedEntry(entry);
    if (entry && entry.items.some(i => i.trim())) {
      setItems(type === 'lesson' ? ensureLessonItems(entry.items) : [...entry.items]);
      setShowPrompt(false);
    } else {
      setItems(emptyItems(type));
      setShowPrompt(true);
    }

    setHistory(hist);
    setStreak(s);
    setStats(st);
    setDatesWithEntries(new Set(dates));
  }, [calYear, calMonth]);

  useEffect(() => { activeTypeRef.current = activeType; }, [activeType]);
  useEffect(() => { loadAllRef.current = loadAll; }, [loadAll]);

  // Reset to today when window regains visibility after being hidden overnight (e.g., tray app)
  useEffect(() => {
    function onVisible() {
      if (document.hidden) return;
      const today = getToday();
      if (today === lastKnownTodayRef.current) return;
      lastKnownTodayRef.current = today;
      setSelectedDate(today);
      setEditingId(null);
      const la = loadAllRef.current;
      if (la) la(activeTypeRef.current, today).then(() => setContentKey(k => k + 1));
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  useEffect(() => {
    async function init() {
      if (!seededRef.current) {
        await seedJournalIfEmpty();
        seededRef.current = true;
      }
      await loadAll(activeType, selectedDate);
      setContentKey(k => k + 1);
      setEditingId(null);
    }
    init();
  }, [activeType, calYear, calMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshSidebar() {
    const [s, st, dates] = await Promise.all([
      dbGetJournalStreak(),
      dbGetJournalStats(calYear, calMonth),
      dbGetDatesWithEntries(calYear, calMonth),
    ]);
    setStreak(s);
    setStats(st);
    setDatesWithEntries(new Set(dates));
  }

  async function selectDate(ds: string) {
    if (ds === selectedDate) return;
    const [entry, hist] = await Promise.all([
      dbGetJournal(ds, activeType),
      dbGetJournalHistory(activeType, ds),
    ]);
    setSelectedDate(ds);
    setSelectedEntry(entry);
    if (entry && entry.items.some(i => i.trim())) {
      setItems(activeType === 'lesson' ? ensureLessonItems(entry.items) : [...entry.items]);
      setShowPrompt(false);
    } else {
      setItems(emptyItems(activeType));
      setShowPrompt(true);
    }
    setHistory(hist);
    setEditingId(null);
    setContentKey(k => k + 1);
  }

  async function handleClear() {
    if (!selectedEntry) return;
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (pendingClear) setPendingClear(null);
    const prevItems = [...items];
    const clearedEntry = selectedEntry;
    await dbDeleteJournal(clearedEntry.id);
    setSelectedEntry(null);
    setShowPrompt(true);
    await refreshSidebar();
    setPendingClear({ entry: clearedEntry, prevItems });
    clearTimerRef.current = setTimeout(() => {
      setPendingClear(null);
    }, 4000);
  }

  async function undoClear() {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    if (!pendingClear) return;
    const { entry, prevItems } = pendingClear;
    const restored = await dbSaveJournal(entry.date, entry.type as JournalType, prevItems);
    setSelectedEntry(restored);
    setItems(prevItems);
    setShowPrompt(false);
    setPendingClear(null);
    await refreshSidebar();
  }

  async function handleSave() {
    let toSave: string[];
    if (activeType === 'lesson') {
      const nonEmptyGroups = chunkLessons(items).filter(g => g.some(f => f.trim()));
      toSave = nonEmptyGroups.flat();
    } else {
      toSave = items.filter(i => i.trim());
    }
    if (!toSave.length) {
      if (selectedEntry) {
        await dbDeleteJournal(selectedEntry.id);
        setSelectedEntry(null);
        setShowPrompt(true);
        await refreshSidebar();
      }
      return;
    }
    setSaving(true);
    const entry = await dbSaveJournal(selectedDate, activeType, toSave);
    setSelectedEntry(entry);
    if (entry) {
      setItems(activeType === 'lesson' ? ensureLessonItems(entry.items) : [...entry.items]);
    }
    setSaving(false);
    setShowPrompt(false);
    await refreshSidebar();
  }

  async function handleDelete(id: number) {
    if (pendingDelete) {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      await dbDeleteJournal(pendingDelete.entry.id);
    }

    let entryToDelete: JournalEntry | null = null;
    let wasSelected = false;
    let prevItems: string[] = [];

    if (selectedEntry?.id === id) {
      entryToDelete = selectedEntry;
      wasSelected = true;
      prevItems = [...items];
      setSelectedEntry(null);
      setItems(emptyItems(activeType));
      setShowPrompt(true);
    } else {
      entryToDelete = history.find(e => e.id === id) ?? null;
      if (!entryToDelete) return;
      setHistory(prev => prev.filter(e => e.id !== id));
    }

    setPendingDelete({ entry: entryToDelete, wasSelected, prevItems });

    deleteTimerRef.current = setTimeout(async () => {
      await dbDeleteJournal(id);
      await refreshSidebar();
      setPendingDelete(null);
    }, 4000);
  }

  function undoDeleteEntry() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (!pendingDelete) return;
    const { entry, wasSelected, prevItems } = pendingDelete;
    if (wasSelected) {
      setSelectedEntry(entry);
      setItems(prevItems);
      setShowPrompt(false);
    } else {
      setHistory(prev => [...prev, entry].sort((a, b) => b.date.localeCompare(a.date)));
    }
    setPendingDelete(null);
  }

  async function handleEditSave(id: number, date: string) {
    let toSave: string[];
    if (activeType === 'lesson') {
      const nonEmptyGroups = chunkLessons(editItems).filter(g => g.some(f => f.trim()));
      toSave = nonEmptyGroups.flat();
    } else {
      toSave = editItems.filter(i => i.trim());
    }
    if (!toSave.length) return;
    await dbSaveJournal(date, activeType, toSave);
    setHistory(prev => prev.map(e => e.id === id ? { ...e, items: toSave } : e));
    setEditingId(null);
    await refreshSidebar();
  }

  function switchType(type: JTab) {
    setActiveType(type);
    mainRef.current?.scrollTo({ top: 0 });
  }

  // Mini calendar geometry
  const calFirstDow = new Date(calYear, calMonth - 1, 1).getDay();
  const calDaysInMonth = new Date(calYear, calMonth, 0).getDate();

  function calPrev() {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  }
  function calNext() {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  }

  const activePromptLines = activeType === 'gratitude' ? jt.gratitudePrompt : jt.lessonPrompt;
  const activePlaceholder = activeType === 'gratitude' ? jt.gratitudePlaceholder : jt.lessonPlaceholder;
  const dateLabel = fmtDateShort(selectedDate, jt.formatDateShort);
  const isTodaySelected = selectedDate === todayStr;
  const noteCount = selectedEntry
    ? activeType === 'lesson'
      ? Math.ceil(selectedEntry.items.length / LESSON_GROUP_SIZE)
      : selectedEntry.items.length
    : null;

  return (
    <div className="journal-view" data-type={activeType}>

      {/* ── Sidebar: lịch tháng, chuỗi ngày, thống kê ── */}
      <aside className="journal-sidebar" ref={sidebarRef}>

        <section className="jsc-section">
          <div className="jsc-cal-header">
            <span className="jsc-cal-title">{jt.monthTitle(calMonth, calYear)}</span>
            <div className="jsc-cal-nav">
              <button className="jsc-nav-btn" onClick={calPrev} title={jt.prevMonth} aria-label={jt.prevMonth}>
                <IconChevronLeft size={14} />
              </button>
              <button className="jsc-nav-btn" onClick={calNext} title={jt.nextMonth} aria-label={jt.nextMonth}>
                <IconChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="jsc-cal-grid">
            {jt.dowShort.map(d => <div key={d} className="jsc-cal-dow">{d}</div>)}
            {Array(calFirstDow).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
            {Array(calDaysInMonth).fill(null).map((_, i) => {
              const day = i + 1;
              const ds = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const cls = [
                'jsc-cal-day',
                ds === todayStr && 'today',
                ds === selectedDate && 'selected',
                datesWithEntries.has(ds) && 'has-entry',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={day}
                  className={cls}
                  disabled={ds > todayStr}
                  title={fmtDate(ds, jt.dowFull, jt.formatDate)}
                  onClick={() => selectDate(ds)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </section>

        <section className="jsc-streak">
          <span className="jsc-streak-num">{streak}</span>
          <span className="jsc-streak-label">
            <IconFlame size={14} /> {jt.streakLabel}
          </span>
        </section>

        <section className="jsc-stats">
          <div className="jsc-label">{jt.thisMonth}</div>
          <div className="jsc-stat-row gratitude">
            <IconHeart size={14} />
            <span>{jt.gratitudeTab}</span>
            <span className="jsc-stat-val">{stats.gratitudeDays} <em>{jt.days}</em></span>
          </div>
          <div className="jsc-stat-row lesson">
            <IconBulb size={14} />
            <span>{jt.lessonTab}</span>
            <span className="jsc-stat-val">{stats.lessonDays} <em>{jt.days}</em></span>
          </div>
        </section>

      </aside>

      {/* ── Main ── */}
      <div className="journal-main" ref={mainRef}>
        <div className="jm-page">

          <header className="jm-head">
            <div className="jm-head-main">
              <span className="jm-eyebrow">{t.nav.journal}</span>
              <h1 className="jm-date">{fmtDate(selectedDate, jt.dowFull, jt.formatDate)}</h1>
              <p className="jm-date-sub">
                {isTodaySelected ? jt.todayLabel : dateLabel} · {noteCount !== null ? jt.itemCount(noteCount) : jt.noNotes}
              </p>
            </div>
            <div className="jm-type-toggle">
              <button
                className={`jm-tt-btn gratitude${activeType === 'gratitude' ? ' active' : ''}`}
                onClick={() => switchType('gratitude')}
              >
                <IconHeart size={14} /> {jt.gratitudeTab}
              </button>
              <button
                className={`jm-tt-btn lesson${activeType === 'lesson' ? ' active' : ''}`}
                onClick={() => switchType('lesson')}
              >
                <IconBulb size={14} /> {jt.lessonTab}
              </button>
            </div>
          </header>

          <div key={contentKey} className="journal-date-content">

            {showPrompt && (
              <div className="jm-prompt">
                {activeType === 'gratitude'
                  ? <IconHeart size={16} className="jm-prompt-icon" />
                  : <IconBulb size={16} className="jm-prompt-icon" />}
                <div className="jm-prompt-text">
                  {activePromptLines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
                <button className="jm-prompt-close" onClick={() => setShowPrompt(false)} aria-label={jt.tooltipCancel}>
                  <IconX size={13} />
                </button>
              </div>
            )}

            {activeType === 'lesson' ? (
              <LessonWriteCard
                items={items}
                setItems={setItems}
                dateLabel={dateLabel}
                onSave={handleSave}
                onClear={handleClear}
                saving={saving}
                todayEntry={selectedEntry}
                isDirty={isDirty}
                isToday={isTodaySelected}
              />
            ) : (
              <WriteCard
                items={items}
                setItems={setItems}
                dateLabel={dateLabel}
                onSave={handleSave}
                onClear={handleClear}
                saving={saving}
                todayEntry={selectedEntry}
                isDirty={isDirty}
                isToday={isTodaySelected}
                placeholder={activePlaceholder}
              />
            )}

            {history.length > 0 && (
              <section className="jm-history">
                <div className="jm-divider">
                  <span className="jm-divider-line" aria-hidden />
                  <span className="jm-divider-label">{jt.dividerEarlier}</span>
                  <span className="jm-divider-line" aria-hidden />
                </div>

                {history.map(entry => {
                  const CardComponent = entry.type === 'lesson' ? LessonEntryCard : EntryCard;
                  return (
                    <CardComponent
                      key={entry.id}
                      entry={entry}
                      isEditing={editingId === entry.id}
                      editItems={editItems}
                      setEditItems={setEditItems}
                      onEdit={() => {
                        setEditingId(entry.id);
                        setEditItems(entry.type === 'lesson' ? ensureLessonItems(entry.items) : [...entry.items]);
                      }}
                      onEditSave={() => handleEditSave(entry.id, entry.date)}
                      onEditCancel={() => setEditingId(null)}
                      onDelete={() => handleDelete(entry.id)}
                    />
                  );
                })}
              </section>
            )}

          </div>
        </div>
      </div>

      {pendingDelete && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">
            {jt.deletedEntry(fmtDate(pendingDelete.entry.date, jt.dowFull, jt.formatDate))}
          </span>
          <button className="delete-toast-undo" onClick={undoDeleteEntry}>
            {jt.undo}
          </button>
        </div>
      )}
      {pendingClear && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{jt.clearedEntry}</span>
          <button className="delete-toast-undo" onClick={undoClear}>
            {jt.undo}
          </button>
        </div>
      )}
    </div>
  );
}
