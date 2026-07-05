import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import {
  IconBooks,
  IconBook2,
  IconBookmark,
  IconStack2,
  IconPlus,
  IconTrash,
  IconPencil,
  IconX,
  IconCheck,
  IconSearch,
  IconTag,
  IconChevronDown,
  IconCameraPlus,
  IconTarget,
  IconTrophy,
} from '@tabler/icons-react';
import type { Book, BookStatus, NewBook } from '../../types';
import {
  dbGetBooks,
  dbAddBook,
  dbUpdateBook,
  dbDeleteBook,
  dbGetYearsWithCounts,
  dbGetBookStats,
  dbGetAllBookTagNames,
  dbGetTagCounts,
  dbRenameBookTag,
  dbDeleteBookTag,
  dbGetReadingGoal,
  dbSetReadingGoal,
  seedBooksIfEmpty,
} from '../../store/booksDb';
import { useT } from '../../i18n';

type LibraryFilter = 'all' | 'reading' | 'want_to_read';
type SortBy = 'date' | 'title' | 'author';

const MAX_COVER_DIM = 500;
const COVER_JPEG_QUALITY = 0.82;

function compressCoverImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image load failed'));
      img.onload = () => {
        const scale = Math.min(1, MAX_COVER_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('no canvas context')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', COVER_JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function sortBooks(list: Book[], sortBy: SortBy): Book[] {
  const arr = [...list];
  if (sortBy === 'title') arr.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortBy === 'author') arr.sort((a, b) => (a.author ?? '').localeCompare(b.author ?? ''));
  else arr.sort((a, b) => (b.finished_date ?? b.created_at).localeCompare(a.finished_date ?? a.created_at));
  return arr;
}

// ── BookCard ─────────────────────────────────────────────────────────────────

