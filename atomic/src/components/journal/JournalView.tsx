import { useState, useEffect, useRef, useCallback } from 'react';
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

// â"€â"€â"€ Constants â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const ACCENT_GRATITUDE = 'var(--primary)';
const ACCENT_LESSON = 'var(--journal-secondary)';
type JTab = 'gratitude' | 'lesson';

interface TabCfg {
  accent: string;
  promptColor: string;
  bgPrompt: string;
  borderPrompt: string;
  borderWrite: string;
  activeBg: string;
  saveBg: string;
  saveColor: string;
  defaultCount: number;
}

const TABS: Record<JTab, TabCfg> = {
  gratitude: {
    accent: ACCENT_GRATITUDE,
    promptColor: 'var(--journal-prompt-text-g)',
    bgPrompt: 'var(--journal-gratitude-tint-bg)',
    borderPrompt: 'var(--journal-gratitude-tint-border)',
    borderWrite: 'var(--journal-gratitude-write-border)',
    activeBg: 'var(--journal-gratitude-active-bg)',
    saveBg: 'var(--primary)',
    saveColor: '#fff',
    defaultCount: 3,
  },
  lesson: {
    accent: ACCENT_LESSON,
    promptColor: 'var(--journal-prompt-text-l)',
    bgPrompt: 'var(--journal-lesson-tint-bg)',
    borderPrompt: 'var(--journal-lesson-tint-border)',
    borderWrite: 'var(--journal-lesson-write-border)',
    activeBg: 'var(--journal-lesson-active-bg)',
    saveBg: 'var(--journal-secondary)',
    saveColor: '#1a1a1a',
    defaultCount: 3,
  },
};

// â"€â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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
  // SQLite datetime('now') tráº£ vá» UTC: "2026-06-05 08:30:00"
  const d = new Date(updatedAt.replace(' ', 'T') + 'Z');
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function ensureLessonItems(items: string[]): string[] {
  if (items.length === 0) return ['', '', ''];
  const extra = items.length % 3;
  return extra === 0 ? items : [...items, ...Array(3 - extra).fill('')];
}

function chunkLessons(items: string[]): string[][] {
  if (items.length === 0) return [['', '', '']];
  const groups: string[][] = [];
  for (let i = 0; i < items.length; i += 3) {
    groups.push([items[i] ?? '', items[i + 1] ?? '', items[i + 2] ?? '']);
  }
  return groups;
}

// â"€â"€â"€ AutoTextarea â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

// â"€â"€â"€ WriteCard â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function WriteCard({
  items, setItems, cfg, dateLabel, onSave, onClear, saving, todayEntry, isDirty, isToday, placeholder,
}: {
  items: string[];
  setItems: (items: string[]) => void;
  cfg: TabCfg;
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
      <div className="jm-wc-header">
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 5 }}>
          <IconPencil size={13} color="var(--text-secondary)" /> {isToday ? jt.writeToday : jt.writeDate(dateLabel)}
        </span>
        {isSaved ? (
          <span style={{ color: cfg.accent, fontSize: '0.79rem', display: 'flex', alignItems: 'center', gap: 3 }}>
            <IconCheck size={12} color={cfg.accent} /> {jt.savedAt(formatSavedTime(todayEntry!.updated_at))}
          </span>
        ) : (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{dateLabel}</span>
        )}
      </div>

      <div className="jm-wc-items">
        {items.map((val, idx) => (
          <div key={idx} className="jm-wc-item">
            <span className="jm-wc-num" style={{ color: cfg.accent }}>{idx + 1}</span>
            <AutoTextarea
              value={val}
              onChange={v => updateItem(idx, v)}
              placeholder={placeholder}
              className="jm-wc-ta"
            />
            <button className="jm-wc-del" onClick={() => removeItem(idx)} title={jt.deleteItem}>
              <IconX size={11} />
            </button>
          </div>
        ))}
      </div>

      <button className="jm-wc-add" onClick={addItem}>
        <IconPlus size={12} /> {jt.addItem}
      </button>

      <div className="jm-wc-footer">
        <span className="jm-wc-char">{jt.charCount(charCount)}</span>
        <button
          className="jm-wc-save"
          style={{ background: cfg.saveBg, color: cfg.saveColor }}
          disabled={saving || isSaved || (!hasContent && !(!!todayEntry && isDirty))}
          onClick={onSave}
        >
          {saving
            ? jt.saving
            : isSaved
              ? <><IconCheck size={13} /> {jt.saved}</>
              : todayEntry
                ? jt.update
                : jt.saveToday}
        </button>
      </div>
    </div>
  );
}

