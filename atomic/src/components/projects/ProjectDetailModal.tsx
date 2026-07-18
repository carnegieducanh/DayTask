import { useState, useEffect, useRef } from 'react';
import { IconX, IconChevronDown, IconCheck, IconTrash, IconPencil } from '@tabler/icons-react';
import type { Project, ProjectStatus } from '../../types';
import { useT } from '../../i18n';
import { formatISODate } from '../../utils/imageUtils';
import { CATEGORY_LINK_ICON, STATUS_ICON } from './icons';

interface ProjectDetailModalProps {
  project: Project;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: ProjectStatus) => void;
}

export default function ProjectDetailModal({ project, onClose, onEdit, onDelete, onStatusChange }: ProjectDetailModalProps) {
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

  const copy = t.projects.categoryCopy[project.category];
  const linkIcons = CATEGORY_LINK_ICON[project.category];
  const statusLabel = project.status === 'completed' ? copy.statusCompleted : copy.statusInProgress;
  const statusOptions: { id: ProjectStatus; label: string }[] = [
    { id: 'in_progress', label: copy.statusInProgress },
    { id: 'completed', label: copy.statusCompleted },
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
              <img src={project.cover_image} alt={project.title} style={{ objectPosition: project.cover_position ?? '50% 50%' }} />
            </div>
          )}
          <div className="projects-detail-title">{project.title}</div>
          {project.composer && <div className="projects-detail-composer">{project.composer}</div>}

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
                  {linkIcons.primary}
                  {copy.openPrimary}
                </button>
              )}
              {project.link_youtube && (
                <button className="projects-detail-link-btn" onClick={() => openLink(project.link_youtube!)}>
                  {linkIcons.secondary}
                  {copy.openSecondary}
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
