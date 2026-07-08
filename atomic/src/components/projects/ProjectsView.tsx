import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { useSmoothScroll, attachSmoothScroll } from '../../hooks/useSmoothScroll';
import ResizableTextarea from '../ResizableTextarea';
import {
  IconFolderCode,
  IconFolder,
  IconCode,
  IconPlus,
  IconTrash,
  IconPencil,
  IconX,
  IconCheck,
  IconArrowLeft,
  IconSearch,
  IconTag,
  IconChevronDown,
  IconCameraPlus,
  IconClockHour4,
  IconCircleCheck,
  IconBrandGithub,
  IconBrandYoutube,
  IconStack2,
} from '@tabler/icons-react';
import type { Project, ProjectFolder, ProjectStatus, NewProject } from '../../types';
import {
  dbGetProjects,
  dbAddProject,
  dbUpdateProject,
  dbDeleteProject,
  dbGetProjectStats,
  dbGetYearsWithCounts,
  dbGetFolders,
  dbAddFolder,
  dbUpdateFolder,
  dbDeleteFolder,
  dbGetAllFolderNames,
  dbCreateFolderTag,
  dbRenameFolderName,
  dbDeleteFolderByName,
  seedProjectsIfEmpty,
} from '../../store/projectsDb';
import { useT } from '../../i18n';

type StatusFilter = 'all' | ProjectStatus;
type SortBy = 'date' | 'title' | 'status';

const MAX_COVER_DIM = 640;
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

function formatISODate(iso: string): string {
  const [y, m, d] = iso.split(/[- ]/);
  return `${d}/${m}/${y}`;
}

function sortProjects(list: Project[], sortBy: SortBy): Project[] {
  const arr = [...list];
  if (sortBy === 'title') arr.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortBy === 'status') arr.sort((a, b) => a.status.localeCompare(b.status));
  else arr.sort((a, b) => (b.completed_date ?? b.start_date ?? b.created_at).localeCompare(a.completed_date ?? a.start_date ?? a.created_at));
  return arr;
}

// ── FolderCard ───────────────────────────────────────────────────────────────

