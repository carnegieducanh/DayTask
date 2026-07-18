import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useSmoothScroll, attachSmoothScroll } from '../../hooks/useSmoothScroll';
import ResizableTextarea from '../ResizableTextarea';
import {
  IconX,
  IconCameraPlus,
  IconTag,
  IconChevronDown,
  IconCheck,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import type { Book, BookStatus, NewBook } from '../../types';
import { dbGetAllBookTagNames, dbCreateBookTag, dbRenameBookTag } from '../../store/booksDb';
import { useT } from '../../i18n';
import { compressCoverImage, useCoverGlow } from './bookUtils';

interface AddBookModalProps {
  onSave: (data: NewBook) => Promise<void>;
  onClose: () => void;
  initialBook?: Book;
  onTagDeleted: (name: string, undo: () => void) => void;
}

export default function AddBookModal({ onSave, onClose, initialBook, onTagDeleted }: AddBookModalProps) {
  const t = useT();
  const isEdit = !!initialBook;
  const [title, setTitle] = useState(initialBook?.title ?? '');
  const [author, setAuthor] = useState(initialBook?.author ?? '');
  const [coverImage, setCoverImage] = useState<string | null>(initialBook?.cover_image ?? null);
  const [status, setStatus] = useState<BookStatus>(initialBook?.status ?? 'want_to_read');
  const [finishedDate, setFinishedDate] = useState(
    initialBook?.finished_date ?? format(new Date(), 'yyyy-MM-dd')
  );
  const [startDate, setStartDate] = useState(
    initialBook?.started_date ?? format(new Date(), 'yyyy-MM-dd')
  );
  const [notes, setNotes] = useState(initialBook?.notes ?? '');
  const [tags, setTags] = useState<string[]>(initialBook?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [coverDragOver, setCoverDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

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
  const tagListRef = useRef<HTMLDivElement>(null);

  const coverGlowStyle = useCoverGlow(coverImage);

  useSmoothScroll(bodyRef);
  useSmoothScroll(notesRef);

  useEffect(() => {
    if (!tagDropOpen || !tagListRef.current) return;
    return attachSmoothScroll(tagListRef.current);
  }, [tagDropOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!allTags.includes(name)) {
      setAllTags((prev) => [...prev, name].sort());
      dbCreateBookTag(name);
    }
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

  async function applyCoverFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    try {
      const dataUrl = await compressCoverImage(file);
      setCoverImage(dataUrl);
    } catch {
      // ignore unreadable image, keep previous cover
    }
  }

  async function handlePickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await applyCoverFile(file);
  }

  function handleCoverDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current += 1;
    setCoverDragOver(true);
  }

  function handleCoverDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleCoverDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setCoverDragOver(false);
    }
  }

  async function handleCoverDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setCoverDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await applyCoverFile(file);
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      author: author.trim() || undefined,
      cover_image: coverImage,
      status,
      started_date: startDate || null,
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

        <div className="books-modal-body" ref={bodyRef}>
          <div
            className={`books-modal-cover-row${coverDragOver ? ' drag-over' : ''}`}
            onDragEnter={handleCoverDragEnter}
            onDragOver={handleCoverDragOver}
            onDragLeave={handleCoverDragLeave}
            onDrop={handleCoverDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePickCover}
            />
            <div className={`books-card-cover books-cover-picker${coverDragOver ? ' drag-over' : ''}`} style={coverGlowStyle}>
              <button
                type="button"
                className="books-card-cover-inner books-cover-picker-inner"
                onClick={() => fileInputRef.current?.click()}
              >
                {coverImage ? (
                  <img src={coverImage} alt="" />
                ) : (
                  <div className="books-cover-picker-empty">
                    <IconCameraPlus size={22} />
                    <span>{coverDragOver ? t.books.coverDrop : t.books.coverUpload}</span>
                  </div>
                )}
              </button>
            </div>
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
          </div>

          <div className="books-modal-row">
            <div className="books-modal-col">
              <label className="books-modal-label">{t.books.startDateLabel}</label>
              <input
                type="date"
                className="books-modal-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
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
                <div className="tag-dropdown-list" ref={tagListRef}>
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
          <ResizableTextarea
            ref={notesRef}
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