function BookCard({
  book, onView, onEdit, onDelete,
}: {
  book: Book; onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="books-card" onClick={onView}>
      <div className="books-card-cover">
        {book.cover_image ? (
          <img src={book.cover_image} alt={book.title} />
        ) : (
          <div className="books-card-cover-placeholder">
            <IconBooks size={28} />
          </div>
        )}
        <div className="books-card-actions">
          <button className="books-card-action-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <IconPencil size={13} />
          </button>
          <button className="books-card-action-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <IconTrash size={13} />
          </button>
        </div>
      </div>
      <div className="books-card-title" title={book.title}>{book.title}</div>
      {book.author && <div className="books-card-author" title={book.author}>{book.author}</div>}
      {book.tags.length > 0 && (
        <div className="books-card-tags">
          {book.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="books-tag-chip-sm">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── BookDetailModal ──────────────────────────────────────────────────────────

function formatISODate(iso: string): string {
  const [y, m, d] = iso.split(/[- ]/);
  return `${d}/${m}/${y}`;
}

const STATUS_ICON: Record<BookStatus, React.ReactNode> = {
  reading: <IconBook2 size={13} />,
  finished: <IconCheck size={13} />,
  want_to_read: <IconBookmark size={13} />,
};

interface BookDetailModalProps {
  book: Book;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: BookStatus) => void;
}

function BookDetailModal({ book, onClose, onEdit, onDelete, onStatusChange }: BookDetailModalProps) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!statusMenuOpen) return;
    function handler(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setStatusMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusMenuOpen]);

  const statusLabel = {
    reading: t.books.statusReading,
    finished: t.books.statusFinished,
    want_to_read: t.books.statusWantToRead,
  }[book.status];

  const statusOptions: { id: BookStatus; label: string }[] = [
    { id: 'reading', label: t.books.statusReading },
    { id: 'finished', label: t.books.statusFinished },
    { id: 'want_to_read', label: t.books.statusWantToRead },
  ];

  function handleStatusPick(next: BookStatus) {
    setStatusMenuOpen(false);
    if (next !== book.status) onStatusChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      if (statusMenuOpen) setStatusMenuOpen(false);
      else onClose();
    }
  }

  return (
    <div
      className="books-modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="books-detail-modal">
        <button ref={closeRef} className="books-detail-close" onClick={onClose}>
          <IconX size={16} />
        </button>

        <div className="books-detail-body">
          <div className="books-detail-cover">
            {book.cover_image ? (
              <img src={book.cover_image} alt={book.title} />
            ) : (
              <div className="books-card-cover-placeholder">
                <IconBooks size={40} />
              </div>
            )}
          </div>

          <div className="books-detail-info">
            <div className="books-detail-title">{book.title}</div>
            {book.author && <div className="books-detail-author">{book.author}</div>}

            <div className="books-detail-badges">
              <div className="books-detail-status-dropdown" ref={statusMenuRef}>
                <button
                  type="button"
                  className={`books-detail-status-badge status-${book.status}${statusMenuOpen ? ' open' : ''}`}
                  onClick={() => setStatusMenuOpen((v) => !v)}
                >
                  {STATUS_ICON[book.status]}
                  {statusLabel}
                  <IconChevronDown size={12} className={`books-detail-status-chevron${statusMenuOpen ? ' open' : ''}`} />
                </button>
                {statusMenuOpen && (
                  <div className="books-detail-status-menu">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`books-detail-status-option${opt.id === book.status ? ' active' : ''}`}
                        onClick={() => handleStatusPick(opt.id)}
                      >
                        {STATUS_ICON[opt.id]}
                        {opt.label}
                        {opt.id === book.status && <IconCheck size={12} className="books-detail-status-check" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {book.status === 'finished' && book.finished_date && (
                <span className="books-detail-date">{formatISODate(book.finished_date)}</span>
              )}
            </div>

            {book.tags.length > 0 && (
              <div className="books-detail-tags">
                {book.tags.map((tag) => (
                  <span key={tag} className="books-tag-chip-sm">{tag}</span>
                ))}
              </div>
            )}

            {book.notes && <div className="books-detail-notes">{book.notes}</div>}

            <div className="books-detail-meta">
              {t.books.addedOn(formatISODate(book.created_at.split(' ')[0]))}
            </div>
          </div>
        </div>

        <div className="books-modal-footer books-detail-footer">
          <div className="books-modal-footer-group">
            <button className="books-modal-btn-cancel books-detail-delete" onClick={onDelete}>
              {t.books.delete}
              <IconTrash size={13} />
            </button>
            <button className="books-modal-btn-cancel" onClick={onEdit}>
              {t.books.edit}
              <IconPencil size={13} />
            </button>
          </div>
          <button className="books-modal-btn-save" onClick={onClose}>
            {t.books.done}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AddBookModal ─────────────────────────────────────────────────────────────

interface AddBookModalProps {
  onSave: (data: NewBook) => Promise<void>;
  onClose: () => void;
  initialBook?: Book;
  onTagDeleted: (name: string, undo: () => void) => void;
}

function AddBookModal({ onSave, onClose, initialBook, onTagDeleted }: AddBookModalProps) {
  const t = useT();
  const isEdit = !!initialBook;
  const [title, setTitle] = useState(initialBook?.title ?? '');
  const [author, setAuthor] = useState(initialBook?.author ?? '');
  const [coverImage, setCoverImage] = useState<string | null>(initialBook?.cover_image ?? null);
  const [status, setStatus] = useState<BookStatus>(initialBook?.status ?? 'want_to_read');
  const [finishedDate, setFinishedDate] = useState(
    initialBook?.finished_date ?? format(new Date(), 'yyyy-MM-dd')
  );
  const [notes, setNotes] = useState(initialBook?.notes ?? '');
  const [tags, setTags] = useState<string[]>(initialBook?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagDropOpen, setTagDropOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagPanelStyle, setTagPanelStyle] = useState<React.CSSProperties>({});
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const tagDropRef = useRef<HTMLDivElement>(null);
  const tagTriggerRef = useRef<HTMLButtonElement>(null);
  const tagSearchRef = useRef<HTMLInputElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    dbGetAllBookTagNames().then(setAllTags);
  }, []);

  useEffect(() => {
    if (!tagDropOpen) return;
    function handler(e: MouseEvent) {
      if (tagDropRef.current && !tagDropRef.current.contains(e.target as Node)) {
        setTagDropOpen(false);
        setShowNewTagInput(false);
        setNewTagInput('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tagDropOpen]);

  function handleTagDropClick() {
    if (!tagDropOpen && tagTriggerRef.current) {
      const rect = tagTriggerRef.current.getBoundingClientRect();
      setTagPanelStyle({ top: rect.height + 4, left: 0, minWidth: rect.width });
      setTagSearch('');
      setTimeout(() => tagSearchRef.current?.focus(), 0);
    }
    setTagDropOpen((v) => !v);
  }

  function toggleTag(name: string) {
    setTags((prev) => (prev.includes(name) ? prev.filter((tg) => tg !== name) : [...prev, name]));
  }

  function handleCreateTag() {
    const name = newTagInput.trim();
    if (!name) return;
    if (!allTags.includes(name)) setAllTags((prev) => [...prev, name].sort());
    if (!tags.includes(name)) setTags((prev) => [...prev, name]);
    setNewTagInput('');
    setShowNewTagInput(false);
  }

  function handleNewTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleCreateTag(); }
    if (e.key === 'Escape') { setShowNewTagInput(false); setNewTagInput(''); }
  }

  async function handleRenameTag(oldName: string) {
    const newName = renameInput.trim();
    setRenamingTag(null);
    if (!newName || newName === oldName) return;
    await dbRenameBookTag(oldName, newName);
    setAllTags((prev) => prev.map((tg) => (tg === oldName ? newName : tg)).sort());
    setTags((prev) => prev.map((tg) => (tg === oldName ? newName : tg)));
  }

  function handleDeleteTag(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    const wasSelected = tags.includes(name);
    setAllTags((prev) => prev.filter((tg) => tg !== name));
    if (wasSelected) setTags((prev) => prev.filter((tg) => tg !== name));
    onTagDeleted(name, () => {
      setAllTags((prev) => [...prev, name].sort());
      if (wasSelected) setTags((prev) => [...prev, name]);
    });
  }

  function handleStatusChange(next: BookStatus) {
    setStatus(next);
    if (next === 'finished' && !finishedDate) {
      setFinishedDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }

  async function handlePickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await compressCoverImage(file);
      setCoverImage(dataUrl);
    } catch {
      // ignore unreadable image, keep previous cover
    }
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      author: author.trim() || undefined,
      cover_image: coverImage,
      status,
      finished_date: status === 'finished' ? finishedDate : null,
      notes: notes.trim() || undefined,
      tags,
    });
    setSaving(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && !tagDropOpen) onClose();
  }

  const filteredTags = allTags.filter((tg) => !tagSearch || tg.toLowerCase().includes(tagSearch.toLowerCase()));

  return (
    <div className="books-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <div className="books-modal">
        <div className="books-modal-header">
          <span className="books-modal-title">{isEdit ? t.books.modalEditTitle : t.books.modalAddTitle}</span>
          <button className="books-modal-close" onClick={onClose}><IconX size={16} /></button>
        </div>

        <div className="books-modal-body">
          <div className="books-modal-cover-row">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePickCover}
            />
            <button
              type="button"
              className="books-cover-picker"
              onClick={() => fileInputRef.current?.click()}
            >
              {coverImage ? (
                <img src={coverImage} alt="" className="books-cover-picker-img" />
              ) : (
                <div className="books-cover-picker-empty">
                  <IconCameraPlus size={22} />
                  <span>{t.books.coverUpload}</span>
                </div>
              )}
            </button>
            <div className="books-cover-actions">
              <button type="button" className="books-cover-action-btn" onClick={() => fileInputRef.current?.click()}>
                {coverImage ? t.books.coverChange : t.books.coverUpload}
              </button>
              {coverImage && (
                <button type="button" className="books-cover-action-btn danger" onClick={() => setCoverImage(null)}>
                  {t.books.coverRemove}
                </button>
              )}
            </div>
          </div>

          <div className="books-modal-row">
            <div className="books-modal-col">
              <label className="books-modal-label">{t.books.titleLabel}</label>
              <input
                ref={titleRef}
                className="books-modal-input"
                placeholder={t.books.titlePlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="books-modal-col">
              <label className="books-modal-label">{t.books.authorLabel}</label>
              <input
                className="books-modal-input"
                placeholder={t.books.authorPlaceholder}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>

          <div className="books-modal-row">
            <div className="books-modal-col">
              <label className="books-modal-label">{t.books.statusLabel}</label>
              <div className="books-status-toggle">
                {(
                  [
                    { id: 'reading', label: t.books.statusReading },
                    { id: 'finished', label: t.books.statusFinished },
                    { id: 'want_to_read', label: t.books.statusWantToRead },
                  ] as { id: BookStatus; label: string }[]
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`books-status-btn${status === s.id ? ' active' : ''}`}
                    onClick={() => handleStatusChange(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {status === 'finished' && (
              <div className="books-modal-col">
                <label className="books-modal-label">{t.books.finishedDateLabel}</label>
                <input
                  type="date"
                  className="books-modal-input"
                  value={finishedDate}
                  onChange={(e) => setFinishedDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <label className="books-modal-label">{t.books.tagsLabel}</label>
          <div className="tag-dropdown" ref={tagDropRef}>
            <button
              ref={tagTriggerRef}
              type="button"
              className={`tag-dropdown-trigger${tagDropOpen ? ' open' : ''}`}
              onClick={handleTagDropClick}
            >
              {tags.length === 0 ? (
                <>
                  <IconTag size={13} className="time-dropdown-icon muted" />
                  <span className="tag-dropdown-label placeholder">{t.books.tagsPlaceholder}</span>
                </>
              ) : (
                <span className="tag-dropdown-label">{tags.join(', ')}</span>
              )}
              <IconChevronDown size={13} className={`cat-dropdown-chevron${tagDropOpen ? ' open' : ''}`} />
            </button>

            {tagDropOpen && (
              <div className="tag-dropdown-panel" style={tagPanelStyle}>
                {allTags.length > 0 && (
                  <div className="tag-dropdown-search-wrap">
                    <input
                      ref={tagSearchRef}
                      className="tag-dropdown-search"
                      placeholder={t.calendar.filterTagSearch}
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                    />
                  </div>
                )}
                <div className="tag-dropdown-list">
                  {allTags.length === 0 && (
                    <div className="tag-dropdown-empty">{t.tags.noTags}</div>
                  )}
                  {allTags.length > 0 && tagSearch && filteredTags.length === 0 && (
                    <div className="tag-dropdown-empty">{t.tags.noTags}</div>
                  )}
                  {filteredTags.map((tagName) => {
                    const selected = tags.includes(tagName);
                    const isRenaming = renamingTag === tagName;
                    return (
                      <div
                        key={tagName}
                        className={`tag-dropdown-item${selected && !isRenaming ? ' selected' : ''}`}
                      >
                        {isRenaming ? (
                          <>
                            <input
                              className="tag-dropdown-rename-input"
                              value={renameInput}
                              onChange={(e) => setRenameInput(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={() => handleRenameTag(tagName)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleRenameTag(tagName); }
                                if (e.key === 'Escape') setRenamingTag(null);
                              }}
                              autoFocus
                            />
                            <div className="tag-dropdown-item-actions">
                              <button className="tag-dropdown-action-btn" onClick={(e) => { e.stopPropagation(); handleRenameTag(tagName); }}>
                                <IconCheck size={12} />
                              </button>
                              <button className="tag-dropdown-action-btn" onClick={(e) => { e.stopPropagation(); setRenamingTag(null); }}>
                                <IconX size={12} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="tag-dropdown-item-select" onClick={() => toggleTag(tagName)}>
                              <span className="tag-dropdown-check">
                                {selected && <IconCheck size={11} />}
                              </span>
                              <span>{tagName}</span>
                            </div>
                            <div className="tag-dropdown-item-actions">
                              <button
                                className="tag-dropdown-action-btn"
                                onClick={(e) => { e.stopPropagation(); setRenamingTag(tagName); setRenameInput(tagName); }}
                              >
                                <IconPencil size={12} />
                              </button>
                              <button
                                className="tag-dropdown-action-btn tag-dropdown-action-delete"
                                onClick={(e) => handleDeleteTag(tagName, e)}
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
                      />
                      <button type="button" className="tag-picker-confirm" onClick={handleCreateTag}>
                        <IconCheck size={13} />
                      </button>
                      <button type="button" className="tag-picker-cancel" onClick={() => { setShowNewTagInput(false); setNewTagInput(''); }}>
                        <IconX size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
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

          <label className="books-modal-label">{t.books.notesLabel}</label>
          <textarea
            className="books-modal-textarea"
            placeholder={t.books.notesPlaceholder}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            spellCheck={false}
          />
        </div>

        <div className="books-modal-footer">
          <button className="books-modal-btn-cancel" onClick={onClose}>{t.books.cancel}</button>
          <button
            className="books-modal-btn-save"
            onClick={handleSave}
            disabled={!title.trim() || saving}
          >
            {saving ? '...' : isEdit ? t.books.editSave : t.books.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BooksView ────────────────────────────────────────────────────────────────

export default function BooksView() {
  const t = useT();
  const currentYear = new Date().getFullYear();

  const [books, setBooks] = useState<Book[]>([]);
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [years, setYears] = useState<{ year: number; count: number }[]>([]);
  const [tagCounts, setTagCounts] = useState<{ tag: string; count: number }[]>([]);
  const [stats, setStats] = useState({ total: 0, reading: 0, wantToRead: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [viewingBook, setViewingBook] = useState<Book | null>(null);
  const [pendingDeleteBook, setPendingDeleteBook] = useState<Book | null>(null);
  const [pendingDeleteBookTag, setPendingDeleteBookTag] = useState<{ name: string; undo: () => void } | null>(null);
  const [readingGoal, setReadingGoal] = useState<number | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [goalCelebration, setGoalCelebration] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useSmoothScroll(mainRef);
  useSmoothScroll(sidebarRef);

  const loadStats = useCallback(async () => {
    setStats(await dbGetBookStats());
  }, []);

  const loadYears = useCallback(async () => {
    setYears(await dbGetYearsWithCounts());
  }, []);

  const loadTagCounts = useCallback(async () => {
    setTagCounts(await dbGetTagCounts());
  }, []);

  const loadGoal = useCallback(async () => {
    setReadingGoal(await dbGetReadingGoal(currentYear));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBooks = useCallback(async (
    filter: LibraryFilter,
    year: number | null,
    tag: string | null,
    search: string
  ) => {
    const opts = filter === 'all'
      ? { status: 'finished' as BookStatus, year: year ?? undefined, tag: tag ?? undefined, search }
      : { status: filter as BookStatus, tag: tag ?? undefined, search };
    setBooks(await dbGetBooks(opts));
  }, []);

  useEffect(() => {
    seedBooksIfEmpty().then(() => setSeeded(true));
  }, []);

  useEffect(() => {
    if (!seeded) return;
    loadStats();
    loadYears();
    loadTagCounts();
    loadGoal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded]);

  useEffect(() => {
    if (!seeded) return;
    loadBooks(libraryFilter, yearFilter, tagFilter, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, libraryFilter, yearFilter, tagFilter]);

  const currentYearCount = years.find((y) => y.year === currentYear)?.count ?? 0;

  useEffect(() => {
    if (!readingGoal || readingGoal <= 0 || currentYearCount < readingGoal) return;
    const key = `books_goal_celebrated_${currentYear}`;
    if (localStorage.getItem(key) === 'true') return;
    localStorage.setItem(key, 'true');
    setGoalCelebration(true);
  }, [readingGoal, currentYearCount, currentYear]);

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadBooks(libraryFilter, yearFilter, tagFilter, q);
    }, 300);
  }

  function handleLibraryFilter(f: LibraryFilter) {
    setLibraryFilter(f);
    setYearFilter(null);
    if (searchQuery) setSearchQuery('');
  }

  function handleYearFilter(year: number) {
    setLibraryFilter('all');
    setYearFilter((prev) => (prev === year ? null : year));
  }

  function handleTagFilter(tag: string) {
    setTagFilter((prev) => (prev === tag ? null : tag));
  }

  async function refreshAll() {
    await Promise.all([
      loadStats(),
      loadYears(),
      loadTagCounts(),
      loadBooks(libraryFilter, yearFilter, tagFilter, searchQuery),
    ]);
  }

  async function handleAddBook(data: NewBook) {
    const b = await dbAddBook(data);
    if (b) {
      setShowAddModal(false);
      await refreshAll();
    }
  }

  async function handleUpdateBook(data: NewBook) {
    if (!editingBook) return;
    await dbUpdateBook(editingBook.id, data);
    setEditingBook(null);
    await refreshAll();
  }

  async function handleQuickStatusChange(book: Book, status: BookStatus) {
    const finished_date = status === 'finished' ? book.finished_date ?? format(new Date(), 'yyyy-MM-dd') : null;
    await dbUpdateBook(book.id, {
      title: book.title,
      author: book.author,
      cover_image: book.cover_image,
      status,
      finished_date,
      notes: book.notes,
      tags: book.tags,
    });
    setViewingBook((prev) => (prev && prev.id === book.id ? { ...prev, status, finished_date } : prev));
    await refreshAll();
  }

  async function commitDelete(book: Book) {
    await dbDeleteBook(book.id);
    await Promise.all([loadStats(), loadYears(), loadTagCounts()]);
    setPendingDeleteBook(null);
  }

  function handleDelete(book: Book) {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (pendingDeleteBook) commitDelete(pendingDeleteBook);

    setBooks((prev) => prev.filter((b) => b.id !== book.id));
    setPendingDeleteBook(book);

    deleteTimerRef.current = setTimeout(() => {
      commitDelete(book);
    }, 4000);
  }

  function handleUndoDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (!pendingDeleteBook) return;
    loadBooks(libraryFilter, yearFilter, tagFilter, searchQuery);
    setPendingDeleteBook(null);
  }

  function handleTagDeleted(name: string, undo: () => void) {
    if (tagDeleteTimerRef.current) clearTimeout(tagDeleteTimerRef.current);
    setPendingDeleteBookTag({ name, undo });
    tagDeleteTimerRef.current = setTimeout(async () => {
      await dbDeleteBookTag(name);
      setPendingDeleteBookTag(null);
      tagDeleteTimerRef.current = null;
      await loadTagCounts();
    }, 4000);
  }

  function handleUndoTagDelete() {
    if (!pendingDeleteBookTag) return;
    if (tagDeleteTimerRef.current) { clearTimeout(tagDeleteTimerRef.current); tagDeleteTimerRef.current = null; }
    pendingDeleteBookTag.undo();
    setPendingDeleteBookTag(null);
  }

  function handleStartGoalEdit() {
    setGoalInput(readingGoal ? String(readingGoal) : '');
    setEditingGoal(true);
  }

  async function handleSaveGoal() {
    const n = parseInt(goalInput, 10);
    if (!Number.isFinite(n) || n <= 0) { setEditingGoal(false); return; }
    await dbSetReadingGoal(currentYear, n);
    setReadingGoal(n);
    setEditingGoal(false);
    if (currentYearCount < n) {
      localStorage.removeItem(`books_goal_celebrated_${currentYear}`);
    }
  }

  const grouped = useMemo(() => {
    if (libraryFilter !== 'all') return [];
    const map = new Map<string, Book[]>();
    for (const b of sortBooks(books, sortBy)) {
      const y = b.finished_date?.slice(0, 4) ?? String(currentYear);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(b);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [books, sortBy, libraryFilter, currentYear]);

  const flatList = useMemo(() => sortBooks(books, sortBy), [books, sortBy]);

  const goalPct = readingGoal ? Math.min(100, Math.round((currentYearCount / readingGoal) * 100)) : 0;

  const emptyText = searchQuery
    ? t.books.emptySearch
    : libraryFilter === 'reading'
    ? t.books.emptyReading
    : libraryFilter === 'want_to_read'
    ? t.books.emptyWantToRead
    : t.books.emptyAll;

  return (
    <div className="books-wrap">
      {/* ── Sidebar ── */}
      <div ref={sidebarRef} className="books-sidebar">
        <div className="books-sb-section">
          <div className="books-sb-label">{t.books.library}</div>
          <button
            className={`books-sb-item${libraryFilter === 'all' ? ' active' : ''}`}
            onClick={() => handleLibraryFilter('all')}
          >
            <IconStack2 size={14} />
            {t.books.filterAll}
            <span className="books-sb-count">{stats.total}</span>
          </button>
          <button
            className={`books-sb-item${libraryFilter === 'reading' ? ' active' : ''}`}
            onClick={() => handleLibraryFilter('reading')}
          >
            <IconBook2 size={14} />
            {t.books.filterReading}
            <span className="books-sb-count">{stats.reading}</span>
          </button>
          <button
            className={`books-sb-item${libraryFilter === 'want_to_read' ? ' active' : ''}`}
            onClick={() => handleLibraryFilter('want_to_read')}
          >
            <IconBookmark size={14} />
            {t.books.filterWantToRead}
            <span className="books-sb-count">{stats.wantToRead}</span>
          </button>
        </div>

        {years.length > 0 && (
          <div className="books-sb-section">
            <div className="books-sb-label">{t.books.byYear}</div>
            {years.map(({ year, count }) => (
              <button
                key={year}
                className={`books-sb-item${libraryFilter === 'all' && yearFilter === year ? ' active' : ''}`}
                onClick={() => handleYearFilter(year)}
              >
                <span className="books-year-badge">{year}</span>
                <span className="books-sb-count">{count}</span>
              </button>
            ))}
          </div>
        )}

        {tagCounts.length > 0 && (
          <div className="books-sb-section">
            <div className="books-sb-label">{t.books.genre}</div>
            {tagCounts.map(({ tag, count }) => (
              <button
                key={tag}
                className={`books-sb-item${tagFilter === tag ? ' active' : ''}`}
                onClick={() => handleTagFilter(tag)}
              >
                {tag}
                <span className="books-sb-count">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Main ── */}
      <div ref={mainRef} className="books-main">
        <div className="books-header">
          <div>
            <div className="books-header-title">{t.books.title}</div>
            <div className="books-header-sub">{t.books.totalRead(stats.total)}</div>
          </div>
          <button className="books-btn-add" onClick={() => setShowAddModal(true)}>
            <IconPlus size={13} />
            {t.books.addBook}
          </button>
        </div>

        {libraryFilter === 'all' && !yearFilter && (
          <div className="books-goal-card">
            <div className="books-goal-head">
              <IconTarget size={14} />
              <span>{t.books.goalTitle(currentYear)}</span>
              {readingGoal !== null && !editingGoal && (
                <button className="books-goal-edit" onClick={handleStartGoalEdit} title={t.books.edit}>
                  <IconPencil size={12} />
                </button>
              )}
            </div>

            {editingGoal ? (
              <div className="books-goal-editor">
                <input
                  type="number"
                  min={1}
                  className="books-goal-input"
                  placeholder={t.books.goalPlaceholder}
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
                />
                <button className="books-goal-editor-btn" onClick={handleSaveGoal}><IconCheck size={13} /></button>
                <button className="books-goal-editor-btn" onClick={() => setEditingGoal(false)}><IconX size={13} /></button>
              </div>
            ) : readingGoal ? (
              <>
                <div className="books-goal-bar-track">
                  <div className="books-goal-bar-fill" style={{ width: `${goalPct}%` }} />
                </div>
                <div className="books-goal-count">{t.books.goalProgress(currentYearCount, readingGoal)}</div>
              </>
            ) : (
              <button className="books-goal-cta" onClick={handleStartGoalEdit}>{t.books.setGoalCta}</button>
            )}
          </div>
        )}

        <div className="books-toolbar">
          <div className="books-search-wrap">
            <IconSearch size={13} className="books-search-icon" />
            <input
              className="books-search-input"
              placeholder={t.books.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              spellCheck={false}
            />
            {searchQuery && (
              <button
                className="books-search-clear"
                onClick={() => { setSearchQuery(''); loadBooks(libraryFilter, yearFilter, tagFilter, ''); }}
              >
                <IconX size={12} />
              </button>
            )}
          </div>
          <select className="books-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="date">{t.books.sortDate}</option>
            <option value="title">{t.books.sortTitle}</option>
            <option value="author">{t.books.sortAuthor}</option>
          </select>
        </div>

        {books.length === 0 ? (
          <div className="books-empty-state">
            <IconBooks size={36} className="books-empty-icon" />
            <p className="books-empty-text">{emptyText}</p>
            {!searchQuery && (
              <button className="books-btn-add" onClick={() => setShowAddModal(true)}>
                <IconPlus size={13} />
                {t.books.addBook}
              </button>
            )}
          </div>
        ) : libraryFilter === 'all' ? (
          grouped.map(([year, list]) => (
            <div key={year} className="books-year-section">
              <div className="books-year-heading">
                <span>{year}</span>
                <span className="books-year-count">{t.books.booksCount(list.length)}</span>
              </div>
              <div className="books-shelf-grid">
                {list.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onView={() => setViewingBook(book)}
                    onEdit={() => setEditingBook(book)}
                    onDelete={() => handleDelete(book)}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="books-shelf-grid">
            {flatList.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onView={() => setViewingBook(book)}
                onEdit={() => setEditingBook(book)}
                onDelete={() => handleDelete(book)}
              />
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddBookModal onSave={handleAddBook} onClose={() => setShowAddModal(false)} onTagDeleted={handleTagDeleted} />
      )}

      {editingBook && (
        <AddBookModal
          onSave={handleUpdateBook}
          onClose={() => setEditingBook(null)}
          initialBook={editingBook}
          onTagDeleted={handleTagDeleted}
        />
      )}

      {viewingBook && (
        <BookDetailModal
          book={viewingBook}
          onClose={() => setViewingBook(null)}
          onEdit={() => { setEditingBook(viewingBook); setViewingBook(null); }}
          onDelete={() => { handleDelete(viewingBook); setViewingBook(null); }}
          onStatusChange={(status) => handleQuickStatusChange(viewingBook, status)}
        />
      )}

      {pendingDeleteBook && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{t.books.deleted(pendingDeleteBook.title)}</span>
          <button className="delete-toast-undo" onClick={handleUndoDelete}>{t.books.undo}</button>
        </div>
      )}

      {pendingDeleteBookTag && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{t.toast.deleted(pendingDeleteBookTag.name)}</span>
          <button className="delete-toast-undo" onClick={handleUndoTagDelete}>{t.toast.undo}</button>
        </div>
      )}

      {goalCelebration && (
        <div className="books-celebration-toast" role="status">
          <IconTrophy size={18} />
          <span>{t.books.goalCelebration(readingGoal ?? currentYearCount)}</span>
          <button className="books-celebration-close" onClick={() => setGoalCelebration(false)}>
            <IconX size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
