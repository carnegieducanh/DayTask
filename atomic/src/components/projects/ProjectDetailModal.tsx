import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconX, IconChevronDown, IconCheck, IconTrash, IconPencil } from '@tabler/icons-react';
import type { Project, ProjectStatus } from '../../types';
import { useT } from '../../i18n';
import { formatISODate } from '../../utils/imageUtils';
import { CATEGORY_LINK_ICON } from './icons';

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

  return createPortal(
    <div className="books-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <div className="pj-detail">
        <button ref={closeRef} className="pj-detail-close" onClick={onClose}>
          <IconX size={15} />
        </button>

        <div className="pj-detail-body">
          {project.cover_image && (
            <div className="pj-detail-cover">
              <img src={project.cover_image} alt={project.title} style={{ objectPosition: project.cover_position ?? '50% 50%' }} />
            </div>
          )}

          <div className="pj-detail-head">
            <span className="pj-eyebrow">{t.projects.categoryLabels[project.category]}</span>
            <h2 className="pj-detail-title">{project.title}</h2>
            {project.composer && <span className="pj-byline">{project.composer}</span>}
          </div>

          <div className="pj-detail-status-row">
            <div className="pj-status-dropdown" ref={statusMenuRef}>
              <button
                type="button"
                className={`pj-status-trigger status-${project.status}${statusMenuOpen ? ' open' : ''}`}
                onClick={() => setStatusMenuOpen((v) => !v)}
              >
                <span className="pj-status-dot" />
                {statusLabel}
                <IconChevronDown size={12} className="pj-status-chevron" />
              </button>
              {statusMenuOpen && (
                <div className="pj-status-menu">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`pj-status-option status-${opt.id}${opt.id === project.status ? ' active' : ''}`}
                      onClick={() => handleStatusPick(opt.id)}
                    >
                      <span className="pj-status-dot" />
                      {opt.label}
                      {opt.id === project.status && <IconCheck size={13} className="pj-status-check" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {dateInfo && <span className="pj-detail-date">{dateInfo}</span>}
          </div>

          {project.folders.length > 0 && (
            <div className="pj-tags pj-detail-tags">
              {project.folders.map((f) => <span key={f} className="pj-tag">{f}</span>)}
            </div>
          )}

          {project.notes && <p className="pj-detail-notes">{project.notes}</p>}

          {(project.link_repo || project.link_youtube) && (
            <div className="pj-detail-links">
              {project.link_repo && (
                <button className="pj-link-btn" onClick={() => openLink(project.link_repo!)}>
                  {linkIcons.primary}
                  {copy.openPrimary}
                </button>
              )}
              {project.link_youtube && (
                <button className="pj-link-btn" onClick={() => openLink(project.link_youtube!)}>
                  {linkIcons.secondary}
                  {copy.openSecondary}
                </button>
              )}
            </div>
          )}

          <div className="pj-detail-added">
            {t.projects.addedOn(formatISODate(project.created_at.split(' ')[0]))}
          </div>
        </div>

        <div className="pj-detail-foot">
          <div className="pj-detail-foot-group">
            <button className="pj-text-btn danger" onClick={onDelete}>
              <IconTrash size={14} />
              {t.projects.delete}
            </button>
            <button className="pj-text-btn" onClick={onEdit}>
              <IconPencil size={14} />
              {t.projects.edit}
            </button>
          </div>
          <button className="pj-btn-primary" onClick={onClose}>{t.projects.done}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