function FolderCard({
  folder, onOpen, onEdit, onDelete,
}: {
  folder: ProjectFolder; onOpen: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const t = useT();
  return (
    <div className="projects-folder-card" onClick={onOpen}>
      <div className="projects-folder-cover">
        {folder.cover_image ? (
          <img src={folder.cover_image} alt={folder.name} />
        ) : (
          <div className="projects-folder-cover-placeholder">
            <IconFolder size={30} />
          </div>
        )}
        <div className="projects-folder-actions">
          <button className="projects-folder-action-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <IconPencil size={13} />
          </button>
          <button className="projects-folder-action-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <IconTrash size={13} />
          </button>
        </div>
      </div>
      <div className="projects-folder-body">
        <div className="projects-folder-name" title={folder.name}>{folder.name}</div>
        <div className="projects-folder-meta">
          <span>{t.projects.folderCount(folder.project_count)}</span>
          {folder.last_activity && <span>{t.projects.folderUpdated(formatISODate(folder.last_activity.split(' ')[0]))}</span>}
        </div>
      </div>
    </div>
  );
}

// ── AddFolderModal ───────────────────────────────────────────────────────────

interface AddFolderModalProps {
  onSave: (name: string, coverImage: string | null) => Promise<void>;
  onClose: () => void;
  initialFolder?: ProjectFolder;
}

function AddFolderModal({ onSave, onClose, initialFolder }: AddFolderModalProps) {
  const t = useT();
  const isEdit = !!initialFolder;
  const [name, setName] = useState(initialFolder?.name ?? '');
  const [coverImage, setCoverImage] = useState<string | null>(initialFolder?.cover_image ?? null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function applyCoverFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    try {
      setCoverImage(await compressCoverImage(file));
    } catch {
      // ignore unreadable image
    }
  }

  async function handlePickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await applyCoverFile(file);
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current += 1;
    setDragOver(true);
  }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setDragOver(false); }
  }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await applyCoverFile(file);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), coverImage);
    setSaving(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="books-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <div className="books-modal projects-folder-modal">
        <div className="books-modal-header">
          <span className="books-modal-title">{isEdit ? t.projects.modalEditFolderTitle : t.projects.modalAddFolderTitle}</span>
          <button className="books-modal-close" onClick={onClose}><IconX size={16} /></button>
        </div>

        <div className="books-modal-body">
          <div
            className={`projects-folder-cover-row${dragOver ? ' drag-over' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePickCover} />
            <button type="button" className="projects-folder-cover-picker" onClick={() => fileInputRef.current?.click()}>
              {coverImage ? (
                <img src={coverImage} alt="" />
              ) : (
                <div className="projects-folder-cover-picker-empty">
                  <IconCameraPlus size={22} />
                  <span>{dragOver ? t.projects.coverDrop : t.projects.coverUpload}</span>
                </div>
              )}
            </button>
            <div className="books-cover-actions">
              <button type="button" className="books-cover-action-btn" onClick={() => fileInputRef.current?.click()}>
                {coverImage ? t.projects.coverChange : t.projects.coverUpload}
              </button>
              {coverImage && (
                <button type="button" className="books-cover-action-btn danger" onClick={() => setCoverImage(null)}>
                  {t.projects.coverRemove}
                </button>
              )}
            </div>
          </div>

          <label className="books-modal-label">{t.projects.folderNameLabel}</label>
          <input
            ref={nameRef}
            className="books-modal-input"
            placeholder={t.projects.folderNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="books-modal-footer">
          <button className="books-modal-btn-cancel" onClick={onClose}>{t.projects.cancel}</button>
          <button className="books-modal-btn-save" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? '...' : isEdit ? t.projects.editSaveFolder : t.projects.saveFolder}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProjectCard ──────────────────────────────────────────────────────────────

const STATUS_ICON: Record<ProjectStatus, React.ReactNode> = {
  in_progress: <IconClockHour4 size={13} />,
  completed: <IconCircleCheck size={13} />,
};

function ProjectCard({
  project, onView, onEdit, onDelete,
}: {
  project: Project; onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const t = useT();
  const statusLabel = project.status === 'completed' ? t.projects.statusCompleted : t.projects.statusInProgress;
  const dateText = project.status === 'completed' && project.completed_date
    ? formatISODate(project.completed_date)
    : project.start_date
    ? t.projects.inProgressSince(formatISODate(project.start_date))
    : null;

  return (
    <div className="projects-card" onClick={onView}>
      <div className="projects-card-cover">
        {project.cover_image ? (
          <img src={project.cover_image} alt={project.title} />
        ) : (
          <div className="projects-folder-cover-placeholder">
            <IconCode size={26} />
          </div>
        )}
        <div className="projects-folder-actions">
          <button className="projects-folder-action-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <IconPencil size={13} />
          </button>
          <button className="projects-folder-action-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <IconTrash size={13} />
          </button>
        </div>
      </div>
      <div className="projects-card-body">
        <div className="projects-card-head">
          <span className={`projects-status-badge status-${project.status}`}>
            {STATUS_ICON[project.status]}
            {statusLabel}
          </span>
          {dateText && <span className="projects-card-date">{dateText}</span>}
        </div>
        <div className="projects-card-title" title={project.title}>{project.title}</div>
        {project.notes && <div className="projects-card-notes">{project.notes}</div>}
        {project.folders.length > 0 && (
          <div className="projects-card-tags">
            {project.folders.map((f) => (
              <span key={f} className="books-tag-chip-sm">{f}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ProjectDetailModal ───────────────────────────────────────────────────────

interface ProjectDetailModalProps {
  project: Project;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: ProjectStatus) => void;
}

function ProjectDetailModal({ project, onClose, onEdit, onDelete, onStatusChange }: ProjectDetailModalProps) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { closeRef.current?.focus(); }, []);

  useEffect(() => {
    if (!statusMenuOpen) return;
    function handler(e: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setStatusMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusMenuOpen]);

  const statusLabel = project.status === 'completed' ? t.projects.statusCompleted : t.projects.statusInProgress;
  const statusOptions: { id: ProjectStatus; label: string }[] = [
    { id: 'in_progress', label: t.projects.statusInProgress },
    { id: 'completed', label: t.projects.statusCompleted },
  ];

  function handleStatusPick(next: ProjectStatus) {
    setStatusMenuOpen(false);
    if (next !== project.status) onStatusChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      if (statusMenuOpen) setStatusMenuOpen(false);
      else onClose();
    }
  }

  async function openLink(url: string) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  const dateInfo = project.status === 'completed' && project.completed_date
    ? t.projects.completedOn(formatISODate(project.completed_date))
    : project.start_date
    ? t.projects.inProgressSince(formatISODate(project.start_date))
    : null;

  return (
    <div className="books-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <div className="books-detail-modal projects-detail-modal">
        <button ref={closeRef} className="books-detail-close" onClick={onClose}>
          <IconX size={16} />
        </button>

        <div className="projects-detail-body">
          {project.cover_image && (
            <div className="projects-detail-cover">
              <img src={project.cover_image} alt={project.title} />
            </div>
          )}
          <div className="projects-detail-title">{project.title}</div>

          <div className="books-detail-badges">
            <div className="books-detail-status-dropdown" ref={statusMenuRef}>
              <button
                type="button"
                className={`books-detail-status-badge status-${project.status}${statusMenuOpen ? ' open' : ''}`}
                onClick={() => setStatusMenuOpen((v) => !v)}
              >
                {STATUS_ICON[project.status]}
                {statusLabel}
                <IconChevronDown size={12} className={`books-detail-status-chevron${statusMenuOpen ? ' open' : ''}`} />
              </button>
              {statusMenuOpen && (
                <div className="books-detail-status-menu">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`books-detail-status-option${opt.id === project.status ? ' active' : ''}`}
                      onClick={() => handleStatusPick(opt.id)}
                    >
                      {STATUS_ICON[opt.id]}
                      {opt.label}
                      {opt.id === project.status && <IconCheck size={12} className="books-detail-status-check" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {dateInfo && <span className="books-detail-date">{dateInfo}</span>}
          </div>

          {project.folders.length > 0 && (
            <div className="books-detail-tags">
              {project.folders.map((f) => <span key={f} className="books-tag-chip-sm">{f}</span>)}
            </div>
          )}

          {project.notes && <div className="books-detail-notes">{project.notes}</div>}

          {(project.link_repo || project.link_youtube) && (
            <div className="projects-detail-links">
              {project.link_repo && (
                <button className="projects-detail-link-btn" onClick={() => openLink(project.link_repo!)}>
                  <IconBrandGithub size={14} />
                  {t.projects.openRepo}
                </button>
              )}
              {project.link_youtube && (
                <button className="projects-detail-link-btn" onClick={() => openLink(project.link_youtube!)}>
                  <IconBrandYoutube size={14} />
                  {t.projects.openYoutube}
                </button>
              )}
            </div>
          )}

          <div className="books-detail-meta">
            {t.projects.addedOn(formatISODate(project.created_at.split(' ')[0]))}
          </div>
        </div>

        <div className="books-modal-footer books-detail-footer">
          <div className="books-modal-footer-group">
            <button className="books-modal-btn-cancel books-detail-delete" onClick={onDelete}>
              {t.projects.delete}
              <IconTrash size={13} />
            </button>
            <button className="books-modal-btn-cancel" onClick={onEdit}>
              {t.projects.edit}
              <IconPencil size={13} />
            </button>
          </div>
          <button className="books-modal-btn-save" onClick={onClose}>{t.projects.done}</button>
        </div>
      </div>
    </div>
  );
}

// ── AddProjectModal ──────────────────────────────────────────────────────────

interface AddProjectModalProps {
  onSave: (data: NewProject) => Promise<void>;
  onClose: () => void;
  initialProject?: Project;
  initialFolders?: string[];
  onFolderDeleted: (name: string, undo: () => void) => void;
}

function AddProjectModal({ onSave, onClose, initialProject, initialFolders, onFolderDeleted }: AddProjectModalProps) {
  const t = useT();
  const isEdit = !!initialProject;
  const [title, setTitle] = useState(initialProject?.title ?? '');
  const [status, setStatus] = useState<ProjectStatus>(initialProject?.status ?? 'in_progress');
  const [startDate, setStartDate] = useState(initialProject?.start_date ?? format(new Date(), 'yyyy-MM-dd'));
  const [completedDate, setCompletedDate] = useState(initialProject?.completed_date ?? format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState(initialProject?.notes ?? '');
  const [linkRepo, setLinkRepo] = useState(initialProject?.link_repo ?? '');
  const [linkYoutube, setLinkYoutube] = useState(initialProject?.link_youtube ?? '');
  const [folders, setFolders] = useState<string[]>(initialProject?.folders ?? initialFolders ?? []);
  const [coverImage, setCoverImage] = useState<string | null>(initialProject?.cover_image ?? null);
  const [coverDragOver, setCoverDragOver] = useState(false);
  const coverDragCounterRef = useRef(0);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
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
    dbGetAllFolderNames().then(setAllFolders);
  }, []);

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
      dbCreateFolderTag(name);
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
    await dbRenameFolderName(oldName, newName);
    setAllFolders((prev) => prev.map((f) => (f === oldName ? newName : f)).sort());
    setFolders((prev) => prev.map((f) => (f === oldName ? newName : f)));
  }

  function handleDeleteFolder(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    const wasSelected = folders.includes(name);
    setAllFolders((prev) => prev.filter((f) => f !== name));
    if (wasSelected) setFolders((prev) => prev.filter((f) => f !== name));
    onFolderDeleted(name, () => {
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
      setCoverImage(await compressCoverImage(file));
    } catch {
      // ignore unreadable image
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

  async function handleSave() {
    if (!title.trim() || folders.length === 0) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      status,
      start_date: startDate || null,
      completed_date: status === 'completed' ? completedDate : null,
      notes: notes.trim() || undefined,
      link_repo: linkRepo.trim() || undefined,
      link_youtube: linkYoutube.trim() || undefined,
      cover_image: coverImage,
      folders,
    });
    setSaving(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && !folderDropOpen) onClose();
  }

  const filteredFolders = allFolders.filter((f) => !folderSearch || f.toLowerCase().includes(folderSearch.toLowerCase()));

  return (
    <div className="books-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <div className="books-modal">
        <div className="books-modal-header">
          <span className="books-modal-title">{isEdit ? t.projects.modalEditProjectTitle : t.projects.modalAddProjectTitle}</span>
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
            <button type="button" className="projects-folder-cover-picker" onClick={() => coverFileInputRef.current?.click()}>
              {coverImage ? (
                <img src={coverImage} alt="" />
              ) : (
                <div className="projects-folder-cover-picker-empty">
                  <IconCameraPlus size={22} />
                  <span>{coverDragOver ? t.projects.coverDrop : t.projects.coverUpload}</span>
                </div>
              )}
            </button>
            <div className="books-cover-actions">
              <button type="button" className="books-cover-action-btn" onClick={() => coverFileInputRef.current?.click()}>
                {coverImage ? t.projects.coverChange : t.projects.coverUpload}
              </button>
              {coverImage && (
                <button type="button" className="books-cover-action-btn danger" onClick={() => setCoverImage(null)}>
                  {t.projects.coverRemove}
                </button>
              )}
            </div>
          </div>

          <label className="books-modal-label">{t.projects.titleLabel}</label>
          <input
            ref={titleRef}
            className="books-modal-input"
            placeholder={t.projects.titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            spellCheck={false}
          />

          <div className="books-modal-row">
            <div className="books-modal-col">
              <label className="books-modal-label">{t.projects.statusLabel}</label>
              <div className="books-status-toggle">
                {(
                  [
                    { id: 'in_progress', label: t.projects.statusInProgress },
                    { id: 'completed', label: t.projects.statusCompleted },
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
              <label className="books-modal-label">{t.projects.linkRepoLabel}</label>
              <input
                className="books-modal-input"
                placeholder={t.projects.linkRepoPlaceholder}
                value={linkRepo}
                onChange={(e) => setLinkRepo(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="books-modal-col">
              <label className="books-modal-label">{t.projects.linkYoutubeLabel}</label>
              <input
                className="books-modal-input"
                placeholder={t.projects.linkYoutubePlaceholder}
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
            {saving ? '...' : isEdit ? t.projects.editSave : t.projects.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProjectsView ─────────────────────────────────────────────────────────────

export default function ProjectsView() {
  const t = useT();

  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [openFolder, setOpenFolder] = useState<ProjectFolder | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [tagSearch, setTagSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [years, setYears] = useState<{ year: number; count: number }[]>([]);
  const [stats, setStats] = useState({ total: 0, inProgress: 0, completed: 0 });
  const [yearStats, setYearStats] = useState({ total: 0, inProgress: 0, completed: 0 });
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ProjectFolder | null>(null);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<ProjectFolder | null>(null);
  const [pendingDeleteFolderTag, setPendingDeleteFolderTag] = useState<{ name: string; undo: () => void } | null>(null);
  const [seeded, setSeeded] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteProjectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteFolderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteFolderTagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useSmoothScroll(mainRef);
  useSmoothScroll(sidebarRef);

  const loadStats = useCallback(async () => {
    setStats(await dbGetProjectStats());
  }, []);

  const loadYearStats = useCallback(async (year: number | null) => {
    setYearStats(await dbGetProjectStats(year ?? undefined));
  }, []);

  const loadYears = useCallback(async (status: StatusFilter) => {
    setYears(await dbGetYearsWithCounts(status === 'all' ? undefined : status));
  }, []);

  const loadFolders = useCallback(async (status: StatusFilter, year: number | null) => {
    setFolders(await dbGetFolders({ status: status === 'all' ? undefined : status, year: year ?? undefined }));
  }, []);

  const loadProjects = useCallback(async (
    folderName: string,
    status: StatusFilter,
    year: number | null,
    search: string
  ) => {
    setProjects(await dbGetProjects({
      folder: folderName,
      status: status === 'all' ? undefined : status,
      year: year ?? undefined,
      search,
    }));
  }, []);

  useEffect(() => {
    seedProjectsIfEmpty().then(() => setSeeded(true));
  }, []);

  useEffect(() => {
    if (!seeded) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded]);

  useEffect(() => {
    if (!seeded) return;
    loadYearStats(yearFilter);
    loadYears(statusFilter);
    loadFolders(statusFilter, yearFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, statusFilter, yearFilter]);

  useEffect(() => {
    if (!seeded || !openFolder) return;
    loadProjects(openFolder.name, statusFilter, yearFilter, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, openFolder, statusFilter, yearFilter]);

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (openFolder) loadProjects(openFolder.name, statusFilter, yearFilter, q);
    }, 300);
  }

  function handleOpenFolder(folder: ProjectFolder) {
    setOpenFolder(folder);
    setSearchQuery('');
  }

  function handleBack() {
    setOpenFolder(null);
    setProjects([]);
    setSearchQuery('');
  }

  async function refreshAll() {
    await Promise.all([
      loadStats(),
      loadYearStats(yearFilter),
      loadYears(statusFilter),
      loadFolders(statusFilter, yearFilter),
      openFolder ? loadProjects(openFolder.name, statusFilter, yearFilter, searchQuery) : Promise.resolve(),
    ]);
  }

  async function handleSaveFolder(name: string, coverImage: string | null) {
    if (editingFolder) {
      await dbUpdateFolder(editingFolder.id, name, coverImage);
      setEditingFolder(null);
      if (openFolder && openFolder.id === editingFolder.id) setOpenFolder({ ...openFolder, name, cover_image: coverImage });
    } else {
      await dbAddFolder(name, coverImage);
      setShowAddFolderModal(false);
    }
    await loadFolders(statusFilter, yearFilter);
  }

  async function commitDeleteFolder(folder: ProjectFolder) {
    await dbDeleteFolder(folder.id);
    setPendingDeleteFolder(null);
    await Promise.all([loadStats(), loadYearStats(yearFilter), loadYears(statusFilter)]);
  }

  function handleDeleteFolder(folder: ProjectFolder) {
    if (deleteFolderTimerRef.current) clearTimeout(deleteFolderTimerRef.current);
    if (pendingDeleteFolder) commitDeleteFolder(pendingDeleteFolder);

    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    setPendingDeleteFolder(folder);
    if (openFolder && openFolder.id === folder.id) handleBack();

    deleteFolderTimerRef.current = setTimeout(() => commitDeleteFolder(folder), 4000);
  }

  function handleUndoDeleteFolder() {
    if (deleteFolderTimerRef.current) clearTimeout(deleteFolderTimerRef.current);
    if (!pendingDeleteFolder) return;
    loadFolders(statusFilter, yearFilter);
    setPendingDeleteFolder(null);
  }

  async function handleAddProject(data: NewProject) {
    const p = await dbAddProject(data);
    if (p) {
      setShowAddProjectModal(false);
      await refreshAll();
    }
  }

  async function handleUpdateProject(data: NewProject) {
    if (!editingProject) return;
    await dbUpdateProject(editingProject.id, data);
    setEditingProject(null);
    await refreshAll();
  }

  async function handleQuickStatusChange(project: Project, status: ProjectStatus) {
    const completed_date = status === 'completed' ? project.completed_date ?? format(new Date(), 'yyyy-MM-dd') : null;
    await dbUpdateProject(project.id, {
      title: project.title,
      status,
      start_date: project.start_date,
      completed_date,
      notes: project.notes ?? undefined,
      link_repo: project.link_repo ?? undefined,
      link_youtube: project.link_youtube ?? undefined,
      cover_image: project.cover_image,
      folders: project.folders,
    });
    setViewingProject((prev) => (prev && prev.id === project.id ? { ...prev, status, completed_date } : prev));
    await refreshAll();
  }

  async function commitDeleteProject(project: Project) {
    await dbDeleteProject(project.id);
    await Promise.all([loadStats(), loadYearStats(yearFilter), loadYears(statusFilter), loadFolders(statusFilter, yearFilter)]);
    setPendingDeleteProject(null);
  }

  function handleDeleteProject(project: Project) {
    if (deleteProjectTimerRef.current) clearTimeout(deleteProjectTimerRef.current);
    if (pendingDeleteProject) commitDeleteProject(pendingDeleteProject);

    setProjects((prev) => prev.filter((p) => p.id !== project.id));
    setPendingDeleteProject(project);

    deleteProjectTimerRef.current = setTimeout(() => commitDeleteProject(project), 4000);
  }

  function handleUndoDeleteProject() {
    if (deleteProjectTimerRef.current) clearTimeout(deleteProjectTimerRef.current);
    if (!pendingDeleteProject || !openFolder) return;
    loadProjects(openFolder.name, statusFilter, yearFilter, searchQuery);
    setPendingDeleteProject(null);
  }

  async function commitDeleteFolderTag(name: string) {
    await dbDeleteFolderByName(name);
    setPendingDeleteFolderTag(null);
    await loadFolders(statusFilter, yearFilter);
  }

  function handleFolderTagDeleted(name: string, undo: () => void) {
    if (deleteFolderTagTimerRef.current) clearTimeout(deleteFolderTagTimerRef.current);
    if (pendingDeleteFolderTag) commitDeleteFolderTag(pendingDeleteFolderTag.name);

    setPendingDeleteFolderTag({ name, undo });
    deleteFolderTagTimerRef.current = setTimeout(() => commitDeleteFolderTag(name), 4000);
  }

  function handleUndoFolderTagDelete() {
    if (!pendingDeleteFolderTag) return;
    if (deleteFolderTagTimerRef.current) { clearTimeout(deleteFolderTagTimerRef.current); deleteFolderTagTimerRef.current = null; }
    pendingDeleteFolderTag.undo();
    setPendingDeleteFolderTag(null);
  }

  function handleStatusFilter(f: StatusFilter) {
    setStatusFilter(f);
  }

  function handleYearFilter(year: number) {
    setYearFilter((prev) => (prev === year ? null : year));
  }

  const sortedProjects = useMemo(() => sortProjects(projects, sortBy), [projects, sortBy]);

  const isFiltering = statusFilter !== 'all' || yearFilter !== null;

  const visibleFolders = useMemo(
    () => (isFiltering ? folders.filter((f) => f.project_count > 0) : folders),
    [folders, isFiltering]
  );

  const filteredTagFolders = useMemo(
    () => visibleFolders.filter((f) => !tagSearch || f.name.toLowerCase().includes(tagSearch.toLowerCase())),
    [visibleFolders, tagSearch]
  );

  const headerSubText = useMemo(() => {
    if (statusFilter === 'in_progress') return t.projects.totalCount(yearStats.inProgress);
    if (statusFilter === 'completed') return t.projects.totalCount(yearStats.completed);
    return t.projects.totalCount(yearStats.total);
  }, [yearStats, t, statusFilter]);

  const emptyProjectsText = searchQuery ? t.projects.emptySearch : t.projects.emptyProjects;

  return (
    <div className="books-wrap">
      {/* ── Sidebar ── */}
      <div ref={sidebarRef} className="books-sidebar projects-sidebar">
        <div className="books-sb-section">
          <div className="books-sb-label">{t.nav.projects}</div>
          <button
            className={`books-sb-item${statusFilter === 'all' ? ' active' : ''}`}
            onClick={() => handleStatusFilter('all')}
          >
            <IconStack2 size={14} />
            {t.projects.statusAll}
            <span className="books-sb-count">{stats.total}</span>
          </button>
          <button
            className={`books-sb-item${statusFilter === 'in_progress' ? ' active' : ''}`}
            onClick={() => handleStatusFilter('in_progress')}
          >
            <IconClockHour4 size={14} />
            {t.projects.statusInProgress}
            <span className="books-sb-count">{stats.inProgress}</span>
          </button>
          <button
            className={`books-sb-item${statusFilter === 'completed' ? ' active' : ''}`}
            onClick={() => handleStatusFilter('completed')}
          >
            <IconCircleCheck size={14} />
            {t.projects.statusCompleted}
            <span className="books-sb-count">{stats.completed}</span>
          </button>
        </div>

        {years.length > 0 && (
          <div className="books-sb-section">
            <div className="books-sb-label">{t.projects.byYear}</div>
            <div key={`years-${statusFilter}`} className="projects-year-list">
              {years.map(({ year, count }) => (
                <button
                  key={year}
                  className={`books-sb-item${yearFilter === year ? ' active' : ''}`}
                  onClick={() => handleYearFilter(year)}
                >
                  <span className="books-year-badge">{year}</span>
                  <span className="books-sb-count">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {folders.length > 0 && (
          <div className="books-sb-section">
            <div className="books-sb-label">{t.calendar.filterTags}</div>
            <div className="books-sb-tag-search-wrap">
              <IconSearch size={12} className="books-sb-tag-search-icon" />
              <input
                className="books-sb-tag-search"
                type="text"
                placeholder={t.calendar.filterTagSearch}
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div key={`tags-${statusFilter}-${yearFilter ?? ''}`} className="books-sb-tag-list">
              {filteredTagFolders.length === 0 ? (
                <div className="books-sb-tag-empty">{t.tags.noTags}</div>
              ) : (
                filteredTagFolders.map((folder) => (
                  <button
                    key={folder.id}
                    className={`books-sb-item${openFolder?.id === folder.id ? ' active' : ''}`}
                    onClick={() => handleOpenFolder(folder)}
                  >
                    <IconTag size={13} />
                    <span className="books-sb-item-name">{folder.name}</span>
                    <span className="books-sb-count">{folder.project_count}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Main ── */}
      <div ref={mainRef} className="books-main projects-main">
        {!openFolder ? (
          <>
            <div className="books-header">
              <div>
                <div className="books-header-title">{t.projects.title}</div>
                <div className="books-header-sub">{headerSubText}</div>
              </div>
              <button className="books-btn-add" onClick={() => setShowAddFolderModal(true)}>
                <IconPlus size={13} />
                {t.projects.addFolder}
              </button>
            </div>

            <div key={`${statusFilter}-${yearFilter ?? ''}`} className="books-content-view">
              {folders.length === 0 ? (
                <div className="books-empty-state">
                  <IconFolderCode size={36} className="books-empty-icon" />
                  <p className="books-empty-text">{t.projects.emptyFolders}</p>
                  <button className="books-btn-add" onClick={() => setShowAddFolderModal(true)}>
                    <IconPlus size={13} />
                    {t.projects.addFolder}
                  </button>
                </div>
              ) : visibleFolders.length === 0 ? (
                <div className="books-empty-state">
                  <IconFolderCode size={36} className="books-empty-icon" />
                  <p className="books-empty-text">{t.projects.emptyFolderResults}</p>
                </div>
              ) : (
                <div className="projects-folder-grid">
                  {visibleFolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      onOpen={() => handleOpenFolder(folder)}
                      onEdit={() => setEditingFolder(folder)}
                      onDelete={() => handleDeleteFolder(folder)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="books-header projects-detail-header">
              <div className="projects-back-row">
                <button className="projects-back-btn" onClick={handleBack}>
                  <IconArrowLeft size={15} />
                  {t.projects.back}
                </button>
                <div>
                  <div className="books-header-title">{openFolder.name}</div>
                  <div className="books-header-sub">{t.projects.folderCount(projects.length)}</div>
                </div>
              </div>
              <button className="books-btn-add" onClick={() => setShowAddProjectModal(true)}>
                <IconPlus size={13} />
                {t.projects.addProject}
              </button>
            </div>

            <div className="books-toolbar">
              <div className="books-search-wrap">
                <IconSearch size={13} className="books-search-icon" />
                <input
                  className="books-search-input"
                  placeholder={t.projects.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  spellCheck={false}
                />
                {searchQuery && (
                  <button
                    className="books-search-clear"
                    onClick={() => { setSearchQuery(''); loadProjects(openFolder.name, statusFilter, yearFilter, ''); }}
                  >
                    <IconX size={12} />
                  </button>
                )}
              </div>
              <select className="books-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                <option value="date">{t.projects.sortDate}</option>
                <option value="title">{t.projects.sortTitle}</option>
                <option value="status">{t.projects.sortStatus}</option>
              </select>
            </div>

            <div key={`${openFolder.id}-${statusFilter}-${yearFilter ?? ''}`} className="books-content-view">
              {sortedProjects.length === 0 ? (
                <div className="books-empty-state">
                  <IconFolderCode size={36} className="books-empty-icon" />
                  <p className="books-empty-text">{emptyProjectsText}</p>
                </div>
              ) : (
                <div className="projects-card-grid">
                  {sortedProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onView={() => setViewingProject(project)}
                      onEdit={() => setEditingProject(project)}
                      onDelete={() => handleDeleteProject(project)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showAddFolderModal && (
        <AddFolderModal onSave={handleSaveFolder} onClose={() => setShowAddFolderModal(false)} />
      )}

      {editingFolder && (
        <AddFolderModal onSave={handleSaveFolder} onClose={() => setEditingFolder(null)} initialFolder={editingFolder} />
      )}

      {showAddProjectModal && (
        <AddProjectModal
          onSave={handleAddProject}
          onClose={() => setShowAddProjectModal(false)}
          initialFolders={openFolder ? [openFolder.name] : undefined}
          onFolderDeleted={handleFolderTagDeleted}
        />
      )}

      {editingProject && (
        <AddProjectModal
          onSave={handleUpdateProject}
          onClose={() => setEditingProject(null)}
          initialProject={editingProject}
          onFolderDeleted={handleFolderTagDeleted}
        />
      )}

      {viewingProject && (
        <ProjectDetailModal
          project={viewingProject}
          onClose={() => setViewingProject(null)}
          onEdit={() => { setEditingProject(viewingProject); setViewingProject(null); }}
          onDelete={() => { handleDeleteProject(viewingProject); setViewingProject(null); }}
          onStatusChange={(status) => handleQuickStatusChange(viewingProject, status)}
        />
      )}

      {pendingDeleteProject && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{t.projects.deleted(pendingDeleteProject.title)}</span>
          <button className="delete-toast-undo" onClick={handleUndoDeleteProject}>{t.projects.undo}</button>
        </div>
      )}

      {pendingDeleteFolder && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{t.projects.deletedFolder(pendingDeleteFolder.name)}</span>
          <button className="delete-toast-undo" onClick={handleUndoDeleteFolder}>{t.projects.undo}</button>
        </div>
      )}

      {pendingDeleteFolderTag && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{t.toast.deleted(pendingDeleteFolderTag.name)}</span>
          <button className="delete-toast-undo" onClick={handleUndoFolderTagDelete}>{t.toast.undo}</button>
        </div>
      )}
    </div>
  );
}
