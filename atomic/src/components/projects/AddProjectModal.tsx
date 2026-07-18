import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useSmoothScroll, attachSmoothScroll } from '../../hooks/useSmoothScroll';
import ResizableTextarea from '../ResizableTextarea';
import {
  IconX,
  IconCheck,
  IconTag,
  IconChevronDown,
  IconCameraPlus,
  IconTrash,
  IconPencil,
  IconArrowsMove,
} from '@tabler/icons-react';
import type { Project, ProjectStatus, ProjectCategory, NewProject } from '../../types';
import { dbGetAllFolderNames, dbCreateFolderTag, dbRenameFolderName } from '../../store/projectsDb';
import { useT } from '../../i18n';
import { compressProjectCover, clampPercent, parseCoverPosition } from './projectImageUtils';

interface AddProjectModalProps {
  category: ProjectCategory;
  onSave: (data: NewProject, coverPosition: string | null) => Promise<void>;
  onClose: () => void;
  initialProject?: Project;
  initialFolders?: string[];
  onFolderDeleted: (name: string, category: ProjectCategory, undo: () => void) => void;
}

export default function AddProjectModal({ category, onSave, onClose, initialProject, initialFolders, onFolderDeleted }: AddProjectModalProps) {
  const t = useT();
  const copy = t.projects.categoryCopy[category];
  const isEdit = !!initialProject;
  const [title, setTitle] = useState(initialProject?.title ?? '');
  const [status, setStatus] = useState<ProjectStatus>(initialProject?.status ?? 'in_progress');
  const [startDate, setStartDate] = useState(initialProject?.start_date ?? format(new Date(), 'yyyy-MM-dd'));
  const [completedDate, setCompletedDate] = useState(initialProject?.completed_date ?? format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState(initialProject?.notes ?? '');
  const [linkRepo, setLinkRepo] = useState(initialProject?.link_repo ?? '');
  const [linkYoutube, setLinkYoutube] = useState(initialProject?.link_youtube ?? '');
  const [composer, setComposer] = useState(initialProject?.composer ?? '');
  const [folders, setFolders] = useState<string[]>(initialProject?.folders ?? initialFolders ?? []);
  const [coverImage, setCoverImage] = useState<string | null>(initialProject?.cover_image ?? null);
  const [coverThumb, setCoverThumb] = useState<string | null>(initialProject?.cover_image_thumb ?? null);
  const [coverPos, setCoverPos] = useState(() => parseCoverPosition(initialProject?.cover_position ?? null));
  const [repositioningCover, setRepositioningCover] = useState(false);
  const [coverDragOver, setCoverDragOver] = useState(false);
  const coverDragCounterRef = useRef(0);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const coverPreviewRef = useRef<HTMLButtonElement>(null);
  const coverImgRef = useRef<HTMLImageElement>(null);
  const coverDragStateRef = useRef<{ startX: number; startY: number; fromX: number; fromY: number; overflowX: number; overflowY: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const [allFolders, setAllFolders] = useState<string[]>([]);
  const [folderDropOpen, setFolderDropOpen] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState('');
  const [folderPanelStyle, setFolderPanelStyle] = useState<React.CSSProperties>({});
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const folderDropRef = useRef<HTMLDivElement>(null);
  const folderTriggerRef = useRef<HTMLButtonElement>(null);
  const folderSearchRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const folderListRef = useRef<HTMLDivElement>(null);

  useSmoothScroll(bodyRef);
  useSmoothScroll(notesRef);

  useEffect(() => {
    if (!folderDropOpen || !folderListRef.current) return;
    return attachSmoothScroll(folderListRef.current);
  }, [folderDropOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    titleRef.current?.focus();
    dbGetAllFolderNames(category).then(setAllFolders);
  }, [category]);

  useEffect(() => {
    if (!folderDropOpen) return;
    function handler(e: MouseEvent) {
      if (folderDropRef.current && !folderDropRef.current.contains(e.target as Node)) {
        setFolderDropOpen(false);
        setShowNewFolderInput(false);
        setNewFolderInput('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [folderDropOpen]);

  function handleFolderDropClick() {
    if (!folderDropOpen && folderTriggerRef.current) {
      const rect = folderTriggerRef.current.getBoundingClientRect();
      setFolderPanelStyle({ top: rect.height + 4, left: 0, minWidth: rect.width });
      setFolderSearch('');
      setTimeout(() => folderSearchRef.current?.focus(), 0);
    }
    setFolderDropOpen((v) => !v);
  }

  function toggleFolder(name: string) {
    setFolders((prev) => (prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]));
  }

  function handleCreateFolder() {
    const name = newFolderInput.trim();
    if (!name) return;
    if (!allFolders.includes(name)) {
      setAllFolders((prev) => [...prev, name].sort());
      dbCreateFolderTag(name, category);
    }
    if (!folders.includes(name)) setFolders((prev) => [...prev, name]);
    setNewFolderInput('');
    setShowNewFolderInput(false);
  }

  function handleNewFolderKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleCreateFolder(); }
    if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderInput(''); }
  }

  async function handleRenameFolder(oldName: string) {
    const newName = renameInput.trim();
    setRenamingFolder(null);
    if (!newName || newName === oldName) return;
    await dbRenameFolderName(oldName, newName, category);
    setAllFolders((prev) => prev.map((f) => (f === oldName ? newName : f)).sort());
    setFolders((prev) => prev.map((f) => (f === oldName ? newName : f)));
  }

  function handleDeleteFolder(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    const wasSelected = folders.includes(name);
    setAllFolders((prev) => prev.filter((f) => f !== name));
    if (wasSelected) setFolders((prev) => prev.filter((f) => f !== name));
    onFolderDeleted(name, category, () => {
      setAllFolders((prev) => [...prev, name].sort());
      if (wasSelected) setFolders((prev) => [...prev, name]);
    });
  }

  function handleStatusChange(next: ProjectStatus) {
    setStatus(next);
    if (next === 'completed' && !completedDate) {
      setCompletedDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }

  async function applyCoverFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    try {
      const { full, thumb } = await compressProjectCover(file);
      setCoverImage(full);
      setCoverThumb(thumb);
      setCoverPos({ x: 50, y: 50 });
      setRepositioningCover(false);
    } catch {
      // ignore unreadable image
    }
  }

  function removeCover() {
    setCoverImage(null);
    setCoverThumb(null);
    setCoverPos({ x: 50, y: 50 });
    setRepositioningCover(false);
  }

  async function handlePickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await applyCoverFile(file);
  }

  function handleCoverDragEnter(e: React.DragEvent) {
    e.preventDefault();
    coverDragCounterRef.current += 1;
    setCoverDragOver(true);
  }
  function handleCoverDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleCoverDragLeave(e: React.DragEvent) {
    e.preventDefault();
    coverDragCounterRef.current -= 1;
    if (coverDragCounterRef.current <= 0) { coverDragCounterRef.current = 0; setCoverDragOver(false); }
  }
  async function handleCoverDrop(e: React.DragEvent) {
    e.preventDefault();
    coverDragCounterRef.current = 0;
    setCoverDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await applyCoverFile(file);
  }

  function handleCoverPointerDown(e: React.PointerEvent<HTMLImageElement>) {
    if (!repositioningCover || !coverPreviewRef.current || !coverImgRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = coverPreviewRef.current.getBoundingClientRect();
    const img = coverImgRef.current;
    const scale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight) || 1;
    const overflowX = Math.max(img.naturalWidth * scale - rect.width, 0);
    const overflowY = Math.max(img.naturalHeight * scale - rect.height, 0);
    coverDragStateRef.current = { startX: e.clientX, startY: e.clientY, fromX: coverPos.x, fromY: coverPos.y, overflowX, overflowY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleCoverPointerMove(e: React.PointerEvent<HTMLImageElement>) {
    const drag = coverDragStateRef.current;
    if (!drag) return;
    e.preventDefault();
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const nextX = drag.overflowX > 0 ? clampPercent(drag.fromX - (dx / drag.overflowX) * 100) : drag.fromX;
    const nextY = drag.overflowY > 0 ? clampPercent(drag.fromY - (dy / drag.overflowY) * 100) : drag.fromY;
    setCoverPos({ x: nextX, y: nextY });
  }

  function handleCoverPointerUp() {
    coverDragStateRef.current = null;
  }

  async function handleSave() {
    if (!title.trim() || folders.length === 0) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      category,
      status,
      start_date: startDate || null,
      completed_date: status === 'completed' ? completedDate : null,
      notes: notes.trim() || undefined,
      link_repo: linkRepo.trim() || undefined,
      link_youtube: linkYoutube.trim() || undefined,
      composer: category === 'piano' ? (composer.trim() || undefined) : undefined,
      cover_image: coverImage,
      cover_image_thumb: coverThumb,
      folders,
    }, coverImage ? `${coverPos.x.toFixed(1)}% ${coverPos.y.toFixed(1)}%` : null);
    setSaving(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && !folderDropOpen) onClose();
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          await applyCoverFile(file);
        }
        break;
      }
    }
  }

  const filteredFolders = allFolders.filter((f) => !folderSearch || f.toLowerCase().includes(folderSearch.toLowerCase()));

  return (
    <div className="books-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown} onPaste={handlePaste}>
      <div className="books-modal">
        <div className="books-modal-header">
          <span className="books-modal-title">{isEdit ? copy.editModalTitle : copy.addModalTitle}</span>
          <button className="books-modal-close" onClick={onClose}><IconX size={16} /></button>
        </div>

        <div className="books-modal-body" ref={bodyRef}>
          <div
            className={`projects-folder-cover-row${coverDragOver ? ' drag-over' : ''}`}
            onDragEnter={handleCoverDragEnter}
            onDragOver={handleCoverDragOver}
            onDragLeave={handleCoverDragLeave}
            onDrop={handleCoverDrop}
          >
            <input ref={coverFileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePickCover} />
            <button
              type="button"
              ref={coverPreviewRef}
              className="projects-folder-cover-picker"
              onClick={() => { if (!repositioningCover) coverFileInputRef.current?.click(); }}
            >
              {coverImage ? (
                <img
                  ref={coverImgRef}
                  src={coverImage}
                  alt=""
                  draggable={false}
                  style={{ objectPosition: `${coverPos.x}% ${coverPos.y}%`, cursor: repositioningCover ? 'grab' : undefined }}
                  onPointerDown={handleCoverPointerDown}
                  onPointerMove={handleCoverPointerMove}
                  onPointerUp={handleCoverPointerUp}
                />
              ) : (
                <div className="projects-folder-cover-picker-empty">
                  <IconCameraPlus size={22} />
                  <span>{coverDragOver ? t.projects.coverDrop : t.projects.coverUpload}</span>
                </div>
              )}
              {repositioningCover && <div className="projects-cover-reposition-hint">{t.projects.coverRepositionHint}</div>}
            </button>
            <div className="books-cover-actions">
              {repositioningCover ? (
                <button type="button" className="books-cover-action-btn" onClick={() => setRepositioningCover(false)}>
                  {t.projects.done}
                </button>
              ) : (
                <>
                  <button type="button" className="books-cover-action-btn" onClick={() => coverFileInputRef.current?.click()}>
                    {coverImage ? t.projects.coverChange : t.projects.coverUpload}
                  </button>
                  {coverImage && (
                    <>
                      <button type="button" className="books-cover-action-btn" onClick={() => setRepositioningCover(true)}>
                        <IconArrowsMove size={13} />
                        {t.projects.coverReposition}
                      </button>
                      <button type="button" className="books-cover-action-btn danger" onClick={removeCover}>
                        {t.projects.coverRemove}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <label className="books-modal-label">{copy.titleLabel}</label>
          <input
            ref={titleRef}
            className="books-modal-input"
            placeholder={copy.titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            spellCheck={false}
          />

          {category === 'piano' && (
            <>
              <label className="books-modal-label">{t.projects.categoryCopy.piano.composerLabel}</label>
              <input
                className="books-modal-input"
                placeholder={t.projects.categoryCopy.piano.composerPlaceholder}
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                spellCheck={false}
              />
            </>
          )}

          <div className="books-modal-row">
            <div className="books-modal-col">
              <label className="books-modal-label">{t.projects.statusLabel}</label>
              <div className="books-status-toggle">
                {(
                  [
                    { id: 'in_progress', label: copy.statusInProgress },
                    { id: 'completed', label: copy.statusCompleted },
                  ] as { id: ProjectStatus; label: string }[]
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
              <label className="books-modal-label">{t.projects.startDateLabel}</label>
              <input
                type="date"
                className="books-modal-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            {status === 'completed' && (
              <div className="books-modal-col">
                <label className="books-modal-label">{t.projects.completedDateLabel}</label>
                <input
                  type="date"
                  className="books-modal-input"
                  value={completedDate}
                  onChange={(e) => setCompletedDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <label className="books-modal-label">{t.projects.foldersLabel}</label>
          <div className="tag-dropdown" ref={folderDropRef}>
            <button
              ref={folderTriggerRef}
              type="button"
              className={`tag-dropdown-trigger${folderDropOpen ? ' open' : ''}`}
              onClick={handleFolderDropClick}
            >
              {folders.length === 0 ? (
                <>
                  <IconTag size={13} className="time-dropdown-icon muted" />
                  <span className="tag-dropdown-label placeholder">{t.projects.foldersPlaceholder}</span>
                </>
              ) : (
                <span className="tag-dropdown-label">{folders.join(', ')}</span>
              )}
              <IconChevronDown size={13} className={`cat-dropdown-chevron${folderDropOpen ? ' open' : ''}`} />
            </button>

            {folderDropOpen && (
              <div className="tag-dropdown-panel" style={folderPanelStyle}>
                {allFolders.length > 0 && (
                  <div className="tag-dropdown-search-wrap">
                    <input
                      ref={folderSearchRef}
                      className="tag-dropdown-search"
                      placeholder={t.calendar.filterTagSearch}
                      value={folderSearch}
                      onChange={(e) => setFolderSearch(e.target.value)}
                    />
                  </div>
                )}
                <div className="tag-dropdown-list" ref={folderListRef}>
                  {allFolders.length === 0 && <div className="tag-dropdown-empty">{t.tags.noTags}</div>}
                  {allFolders.length > 0 && folderSearch && filteredFolders.length === 0 && (
                    <div className="tag-dropdown-empty">{t.tags.noTags}</div>
                  )}
                  {filteredFolders.map((folderName) => {
                    const selected = folders.includes(folderName);
                    const isRenaming = renamingFolder === folderName;
                    return (
                      <div key={folderName} className={`tag-dropdown-item${selected && !isRenaming ? ' selected' : ''}`}>
                        {isRenaming ? (
                          <>
                            <input
                              className="tag-dropdown-rename-input"
                              value={renameInput}
                              onChange={(e) => setRenameInput(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={() => handleRenameFolder(folderName)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleRenameFolder(folderName); }
                                if (e.key === 'Escape') setRenamingFolder(null);
                              }}
                              autoFocus
                            />
                            <div className="tag-dropdown-item-actions">
                              <button className="tag-dropdown-action-btn" onClick={(e) => { e.stopPropagation(); handleRenameFolder(folderName); }}>
                                <IconCheck size={12} />
                              </button>
                              <button className="tag-dropdown-action-btn" onClick={(e) => { e.stopPropagation(); setRenamingFolder(null); }}>
                                <IconX size={12} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="tag-dropdown-item-select" onClick={() => toggleFolder(folderName)}>
                              <span className="tag-dropdown-check">{selected && <IconCheck size={11} />}</span>
                              <span>{folderName}</span>
                            </div>
                            <div className="tag-dropdown-item-actions">
                              <button
                                className="tag-dropdown-action-btn"
                                onClick={(e) => { e.stopPropagation(); setRenamingFolder(folderName); setRenameInput(folderName); }}
                              >
                                <IconPencil size={12} />
                              </button>
                              <button
                                className="tag-dropdown-action-btn tag-dropdown-action-delete"
                                onClick={(e) => handleDeleteFolder(folderName, e)}
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
                  {showNewFolderInput ? (
                    <div className="tag-picker-new-input">
                      <input
                        ref={newFolderInputRef}
                        className="tag-picker-input"
                        value={newFolderInput}
                        onChange={(e) => setNewFolderInput(e.target.value)}
                        onKeyDown={handleNewFolderKeyDown}
                        placeholder={t.tags.addPlaceholder}
                      />
                      <button type="button" className="tag-picker-confirm" onClick={handleCreateFolder}>
                        <IconCheck size={13} />
                      </button>
                      <button type="button" className="tag-picker-cancel" onClick={() => { setShowNewFolderInput(false); setNewFolderInput(''); }}>
                        <IconX size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="tag-dropdown-add-btn"
                      onClick={() => { setShowNewFolderInput(true); setTimeout(() => newFolderInputRef.current?.focus(), 0); }}
                    >
                      {t.tags.createNew}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <label className="books-modal-label">{t.projects.notesLabel}</label>
          <ResizableTextarea
            ref={notesRef}
            className="books-modal-textarea"
            placeholder={t.projects.notesPlaceholder}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            spellCheck={false}
          />

          <div className="books-modal-row">
            <div className="books-modal-col">
              <label className="books-modal-label">{copy.linkPrimaryLabel}</label>
              <input
                className="books-modal-input"
                placeholder={copy.linkPrimaryPlaceholder}
                value={linkRepo}
                onChange={(e) => setLinkRepo(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="books-modal-col">
              <label className="books-modal-label">{copy.linkSecondaryLabel}</label>
              <input
                className="books-modal-input"
                placeholder={copy.linkSecondaryPlaceholder}
                value={linkYoutube}
                onChange={(e) => setLinkYoutube(e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        <div className="books-modal-footer">
          <button className="books-modal-btn-cancel" onClick={onClose}>{t.projects.cancel}</button>
          <button
            className="books-modal-btn-save"
            onClick={handleSave}
            disabled={!title.trim() || folders.length === 0 || saving}
          >
            {saving ? '...' : isEdit ? t.projects.editSave : copy.addItem}
          </button>
        </div>
      </div>
    </div>
  );
}
