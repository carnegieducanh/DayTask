import { useState, useEffect, useRef } from 'react';
import { IconPencil, IconTrash, IconX, IconCheck, IconArrowsMove } from '@tabler/icons-react';
import type { ProjectFolder } from '../../types';
import { defaultFolderCover } from '../../store/projectsDb';
import { useT } from '../../i18n';
import { formatISODate } from '../../utils/imageUtils';
import { clampPercent, parseCoverPosition } from './projectImageUtils';

export default function FolderCard({
  folder, onOpen, onEdit, onDelete, onRepositionCover,
}: {
  folder: ProjectFolder; onOpen: () => void; onEdit: () => void; onDelete: () => void;
  onRepositionCover: (position: string) => void;
}) {
  const t = useT();
  const copy = t.projects.categoryCopy[folder.category];

  const [repositioning, setRepositioning] = useState(false);
  const [pos, setPos] = useState(() => parseCoverPosition(folder.cover_position));
  const coverRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; fromX: number; fromY: number; overflowX: number; overflowY: number } | null>(null);

  useEffect(() => {
    if (!repositioning) setPos(parseCoverPosition(folder.cover_position));
  }, [folder.cover_position, repositioning]);

  function startReposition(e: React.MouseEvent) {
    e.stopPropagation();
    setRepositioning(true);
  }

  function cancelReposition(e: React.MouseEvent) {
    e.stopPropagation();
    setRepositioning(false);
    setPos(parseCoverPosition(folder.cover_position));
  }

  function confirmReposition(e: React.MouseEvent) {
    e.stopPropagation();
    setRepositioning(false);
    onRepositionCover(`${pos.x.toFixed(1)}% ${pos.y.toFixed(1)}%`);
  }

  function handleCoverClick(e: React.MouseEvent) {
    if (repositioning) e.stopPropagation();
  }

  function handlePointerDown(e: React.PointerEvent<HTMLImageElement>) {
    if (!repositioning || !coverRef.current || !imgRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = coverRef.current.getBoundingClientRect();
    const img = imgRef.current;
    const scale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight) || 1;
    const overflowX = Math.max(img.naturalWidth * scale - rect.width, 0);
    const overflowY = Math.max(img.naturalHeight * scale - rect.height, 0);
    dragRef.current = { startX: e.clientX, startY: e.clientY, fromX: pos.x, fromY: pos.y, overflowX, overflowY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLImageElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const nextX = drag.overflowX > 0 ? clampPercent(drag.fromX - (dx / drag.overflowX) * 100) : drag.fromX;
    const nextY = drag.overflowY > 0 ? clampPercent(drag.fromY - (dy / drag.overflowY) * 100) : drag.fromY;
    setPos({ x: nextX, y: nextY });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  return (
    <div className={`projects-folder-card${repositioning ? ' is-repositioning' : ''}`} onClick={onOpen}>
      <div className="projects-folder-cover" ref={coverRef} onClick={handleCoverClick}>
        <img
          ref={imgRef}
          src={folder.cover_image ?? defaultFolderCover(folder.name)}
          alt={folder.name}
          draggable={false}
          style={{ objectPosition: `${pos.x}% ${pos.y}%`, cursor: repositioning ? 'grab' : undefined }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        {repositioning ? (
          <>
            <div className="projects-cover-reposition-hint">{t.projects.coverRepositionHint}</div>
            <div className="projects-folder-actions">
              <button className="projects-folder-action-btn" onClick={confirmReposition} title={t.projects.done}>
                <IconCheck size={13} />
              </button>
              <button className="projects-folder-action-btn danger" onClick={cancelReposition} title={t.projects.cancel}>
                <IconX size={13} />
              </button>
            </div>
          </>
        ) : (
          <div className="projects-folder-actions">
            {folder.cover_image && (
              <button className="projects-folder-action-btn" onClick={startReposition} title={t.projects.coverReposition}>
                <IconArrowsMove size={13} />
              </button>
            )}
            <button className="projects-folder-action-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <IconPencil size={13} />
            </button>
            <button className="projects-folder-action-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <IconTrash size={13} />
            </button>
          </div>
        )}
      </div>
      <div className="projects-folder-body">
        <div className="projects-folder-name" title={folder.name}>{folder.name}</div>
        <div className="projects-folder-meta">
          <span>{copy.folderCount(folder.project_count)}</span>
          {folder.last_activity && <span>{t.projects.folderUpdated(formatISODate(folder.last_activity.split(' ')[0]))}</span>}
        </div>
      </div>
    </div>
  );
}