// â"€â"€â"€ LessonWriteCard â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function LessonWriteCard({
  items, setItems, cfg, dateLabel, onSave, onClear, saving, todayEntry, isDirty, isToday,
}: {
  items: string[];
  setItems: (items: string[]) => void;
  cfg: TabCfg;
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
    next[groupIdx * 3 + fieldIdx] = val;
    setItems(next);
  }
  function addGroup() { setItems([...items, '', '', '']); }
  function removeGroup(groupIdx: number) {
    const next = [...items];
    next.splice(groupIdx * 3, 3);
    const result = next.length ? next : ['', '', ''];
    setItems(result);
    if (todayEntry && !result.some(i => i.trim())) onClear();
  }

  return (
    <div className="jm-write-card">
      <div className="jm-wc-header">
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 5 }}>
          <IconPencil size={13} color="var(--text-secondary)" /> {isToday ? jt.writeToday : jt.writeDate(dateLabel)}
        </span>
        {isSaved ? (
          <span style={{ color: cfg.accent, fontSize: '0.79rem', display: 'flex', alignItems: 'center', gap: 3 }}>
            <IconCheck size={12} color={cfg.accent} /> {jt.savedAt(formatSavedTime(todayEntry!.updated_at))}
          </span>
        ) : (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{dateLabel}</span>
        )}
      </div>

      <div className="jm-wc-items">
        {groups.map((group, groupIdx) => (
          <div key={groupIdx} className="jm-lesson-group">
            {groups.length > 1 && (
              <div className="jm-lesson-group-header">
                <span className="jm-lesson-group-label" style={{ color: cfg.accent }}>
                  {jt.lessonGroup(groupIdx + 1)}
                </span>
                <button className="jm-lesson-group-del" onClick={() => removeGroup(groupIdx)} title={jt.deleteLesson}>
                  <IconX size={11} />
                </button>
              </div>
            )}
            {jt.lessonFields.map((field, fieldIdx) => (
              <div key={fieldIdx} className="jm-lesson-field">
                <div className="jm-lesson-field-header">
                  <span className="jm-lesson-field-num" style={{ color: cfg.accent }}>{fieldIdx + 1}.</span>
                  <span className="jm-lesson-field-label">{field.label}</span>
                  <IconChevronRight size={10} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
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
        <IconPlus size={12} /> {jt.addLesson}
      </button>

      <div className="jm-wc-footer">
        <span className="jm-wc-char">{jt.charCount(charCount)}</span>
        <button
          className="jm-wc-save"
          style={{ background: cfg.saveBg, color: cfg.saveColor }}
          disabled={saving || isSaved || (!hasContent && !(!!todayEntry && isDirty))}
          onClick={onSave}
        >
          {saving
            ? jt.saving
            : isSaved
              ? <><IconCheck size={13} /> {jt.saved}</>
              : todayEntry
                ? jt.update
                : jt.saveToday}
        </button>
      </div>
    </div>
  );
}

// â"€â"€â"€ LessonEntryCard â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function LessonEntryCard({
  entry, cfg, isEditing, editItems, setEditItems,
  onEdit, onEditSave, onEditCancel, onDelete,
}: {
  entry: JournalEntry;
  cfg: TabCfg;
  isEditing: boolean;
  editItems: string[];
  setEditItems: (items: string[]) => void;
  onEdit: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDelete: () => void;
}) {
  const { journal: jt } = useT();

  return (
    <div className="jm-entry-card" id={`entry-${entry.date}`}>
      <div className="jm-ec-header">
        <span className="jm-ec-date">{fmtDate(entry.date, jt.dowFull, jt.formatDate)}</span>
        <div className="jm-ec-actions">
          {isEditing ? (
            <>
              <button className="jm-ec-btn" onClick={onEditSave} title={jt.tooltipSave}>
                <IconCheck size={13} color={cfg.accent} />
              </button>
              <button className="jm-ec-btn" onClick={onEditCancel} title={jt.tooltipCancel}>
                <IconX size={13} color="var(--text-secondary)" />
              </button>
            </>
          ) : (
            <>
              <button className="jm-ec-btn" onClick={onEdit} title={jt.tooltipEdit}>
                <IconPencil size={13} color="var(--text-secondary)" />
              </button>
              <button className="jm-ec-btn" onClick={onDelete} title={jt.tooltipDelete}>
                <IconTrash size={13} color="var(--text-secondary)" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="jm-ec-items">
        {isEditing ? (
          chunkLessons(editItems).map((group, groupIdx) => (
            <div key={groupIdx} className="jm-ec-lesson-group">
              {chunkLessons(editItems).length > 1 && (
                <div className="jm-ec-lesson-group-header">
                  <span className="jm-ec-lesson-group-label" style={{ color: cfg.accent }}>
                    {jt.lessonGroup(groupIdx + 1)}
                  </span>
                </div>
              )}
              {jt.lessonFields.map((field, fieldIdx) => (
                <div key={fieldIdx} className="jm-ec-lesson-field">
                  <div className="jm-ec-lesson-label" style={{ color: cfg.accent }}>
                    {fieldIdx + 1}. {field.label}
                  </div>
                  <AutoTextarea
                    value={group[fieldIdx] ?? ''}
                    onChange={v => {
                      const next = [...editItems];
                      next[groupIdx * 3 + fieldIdx] = v;
                      setEditItems(next);
                    }}
                    className="jm-wc-ta"
                  />
                </div>
              ))}
            </div>
          ))
        ) : (
          chunkLessons(entry.items).map((group, groupIdx) => (
            <div key={groupIdx} className="jm-ec-lesson-group">
              {chunkLessons(entry.items).length > 1 && (
                <div className="jm-ec-lesson-group-header">
                  <span className="jm-ec-lesson-group-label" style={{ color: cfg.accent }}>
                    {jt.lessonGroup(groupIdx + 1)}
                  </span>
                </div>
              )}
              {jt.lessonFields.map((field, fieldIdx) => (
                <div key={fieldIdx} className="jm-ec-lesson-field">
                  <div className="jm-ec-lesson-label" style={{ color: cfg.accent }}>
                    {fieldIdx + 1}. {field.label}
                  </div>
                  {group[fieldIdx] ? (
                    <div className="jm-ec-lesson-value">{group[fieldIdx]}</div>
                  ) : (
                    <div className="jm-ec-lesson-value" style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.82rem' }}>—</div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// â"€â"€â"€ EntryCard â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function EntryCard({
  entry, cfg, isEditing, editItems, setEditItems,
  onEdit, onEditSave, onEditCancel, onDelete,
}: {
  entry: JournalEntry;
  cfg: TabCfg;
  isEditing: boolean;
  editItems: string[];
  setEditItems: (items: string[]) => void;
  onEdit: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onDelete: () => void;
}) {
  const { journal: jt } = useT();

  return (
    <div className="jm-entry-card" id={`entry-${entry.date}`}>
      <div className="jm-ec-header">
        <span className="jm-ec-date">{fmtDate(entry.date, jt.dowFull, jt.formatDate)}</span>
        <div className="jm-ec-actions">
          {isEditing ? (
            <>
              <button className="jm-ec-btn" onClick={onEditSave} title={jt.tooltipSave}>
                <IconCheck size={13} color={cfg.accent} />
              </button>
              <button className="jm-ec-btn" onClick={onEditCancel} title={jt.tooltipCancel}>
                <IconX size={13} color="var(--text-secondary)" />
              </button>
            </>
          ) : (
            <>
              <button className="jm-ec-btn" onClick={onEdit} title={jt.tooltipEdit}>
                <IconPencil size={13} color="var(--text-secondary)" />
              </button>
              <button className="jm-ec-btn" onClick={onDelete} title={jt.tooltipDelete}>
                <IconTrash size={13} color="var(--text-secondary)" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="jm-ec-items">
        {isEditing ? (
          editItems.map((val, idx) => (
            <div key={idx} className="jm-wc-item">
              <span className="jm-wc-num" style={{ color: cfg.accent }}>{idx + 1}</span>
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
              <span className="jm-ec-num" style={{ color: cfg.accent }}>{idx + 1}</span>
              <span className="jm-ec-text">{text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// â"€â"€â"€ JournalView (main) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export default function JournalView() {
  const { journal: jt } = useT();
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

  const cfg = TABS[activeType];

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
      setItems(type === 'lesson' ? ['', '', ''] : Array(TABS[type].defaultCount).fill(''));
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
      setItems(activeType === 'lesson' ? ['', '', ''] : Array(TABS[activeType].defaultCount).fill(''));
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
      setItems(activeType === 'lesson' ? ['', '', ''] : Array(TABS[activeType].defaultCount).fill(''));
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

  return (
    <div className="journal-view">

      {/* â"€â"€â"€ Sidebar â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <aside className="journal-sidebar" ref={sidebarRef}>

        {/* Mini Calendar */}
        <div className="jsc-section">
          <div className="jsc-cal-header">
            <button className="jsc-nav-btn" onClick={calPrev}>
              <IconChevronLeft size={13} />
            </button>
            <span className="jsc-cal-title">{jt.monthsShort[calMonth - 1]} {calYear}</span>
            <button className="jsc-nav-btn" onClick={calNext}>
              <IconChevronRight size={13} />
            </button>
          </div>
          <div className="jsc-cal-grid">
            {jt.dowShort.map(d => <div key={d} className="jsc-cal-dow">{d}</div>)}
            {Array(calFirstDow).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
            {Array(calDaysInMonth).fill(null).map((_, i) => {
              const day = i + 1;
              const ds = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDate;
              const hasEntry = datesWithEntries.has(ds);
              const isFuture = ds > todayStr;
              return (
                <div
                  key={day}
                  className="jsc-cal-day"
                  style={{
                    background: isToday ? ACCENT_GRATITUDE : 'transparent',
                    color: isToday ? '#fff' : hasEntry ? ACCENT_GRATITUDE : 'var(--text-secondary)',
                    cursor: isFuture ? 'default' : 'pointer',
                    fontWeight: isToday || isSelected ? 700 : 400,
                    outline: isSelected && !isToday ? `1.5px solid ${ACCENT_GRATITUDE}` : 'none',
                    outlineOffset: '-1px',
                    opacity: isFuture ? 0.35 : 1,
                  }}
                  title={fmtDate(ds, jt.dowFull, jt.formatDate)}
                  onClick={() => {
                    if (!isFuture) selectDate(ds);
                  }}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        {/* Streak */}
        <div className="jsc-streak">
          <span className="jsc-streak-num" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconFlame size={20} color="var(--primary)" /> {streak}
          </span>
          <span className="jsc-streak-label">{jt.streakLabel}</span>
        </div>

        {/* Stats */}
        <div className="jsc-stats">
          <div className="jsc-stats-label">{jt.thisMonth}</div>
          <div className="jsc-stat-row">
            <IconHeart size={13} color={ACCENT_GRATITUDE} style={{ flexShrink: 0 }} />
            <span style={{ color: ACCENT_GRATITUDE, fontSize: '0.82rem' }}>{jt.gratitudeTab}</span>
            <span className="jsc-stat-val" style={{ color: ACCENT_GRATITUDE }}>
              {stats.gratitudeDays} {jt.days}
            </span>
          </div>
          <div className="jsc-stat-row">
            <IconBulb size={13} color={ACCENT_LESSON} style={{ flexShrink: 0 }} />
            <span style={{ color: ACCENT_LESSON, fontSize: '0.82rem' }}>{jt.lessonTab}</span>
            <span className="jsc-stat-val" style={{ color: ACCENT_LESSON }}>
              {stats.lessonDays} {jt.days}
            </span>
          </div>
        </div>

      </aside>

      {/* â"€â"€â"€ Main â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="journal-right">

        {/* Journal Head â€" ngoÃ i vÃ¹ng scroll */}
        <div className="jm-head">
          <div className="jm-head-left">
            <div className="jm-date">{fmtDate(selectedDate, jt.dowFull, jt.formatDate)}</div>
            <div className="jm-date-sub">
              {selectedDate === todayStr ? jt.todayLabel : dateLabel} · {selectedEntry
                ? jt.itemCount(activeType === 'lesson'
                    ? Math.ceil(selectedEntry.items.length / 3)
                    : selectedEntry.items.length)
                : jt.noNotes}
            </div>
          </div>
          <div className="jm-type-toggle">
            <button
              className={`jm-tt-btn${activeType === 'gratitude' ? ' jm-tt-btn--active' : ''}`}
              style={activeType === 'gratitude'
                ? { background: TABS.gratitude.activeBg, color: TABS.gratitude.accent, fontWeight: 500 }
                : {}}
              onClick={() => { setActiveType('gratitude'); mainRef.current?.scrollTo({ top: 0 }); }}
            >
              <IconHeart size={13} /> {jt.gratitudeTab}
            </button>
            <button
              className={`jm-tt-btn${activeType === 'lesson' ? ' jm-tt-btn--active' : ''}`}
              style={activeType === 'lesson'
                ? { background: TABS.lesson.activeBg, color: TABS.lesson.accent, fontWeight: 500 }
                : {}}
              onClick={() => { setActiveType('lesson'); mainRef.current?.scrollTo({ top: 0 }); }}
            >
              <IconBulb size={13} /> {jt.lessonTab}
            </button>
          </div>
        </div>

        <div className="journal-main" ref={mainRef}>

        <div key={contentKey} className="journal-date-content">

        {/* Prompt Banner */}
        {showPrompt && (
          <div className="jm-prompt" style={{ background: cfg.bgPrompt, borderColor: cfg.borderPrompt }}>
            <div className="jm-prompt-inner">
              {activeType === 'gratitude'
                ? <IconHeart size={18} color={cfg.promptColor} style={{ flexShrink: 0, marginTop: 1 }} />
                : <IconBulb size={18} color={cfg.promptColor} style={{ flexShrink: 0, marginTop: 1 }} />}
              <div className="jm-prompt-text" style={{ color: cfg.promptColor, fontWeight: 500 }}>
                {activePromptLines.map((line, i) => <div key={i}>{line}</div>)}
              </div>
            </div>
            <button className="jm-prompt-close" onClick={() => setShowPrompt(false)}>
              <IconX size={12} color="var(--text-secondary)" />
            </button>
          </div>
        )}

        {/* Write Card */}
        {activeType === 'lesson' ? (
          <LessonWriteCard
            items={items}
            setItems={setItems}
            cfg={cfg}
            dateLabel={dateLabel}
            onSave={handleSave}
            onClear={handleClear}
            saving={saving}
            todayEntry={selectedEntry}
            isDirty={isDirty}
            isToday={selectedDate === todayStr}
          />
        ) : (
          <WriteCard
            items={items}
            setItems={setItems}
            cfg={cfg}
            dateLabel={dateLabel}
            onSave={handleSave}
            onClear={handleClear}
            saving={saving}
            todayEntry={selectedEntry}
            isDirty={isDirty}
            isToday={selectedDate === todayStr}
            placeholder={activePlaceholder}
          />
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <div className="jm-divider">
              <div className="jm-divider-line" />
              <span className="jm-divider-label">{jt.dividerEarlier}</span>
              <div className="jm-divider-line" />
            </div>

            {history.map(entry => (
              entry.type === 'lesson' ? (
                <LessonEntryCard
                  key={entry.id}
                  entry={entry}
                  cfg={TABS[entry.type as JTab]}
                  isEditing={editingId === entry.id}
                  editItems={editItems}
                  setEditItems={setEditItems}
                  onEdit={() => { setEditingId(entry.id); setEditItems(ensureLessonItems(entry.items)); }}
                  onEditSave={() => handleEditSave(entry.id, entry.date)}
                  onEditCancel={() => setEditingId(null)}
                  onDelete={() => handleDelete(entry.id)}
                />
              ) : (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  cfg={TABS[entry.type as JTab]}
                  isEditing={editingId === entry.id}
                  editItems={editItems}
                  setEditItems={setEditItems}
                  onEdit={() => { setEditingId(entry.id); setEditItems([...entry.items]); }}
                  onEditSave={() => handleEditSave(entry.id, entry.date)}
                  onEditCancel={() => setEditingId(null)}
                  onDelete={() => handleDelete(entry.id)}
                />
              )
            ))}

          </>
        )}

        </div>{/* end journal-date-content */}

        </div>{/* end journal-main */}
      </div>{/* end journal-right */}

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
