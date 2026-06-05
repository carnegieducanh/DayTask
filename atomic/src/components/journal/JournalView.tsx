import { useState, useEffect, useRef, useCallback } from 'react';
import {
  IconHeart, IconBulb, IconPencil,
  IconTrash, IconX, IconPlus, IconCheck,
  IconChevronLeft, IconChevronRight,
} from '@tabler/icons-react';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import type { JournalEntry, JournalStats } from '../../types';
import {
  dbGetJournal, dbSaveJournal, dbDeleteJournal,
  dbGetJournalHistory, dbGetJournalStreak,
  dbGetJournalStats, dbGetDatesWithEntries,
  seedJournalIfEmpty,
} from '../../store/journalDb';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOW_FULL = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const DOW_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS_SHORT = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
const ACCENT_GRATITUDE = 'var(--primary)';
const ACCENT_LESSON = 'var(--journal-secondary)';
type JTab = 'gratitude' | 'lesson';

interface TabCfg {
  accent: string;
  bgPrompt: string;
  borderPrompt: string;
  borderWrite: string;
  activeBg: string;
  saveBg: string;
  saveColor: string;
  promptLines: string[];
  defaultCount: number;
  placeholder: string;
}

const TABS: Record<JTab, TabCfg> = {
  gratitude: {
    accent: ACCENT_GRATITUDE,
    bgPrompt: 'var(--journal-gratitude-tint-bg)',
    borderPrompt: 'var(--journal-gratitude-tint-border)',
    borderWrite: 'var(--journal-gratitude-write-border)',
    activeBg: 'var(--journal-gratitude-active-bg)',
    saveBg: 'var(--primary)',
    saveColor: '#fff',
    promptLines: [
      'Hôm nay điều gì khiến bạn cảm thấy biết ơn?',
      'Có thể là một người, một khoảnh khắc nhỏ,',
      'hay điều gì đó bạn thường bỏ qua.',
    ],
    defaultCount: 3,
    placeholder: 'Tôi biết ơn vì...',
  },
  lesson: {
    accent: ACCENT_LESSON,
    bgPrompt: 'var(--journal-lesson-tint-bg)',
    borderPrompt: 'var(--journal-lesson-tint-border)',
    borderWrite: 'var(--journal-lesson-write-border)',
    activeBg: 'var(--journal-lesson-active-bg)',
    saveBg: 'var(--journal-secondary)',
    saveColor: '#1a1a1a',
    promptLines: [
      'Hôm nay bạn học được điều gì?',
      'Có thể từ sách, từ một sai lầm,',
      'từ cuộc trò chuyện hay từ chính bản thân mình.',
    ],
    defaultCount: 1,
    placeholder: 'Bài học tôi ngộ ra hôm nay là...',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function formatDateVI(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DOW_FULL[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
}

function formatDateShortVI(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
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

// ─── AutoTextarea ─────────────────────────────────────────────────────────────

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

// ─── WriteCard ────────────────────────────────────────────────────────────────

function WriteCard({
  items, setItems, cfg, dateLabel, onSave, saving, todayEntry, isDirty, isToday,
}: {
  items: string[];
  setItems: (items: string[]) => void;
  cfg: TabCfg;
  dateLabel: string;
  onSave: () => void;
  saving: boolean;
  todayEntry: JournalEntry | null;
  isDirty: boolean;
  isToday: boolean;
}) {
  const charCount = items.reduce((s, i) => s + i.length, 0);
  const hasContent = items.some(i => i.trim());
  const isSaved = !!todayEntry && !isDirty;

  function updateItem(idx: number, val: string) {
    const next = [...items]; next[idx] = val; setItems(next);
  }
  function removeItem(idx: number) {
    if (items.length <= 1) { setItems(['']); return; }
    setItems(items.filter((_, i) => i !== idx));
  }
  function addItem() { setItems([...items, '']); }

  return (
    <div className="jm-write-card">
      <div className="jm-wc-header">
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5 }}>
          <IconPencil size={13} color="var(--text-secondary)" /> {isToday ? 'Ghi hôm nay' : `Ghi ngày ${dateLabel}`}
        </span>
        {isSaved ? (
          <span style={{ color: cfg.accent, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}>
            <IconCheck size={12} color={cfg.accent} /> Đã lưu {formatSavedTime(todayEntry!.updated_at)}
          </span>
        ) : (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{dateLabel}</span>
        )}
      </div>

      <div className="jm-wc-items">
        {items.map((val, idx) => (
          <div key={idx} className="jm-wc-item">
            <span className="jm-wc-num" style={{ color: cfg.accent }}>{idx + 1}</span>
            <AutoTextarea
              value={val}
              onChange={v => updateItem(idx, v)}
              placeholder={cfg.placeholder}
              className="jm-wc-ta"
            />
            <button className="jm-wc-del" onClick={() => removeItem(idx)} title="Xóa ô này">
              <IconX size={11} />
            </button>
          </div>
        ))}
      </div>

      <button className="jm-wc-add" onClick={addItem}>
        <IconPlus size={12} /> Thêm ý
      </button>

      <div className="jm-wc-footer">
        <span className="jm-wc-char">{charCount} ký tự</span>
        <button
          className="jm-wc-save"
          style={{ background: cfg.saveBg, color: cfg.saveColor }}
          disabled={saving || isSaved || !hasContent}
          onClick={onSave}
        >
          {saving
            ? 'Đang lưu...'
            : isSaved
              ? <><IconCheck size={13} /> Đã lưu</>
              : todayEntry
                ? 'Cập nhật'
                : 'Lưu hôm nay'}
        </button>
      </div>
    </div>
  );
}

// ─── EntryCard ────────────────────────────────────────────────────────────────

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
  return (
    <div className="jm-entry-card" id={`entry-${entry.date}`}>
      <div className="jm-ec-header">
        <span className="jm-ec-date">{formatDateVI(entry.date)}</span>
        <div className="jm-ec-actions">
          {isEditing ? (
            <>
              <button className="jm-ec-btn" onClick={onEditSave} title="Lưu">
                <IconCheck size={13} color={cfg.accent} />
              </button>
              <button className="jm-ec-btn" onClick={onEditCancel} title="Hủy">
                <IconX size={13} color="var(--text-secondary)" />
              </button>
            </>
          ) : (
            <>
              <button className="jm-ec-btn" onClick={onEdit} title="Sửa">
                <IconPencil size={13} color="var(--text-secondary)" />
              </button>
              <button className="jm-ec-btn" onClick={onDelete} title="Xóa">
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

// ─── JournalView (main) ───────────────────────────────────────────────────────

export default function JournalView() {
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

  const seededRef = useRef(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  useSmoothScroll(mainRef);
  useSmoothScroll(sidebarRef);

  const cfg = TABS[activeType];

  const isDirty = selectedEntry
    ? JSON.stringify(items.filter(i => i.trim())) !== JSON.stringify(selectedEntry.items)
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
    if (entry && entry.items.length > 0) {
      setItems([...entry.items]);
      setShowPrompt(false);
    } else {
      setItems(Array(TABS[type].defaultCount).fill(''));
      setShowPrompt(true);
    }

    setHistory(hist);
    setStreak(s);
    setStats(st);
    setDatesWithEntries(new Set(dates));
  }, [calYear, calMonth]);

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
    if (entry && entry.items.length > 0) {
      setItems([...entry.items]);
      setShowPrompt(false);
    } else {
      setItems(Array(TABS[activeType].defaultCount).fill(''));
      setShowPrompt(true);
    }
    setHistory(hist);
    setEditingId(null);
    setContentKey(k => k + 1);
  }

  async function handleSave() {
    const nonEmpty = items.filter(i => i.trim());
    if (!nonEmpty.length) return;
    setSaving(true);
    const entry = await dbSaveJournal(selectedDate, activeType, nonEmpty);
    setSelectedEntry(entry);
    if (entry) setItems([...entry.items]);
    setSaving(false);
    await refreshSidebar();
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Xóa entry này?')) return;
    await dbDeleteJournal(id);
    if (selectedEntry?.id === id) {
      setSelectedEntry(null);
      setItems(Array(TABS[activeType].defaultCount).fill(''));
      setShowPrompt(true);
    } else {
      setHistory(prev => prev.filter(e => e.id !== id));
    }
    await refreshSidebar();
  }

  async function handleEditSave(id: number, date: string) {
    const nonEmpty = editItems.filter(i => i.trim());
    if (!nonEmpty.length) return;
    await dbSaveJournal(date, activeType, nonEmpty);
    setHistory(prev => prev.map(e => e.id === id ? { ...e, items: nonEmpty } : e));
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

  return (
    <div className="journal-view">

      {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="journal-sidebar" ref={sidebarRef}>

        {/* Mini Calendar */}
        <div className="jsc-section">
          <div className="jsc-cal-header">
            <button className="jsc-nav-btn" onClick={calPrev}>
              <IconChevronLeft size={13} />
            </button>
            <span className="jsc-cal-title">{MONTHS_SHORT[calMonth - 1]} {calYear}</span>
            <button className="jsc-nav-btn" onClick={calNext}>
              <IconChevronRight size={13} />
            </button>
          </div>
          <div className="jsc-cal-grid">
            {DOW_SHORT.map(d => <div key={d} className="jsc-cal-dow">{d}</div>)}
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
                  title={formatDateVI(ds)}
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
          <span className="jsc-streak-num">🔥 {streak}</span>
          <span className="jsc-streak-label">ngày liên tiếp</span>
        </div>

        {/* Stats */}
        <div className="jsc-stats">
          <div className="jsc-stats-label">Tháng này</div>
          <div className="jsc-stat-row">
            <IconHeart size={13} color={ACCENT_GRATITUDE} style={{ flexShrink: 0 }} />
            <span style={{ color: ACCENT_GRATITUDE, fontSize: '0.78rem' }}>Biết ơn</span>
            <span className="jsc-stat-val" style={{ color: ACCENT_GRATITUDE }}>
              {stats.gratitudeDays} ngày
            </span>
          </div>
          <div className="jsc-stat-row">
            <IconBulb size={13} color={ACCENT_LESSON} style={{ flexShrink: 0 }} />
            <span style={{ color: ACCENT_LESSON, fontSize: '0.78rem' }}>Bài học</span>
            <span className="jsc-stat-val" style={{ color: ACCENT_LESSON }}>
              {stats.lessonDays} ngày
            </span>
          </div>
        </div>

      </aside>

      {/* ─── Main ────────────────────────────────────────────────────────── */}
      <div className="journal-right">

        {/* Journal Head — ngoài vùng scroll */}
        <div className="jm-head">
          <div className="jm-head-left">
            <div className="jm-date">{formatDateVI(selectedDate)}</div>
            <div className="jm-date-sub">
              {selectedDate === todayStr ? 'Hôm nay' : formatDateShortVI(selectedDate)} · {selectedEntry ? `${selectedEntry.items.length} mục` : 'chưa có ghi chú'}
            </div>
          </div>
          <div className="jm-type-toggle">
            <button
              className="jm-tt-btn"
              style={activeType === 'gratitude'
                ? { background: TABS.gratitude.activeBg, color: TABS.gratitude.accent, fontWeight: 500 }
                : {}}
              onClick={() => setActiveType('gratitude')}
            >
              <IconHeart size={13} /> Biết ơn
            </button>
            <button
              className="jm-tt-btn"
              style={activeType === 'lesson'
                ? { background: TABS.lesson.activeBg, color: TABS.lesson.accent, fontWeight: 500 }
                : {}}
              onClick={() => setActiveType('lesson')}
            >
              <IconBulb size={13} /> Bài học
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
                ? <IconHeart size={18} color={cfg.accent} style={{ flexShrink: 0, marginTop: 1 }} />
                : <IconBulb size={18} color={cfg.accent} style={{ flexShrink: 0, marginTop: 1 }} />}
              <div className="jm-prompt-text" style={{ color: cfg.accent }}>
                {cfg.promptLines.map((line, i) => <div key={i}>{line}</div>)}
              </div>
            </div>
            <button className="jm-prompt-close" onClick={() => setShowPrompt(false)}>
              <IconX size={12} color="var(--text-secondary)" />
            </button>
          </div>
        )}

        {/* Write Card */}
        <WriteCard
          items={items}
          setItems={(next) => {
            setItems(next);
            if (next.some(i => i.length > 0)) setShowPrompt(false);
          }}
          cfg={cfg}
          dateLabel={formatDateShortVI(selectedDate)}
          onSave={handleSave}
          saving={saving}
          todayEntry={selectedEntry}
          isDirty={isDirty}
          isToday={selectedDate === todayStr}
        />

        {/* History */}
        {history.length > 0 && (
          <>
            <div className="jm-divider">
              <div className="jm-divider-line" />
              <span className="jm-divider-label">Trước đó</span>
              <div className="jm-divider-line" />
            </div>

            {history.map(entry => (
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
            ))}

          </>
        )}

        </div>{/* end journal-date-content */}

        </div>{/* end journal-main */}
      </div>{/* end journal-right */}
    </div>
  );
}
