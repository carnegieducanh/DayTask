import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { IconPencil, IconTrash, IconX, IconCheck, IconArrowsMove } from '@tabler/icons-react';
import type { Project } from '../../types';
import { useT } from '../../i18n';
import { formatISODate } from '../../utils/imageUtils';
import { clampPercent, parseCoverPosition } from './projectImageUtils';
import { CATEGORY_CARD_ICON } from './icons';

export default function ProjectCard({
  project, onView, onEdit, onDelete, onRepositionCover,
}: {
  project: Project; onView: () => void; onEdit: () => void; onDelete: () => void;
  onRepositionCover: (position: string) => void;
}) {
  const t = useT();
  const copy = t.projects.categoryCopy[project.category];
  const statusLabel = project.status === 'completed' ? copy.statusCompleted : copy.statusInProgress;
  const dateText = project.status === 'completed' && project.completed_date
    ? formatISODate(project.completed_date)
    : project.start_date
    ? t.projects.since(formatISODate(project.start_date))
    : null;

  const [repositioning, setRepositioning] = useState(false);
  const [pos, setPos] = useState(() => parseCoverPosition(project.cover_position));
  const coverRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; fromX: number; fromY: number; overflowX: number; overflowY: number } | null>(null);

  useEffect(() => {
    if (!repositioning) setPos(parseCoverPosition(project.cover_position));
  }, [project.cover_position, repositioning]);

  function startReposition(e: React.MouseEvent) {
    e.stopPropagation();
    setRepositioning(true);
  }

  function cancelReposition(e: React.MouseEvent) {
    e.stopPropagation();
    setRepositioning(false);
    setPos(parseCoverPosition(project.cover_position));
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
    <article className={`pj-card${repositioning ? ' is-repositioning' : ''}`} onClick={onView}>
      <div className="pj-cover" ref={coverRef} onClick={handleCoverClick}>
        {project.cover_image ? (
          <img
            ref={imgRef}
            src={project.cover_image_thumb ?? project.cover_image}
            alt={project.title}
            draggable={false}
            style={{ objectPosition: `${pos.x}% ${pos.y}%`, cursor: repositioning ? 'grab' : undefined }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        ) : (
          <div className="pj-cover-empty">
            {CATEGORY_CARD_ICON[project.category]}
          </div>
        )}
        {repositioning ? (
          <>
            <div className="projects-cover-reposition-hint">{t.projects.coverRepositionHint}</div>
            <div className="pj-cover-actions">
              <button className="pj-cover-btn" onClick={confirmReposition} title={t.projects.done}>
                <IconCheck size={14} />
              </button>
              <button className="pj-cover-btn danger" onClick={cancelReposition} title={t.projects.cancel}>
                <IconX size={14} />
              </button>
            </div>
          </>
        ) : (
          <div className="pj-cover-actions">
            {project.cover_image && (
              <button className="pj-cover-btn" onClick={startReposition} title={t.projects.coverReposition}>
                <IconArrowsMove size={14} />
              </button>
            )}
            <button className="pj-cover-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }} title={t.projects.edit}>
              <IconPencil size={14} />
            </button>
            <button className="pj-cover-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(); }} title={t.projects.delete}>
              <IconTrash size={14} />
            </button>
          </div>
        )}
      </div>
      <div className="pj-caption">
        <div className="pj-card-status">
          <span className={`pj-status status-${project.status}`}>
            <span className="pj-status-dot" />
            {statusLabel}
          </span>
          {dateText && <span className="pj-card-date">{dateText}</span>}
        </div>
        <h3 className="pj-card-title" title={project.title}>{project.title}</h3>
        {project.composer && <div className="pj-byline">{project.composer}</div>}
        {project.notes && <p className="pj-card-notes">{project.notes}</p>}
        {project.folders.length > 0 && <ProjectCardTags folders={project.folders} />}
      </div>
    </article>
  );
}

function ProjectCardTags({ folders }: { folders: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(folders.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const ruler = rulerRef.current;
    if (!container || !ruler) return;

    function recalc() {
      if (!container || !ruler) return;
      const chips = Array.from(ruler.querySelectorAll<HTMLElement>('[data-tag-chip]'));
      const moreEl = ruler.querySelector<HTMLElement>('[data-tag-more]');
      const containerWidth = container.clientWidth;
      const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
      const moreWidth = moreEl?.offsetWidth ?? 0;

      let total = 0;
      let count = 0;
      for (let i = 0; i < chips.length; i++) {
        const w = chips[i].offsetWidth;
        const isLast = i === chips.length - 1;
        const reserve = isLast ? 0 : moreWidth + gap;
        const next = total + (i > 0 ? gap : 0) + w;
        if (next + reserve <= containerWidth) {
          total = next;
          count = i + 1;
        } else break;
      }
      setVisibleCount(Math.max(count, 1));
    }

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(container);
    return () => ro.disconnect();
  }, [folders]);

  const hiddenCount = Math.max(folders.length - visibleCount, 0);

  return (
    <>
      <div className="pj-tags" ref={containerRef}>
        {folders.slice(0, visibleCount).map((f) => (
          <span key={f} className="pj-tag">{f}</span>
        ))}
        {hiddenCount > 0 && <span className="pj-tag pj-tag-more">+{hiddenCount}</span>}
      </div>
      {/* Off-screen ruler: measures true tag widths regardless of what's currently visible */}
      <div className="pj-tags pj-tags-ruler" ref={rulerRef} aria-hidden>
        {folders.map((f) => (
          <span key={f} data-tag-chip className="pj-tag">{f}</span>
        ))}
        <span data-tag-more className="pj-tag pj-tag-more">+{folders.length}</span>
      </div>
    </>
  );
}
