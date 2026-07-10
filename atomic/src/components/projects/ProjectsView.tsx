import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, useId } from 'react';
import { format } from 'date-fns';
import { useSmoothScroll, attachSmoothScroll } from '../../hooks/useSmoothScroll';
import ResizableTextarea from '../ResizableTextarea';
import {
  IconFolderCode,
  IconPlus,
  IconTrash,
  IconPencil,
  IconX,
  IconCheck,
  IconSearch,
  IconTag,
  IconChevronDown,
  IconCameraPlus,
  IconClockHour4,
  IconCircleCheck,
  IconBrandGithub,
  IconBrandYoutube,
  IconBrandFigma,
  IconFileMusic,
  IconVideo,
  IconExternalLink,
  IconStack2,
  IconArrowLeft,
  IconArrowsMove,
} from '@tabler/icons-react';
import type { Project, ProjectFolder, ProjectStatus, ProjectCategory, NewProject } from '../../types';
import {
  dbGetProjects,
  dbAddProject,
  dbUpdateProject,
  dbUpdateProjectCoverPosition,
  dbDeleteProject,
  dbGetProjectStats,
  dbGetYearsWithCounts,
  dbGetFolders,
  dbAddFolder,
  dbUpdateFolder,
  dbUpdateFolderCoverPosition,
  dbDeleteFolder,
  dbGetAllFolderNames,
  dbCreateFolderTag,
  dbRenameFolderName,
  dbDeleteFolderByName,
  seedProjectsIfEmpty,
  defaultFolderCover,
} from '../../store/projectsDb';
import { useT } from '../../i18n';

type StatusFilter = 'all' | ProjectStatus;
type SortBy = 'date' | 'title' | 'status';

function VsCodeLogoIcon({ size = 16 }: { size?: number }) {
  const uid = useId();
  const pathId = `${uid}-path`;
  const maskId = `${uid}-mask`;
  const gradId = `${uid}-grad`;
  return (
    <svg width={size} height={size * (254 / 256)} viewBox="0 0 256 254" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <path
          id={pathId}
          d="M180.82764,252.605272 C184.843951,254.170159 189.42406,254.069552 193.478224,252.11917 L245.979142,226.856851 C251.495593,224.202221 255.003889,218.618034 255.003889,212.49296 L255.003889,41.1971845 C255.003889,35.0719113 251.495593,29.4886211 245.979142,26.8339907 L193.478224,1.57068551 C188.158006,-0.989256713 181.931329,-0.362230036 177.262566,3.0323459 C176.595173,3.51727166 175.959655,4.05869672 175.363982,4.65536598 L74.8565893,96.3498444 L31.0778002,63.1181557 C27.0024197,60.0246398 21.3020866,60.2780499 17.5170718,63.7211005 L3.47578059,76.4937075 C-1.15402423,80.7052561 -1.15933349,87.9889043 3.46431538,92.2072265 L41.430759,126.844525 L3.46431538,161.482221 C-1.15933349,165.700742 -1.15402423,172.984291 3.47578059,177.19584 L17.5170718,189.967949 C21.3020866,193.411497 27.0024197,193.664509 31.0778002,190.571591 L74.8565893,157.339404 L175.363982,249.034221 C176.953772,250.625007 178.82048,251.823326 180.82764,252.605272 Z M191.291764,68.9559518 L115.029663,126.844525 L191.291764,184.733396 L191.291764,68.9559518 Z"
        />
        <linearGradient id={gradId} x1="50.0000484%" y1="-3.91645412e-07%" x2="50.0000484%" y2="99.999921%">
          <stop stopColor="#fff" offset="0%" />
          <stop stopColor="#fff" stopOpacity="0" offset="100%" />
        </linearGradient>
      </defs>
      <mask id={maskId} fill="white">
        <use href={`#${pathId}`} />
      </mask>
      <path
        d="M246.134784,26.873337 L193.593025,1.57523773 C187.51178,-1.35300582 180.243173,-0.117807811 175.469819,4.65514684 L3.46641717,161.482221 C-1.16004072,165.700742 -1.1547215,172.984291 3.47789235,177.19584 L17.5276804,189.967949 C21.3150858,193.411497 27.0189053,193.664509 31.0966765,190.571591 L238.228667,33.4363005 C245.177523,28.1646927 255.158535,33.1209324 255.158535,41.8432608 L255.158535,41.2332436 C255.158535,35.11066 251.651235,29.5293619 246.134784,26.873337 Z"
        fill="#0065A9"
        mask={`url(#${maskId})`}
      />
      <path
        d="M246.134784,226.816011 L193.593025,252.11419 C187.51178,255.041754 180.243173,253.806579 175.469819,249.034221 L3.46641717,92.2070273 C-1.16004072,87.9888047 -1.1547215,80.7049573 3.47789235,76.4935082 L17.5276804,63.7209012 C21.3150858,60.2778506 27.0189053,60.0243409 31.0966765,63.1179565 L238.228667,220.252649 C245.177523,225.524058 255.158535,220.568416 255.158535,211.84549 L255.158535,212.456104 C255.158535,218.57819 251.651235,224.159388 246.134784,226.816011 Z"
        fill="#007ACC"
        mask={`url(#${maskId})`}
      />
      <path
        d="M193.428324,252.134497 C187.345086,255.060069 180.076479,253.823898 175.303125,249.050544 C181.184153,254.931571 191.240868,250.765843 191.240868,242.448334 L191.240868,11.2729623 C191.240868,2.95542269 181.184153,-1.21005093 175.303125,4.67135981 C180.076479,-0.102038107 187.345086,-1.3389793 193.428324,1.58667934 L245.961117,26.8500144 C251.481553,29.5046448 254.991841,35.0879351 254.991841,41.2132082 L254.991841,212.509283 C254.991841,218.634357 251.481553,224.217548 245.961117,226.872178 L193.428324,252.134497 Z"
        fill="#1F9CF0"
        mask={`url(#${maskId})`}
      />
      <path
        d="M180.827889,252.605272 C184.8442,254.169163 189.424309,254.069552 193.477476,252.11917 L245.978395,226.855855 C251.495842,224.201225 255.004138,218.618034 255.004138,212.49296 L255.004138,41.1969853 C255.004138,35.0717121 251.495842,29.4884219 245.979391,26.8337915 L193.477476,1.57052613 C188.158255,-0.989423064 181.931578,-0.362396387 177.261819,3.03217656 C176.595422,3.51710232 175.959904,4.05852738 175.363235,4.65519664 L74.8565395,96.3496452 L31.0777504,63.1179565 C27.0024695,60.0244405 21.3020368,60.2779503 17.517022,63.7209012 L3.4757806,76.4935082 C-1.15402423,80.7050569 -1.15933349,87.9888047 3.46431539,92.2071269 L41.4308088,126.844525 L3.46431539,161.482221 C-1.15933349,165.700742 -1.15402423,172.984291 3.4757806,177.19584 L17.517022,189.967949 C21.3020368,193.411497 27.0024695,193.664509 31.0777504,190.571591 L74.8565395,157.339404 L175.363235,249.034221 C176.953025,250.625007 178.820729,251.823326 180.827889,252.605272 Z M191.292013,68.9557526 L115.029912,126.844525 L191.292013,184.733396 L191.292013,68.9557526 Z"
        fillOpacity="0.25"
        fill={`url(#${gradId})`}
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

function FigmaLogoIcon({ size = 16 }: { size?: number }) {
  const width = size * (256 / 384);
  return (
    <svg width={width} height={size} viewBox="0 0 256 384" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M64,384 C99.328,384 128,355.328 128,320 L128,256 L64,256 C28.672,256 0,284.672 0,320 C0,355.328 28.672,384 64,384 Z" fill="#0ACF83" />
      <path d="M0,192 C0,156.672 28.672,128 64,128 L128,128 L128,256 L64,256 C28.672,256 0,227.328 0,192 Z" fill="#A259FF" />
      <path d="M0,64 C0,28.672 28.672,0 64,0 L128,0 L128,128 L64,128 C28.672,128 0,99.328 0,64 Z" fill="#F24E1E" />
      <path d="M128,0 L192,0 C227.328,0 256,28.672 256,64 C256,99.328 227.328,128 192,128 L128,128 L128,0 Z" fill="#FF7262" />
      <path d="M256,192 C256,227.328 227.328,256 192,256 C156.672,256 128,227.328 128,192 C128,156.672 156.672,128 192,128 C227.328,128 256,156.672 256,192 Z" fill="#1ABCFE" />
    </svg>
  );
}

function PianoKeysIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#31373D" d="M2 36s-2 0-2-2V2s0-2 2-2h32.031C36 0 36 2 36 2v32s0 2-2 2H2z" />
      <path fill="#E1E8ED" d="M19 33s0 1 1 1h5c1 0 1-1 1-1V5h-7v28zm9-28v28s0 1 1 1h4c1 0 1-1 1-1V5h-6zM10 33s0 1 1 1h5c1 0 1-1 1-1V5h-7v28zm-8 0s0 1 1 1h4c1 0 1-1 1-1V5H2v28z" />
      <path fill="#31373D" d="M30 23s0 1-1 1h-4c-1 0-1-1-1-1V3h6v20zm-9 0s0 1-1 1h-4c-1 0-1-1-1-1V3h6v20zm-9 0s0 1-1 1H7c-1 0-1-1-1-1V3h6v20z" />
    </svg>
  );
}

const CATEGORY_TAB_ICON: Record<ProjectCategory, React.ReactNode> = {
  product: <VsCodeLogoIcon size={15} />,
  figma: <FigmaLogoIcon size={15} />,
  piano: <PianoKeysIcon size={15} />,
};

const CATEGORY_CARD_ICON: Record<ProjectCategory, React.ReactNode> = {
  product: <VsCodeLogoIcon size={26} />,
  figma: <FigmaLogoIcon size={26} />,
  piano: <PianoKeysIcon size={26} />,
};

const CATEGORY_LINK_ICON: Record<ProjectCategory, { primary: React.ReactNode; secondary: React.ReactNode }> = {
  product: { primary: <IconBrandGithub size={14} />, secondary: <IconBrandYoutube size={14} /> },
  figma: { primary: <IconBrandFigma size={14} />, secondary: <IconExternalLink size={14} /> },
  piano: { primary: <IconFileMusic size={14} />, secondary: <IconVideo size={14} /> },
};

const MAX_COVER_DIM = 640;
const COVER_JPEG_QUALITY = 0.82;
const YEAR_LIST_VISIBLE = 3;

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

function clampPercent(v: number): number {
  return Math.min(100, Math.max(0, v));
}

function parseCoverPosition(pos: string | null): { x: number; y: number } {
  const m = pos?.match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  if (!m) return { x: 50, y: 50 };
  return { x: clampPercent(parseFloat(m[1])), y: clampPercent(parseFloat(m[2])) };
}

// ── FolderCard ───────────────────────────────────────────────────────────────

function FolderCard({
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

// ── AddFolderModal ───────────────────────────────────────────────────────────

interface AddFolderModalProps {
  category: ProjectCategory;
  onSave: (name: string, coverImage: string | null, coverPosition: string | null) => Promise<void>;
  onClose: () => void;
  initialFolder?: ProjectFolder;
}

function AddFolderModal({ category, onSave, onClose, initialFolder }: AddFolderModalProps) {
  const t = useT();
  const copy = t.projects.categoryCopy[category];
  const isEdit = !!initialFolder;
  const [name, setName] = useState(initialFolder?.name ?? '');
  const [coverImage, setCoverImage] = useState<string | null>(initialFolder?.cover_image ?? null);
  const [coverPos, setCoverPos] = useState(() => parseCoverPosition(initialFolder?.cover_position ?? null));
  const [repositioningCover, setRepositioningCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverPreviewRef = useRef<HTMLButtonElement>(null);
  const coverImgRef = useRef<HTMLImageElement>(null);
  const coverDragStateRef = useRef<{ startX: number; startY: number; fromX: number; fromY: number; overflowX: number; overflowY: number } | null>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  async function applyCoverFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    try {
      setCoverImage(await compressCoverImage(file));
      setCoverPos({ x: 50, y: 50 });
      setRepositioningCover(false);
    } catch {
      // ignore unreadable image
    }
  }

  function removeCover() {
    setCoverImage(null);
    setCoverPos({ x: 50, y: 50 });
    setRepositioningCover(false);
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
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), coverImage, coverImage ? `${coverPos.x.toFixed(1)}% ${coverPos.y.toFixed(1)}%` : null);
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
            <button
              type="button"
              ref={coverPreviewRef}
              className="projects-folder-cover-picker"
              onClick={() => { if (!repositioningCover) fileInputRef.current?.click(); }}
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
                  <span>{dragOver ? t.projects.coverDrop : t.projects.coverUpload}</span>
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
                  <button type="button" className="books-cover-action-btn" onClick={() => fileInputRef.current?.click()}>
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

          <label className="books-modal-label">{t.projects.folderNameLabel}</label>
          <input
            ref={nameRef}
            className="books-modal-input"
            placeholder={copy.folderNamePlaceholder}
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
    ? t.projects.inProgressSince(formatISODate(project.start_date))
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
    <div className={`projects-card${repositioning ? ' is-repositioning' : ''}`} onClick={onView}>
      <div className="projects-card-cover" ref={coverRef} onClick={handleCoverClick}>
        {project.cover_image ? (
          <img
            ref={imgRef}
            src={project.cover_image}
            alt={project.title}
            draggable={false}
            style={{ objectPosition: `${pos.x}% ${pos.y}%`, cursor: repositioning ? 'grab' : undefined }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        ) : (
          <div className="projects-folder-cover-placeholder">
            {CATEGORY_CARD_ICON[project.category]}
          </div>
        )}
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
            {project.cover_image && (
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
      <div className="projects-card-body">
        <div className="projects-card-head">
          <span className={`projects-status-badge status-${project.status}`}>
            {STATUS_ICON[project.status]}
            {statusLabel}
          </span>
          {dateText && <span className="projects-card-date">{dateText}</span>}
        </div>
        <div className="projects-card-title" title={project.title}>{project.title}</div>
        {project.composer && <div className="projects-card-composer">{project.composer}</div>}
        {project.notes && <div className="projects-card-notes">{project.notes}</div>}
        {project.folders.length > 0 && <ProjectCardTags folders={project.folders} />}
      </div>
    </div>
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
      const gap = 4;
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
      <div className="projects-card-tags" ref={containerRef}>
        {folders.slice(0, visibleCount).map((f) => (
          <span key={f} className="books-tag-chip-sm">{f}</span>
        ))}
        {hiddenCount > 0 && <span className="books-tag-chip-sm projects-card-tag-more">+{hiddenCount}</span>}
      </div>
      {/* Off-screen ruler: measures true chip widths regardless of what's currently visible */}
      <div className="projects-card-tags-ruler" ref={rulerRef} aria-hidden>
        {folders.map((f) => (
          <span key={f} data-tag-chip className="books-tag-chip-sm">{f}</span>
        ))}
        <span data-tag-more className="books-tag-chip-sm projects-card-tag-more">+{folders.length}</span>
      </div>
    </>
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

// ── AddProjectModal ──────────────────────────────────────────────────────────

interface AddProjectModalProps {
  category: ProjectCategory;
  onSave: (data: NewProject, coverPosition: string | null) => Promise<void>;
  onClose: () => void;
  initialProject?: Project;
  initialFolders?: string[];
  onFolderDeleted: (name: string, category: ProjectCategory, undo: () => void) => void;
}

function AddProjectModal({ category, onSave, onClose, initialProject, initialFolders, onFolderDeleted }: AddProjectModalProps) {
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
      setCoverImage(await compressCoverImage(file));
      setCoverPos({ x: 50, y: 50 });
      setRepositioningCover(false);
    } catch {
      // ignore unreadable image
    }
  }

  function removeCover() {
    setCoverImage(null);
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
      folders,
    }, coverImage ? `${coverPos.x.toFixed(1)}% ${coverPos.y.toFixed(1)}%` : null);
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

// ── ProjectsView ─────────────────────────────────────────────────────────────

export default function ProjectsView() {
  const t = useT();

  const [category, setCategory] = useState<ProjectCategory>('product');
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [openFolder, setOpenFolder] = useState<ProjectFolder | null>(null);
  const [viewAllProjects, setViewAllProjects] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [yearFilter, setYearFilter] = useState<number | null>(new Date().getFullYear());
  const [tagSearch, setTagSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [years, setYears] = useState<{ year: number; count: number }[]>([]);
  const [yearListExpanded, setYearListExpanded] = useState(false);
  const [yearListCollapsedHeight, setYearListCollapsedHeight] = useState<number | undefined>(undefined);
  const [yearListFullHeight, setYearListFullHeight] = useState<number | undefined>(undefined);
  const [stats, setStats] = useState({ total: 0, inProgress: 0, completed: 0 });
  const [yearStats, setYearStats] = useState({ total: 0, inProgress: 0, completed: 0 });
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ProjectFolder | null>(null);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<ProjectFolder | null>(null);
  const [pendingDeleteFolderTag, setPendingDeleteFolderTag] = useState<{ name: string; category: ProjectCategory; undo: () => void } | null>(null);
  const [seeded, setSeeded] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const yearListRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteProjectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteFolderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteFolderTagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seedStartedRef = useRef(false);
  const titleRowRef = useRef<HTMLDivElement>(null);
  const titleTabLabelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [titleIndicatorStyle, setTitleIndicatorStyle] = useState<{ left: number; top: number; width: number } | null>(null);

  useSmoothScroll(mainRef);
  useSmoothScroll(sidebarRef);

  const loadStats = useCallback(async (cat: ProjectCategory) => {
    setStats(await dbGetProjectStats(cat));
  }, []);

  const loadYearStats = useCallback(async (cat: ProjectCategory, year: number | null) => {
    setYearStats(await dbGetProjectStats(cat, year ?? undefined));
  }, []);

  const loadYears = useCallback(async (cat: ProjectCategory, status: StatusFilter) => {
    setYears(await dbGetYearsWithCounts(cat, status === 'all' ? undefined : status));
  }, []);

  const loadFolders = useCallback(async (cat: ProjectCategory, status: StatusFilter, year: number | null) => {
    setFolders(await dbGetFolders({ category: cat, status: status === 'all' ? undefined : status, year: year ?? undefined }));
  }, []);

  const loadProjects = useCallback(async (
    cat: ProjectCategory,
    folderName: string,
    status: StatusFilter,
    year: number | null,
    search: string
  ) => {
    setProjects(await dbGetProjects({
      category: cat,
      folder: folderName,
      status: status === 'all' ? undefined : status,
      year: year ?? undefined,
      search,
    }));
  }, []);

  useEffect(() => {
    if (seedStartedRef.current) return;
    seedStartedRef.current = true;
    seedProjectsIfEmpty().then(() => setSeeded(true));
  }, []);

  useEffect(() => {
    if (!seeded) return;
    loadStats(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, category]);

  useEffect(() => {
    if (!seeded) return;
    loadYearStats(category, yearFilter);
    loadYears(category, statusFilter);
    loadFolders(category, statusFilter, yearFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, category, statusFilter, yearFilter]);

  useEffect(() => {
    if (!seeded || (!openFolder && !viewAllProjects)) return;
    loadProjects(category, openFolder ? openFolder.name : '', statusFilter, yearFilter, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, category, openFolder, viewAllProjects, statusFilter, yearFilter]);

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (openFolder || viewAllProjects) loadProjects(category, openFolder ? openFolder.name : '', statusFilter, yearFilter, q);
    }, 300);
  }

  function handleOpenFolder(folder: ProjectFolder) {
    if (openFolder?.id === folder.id) {
      handleBack();
      return;
    }
    setOpenFolder(folder);
    setViewAllProjects(false);
    setSearchQuery('');
  }

  function handleShowAllProjects() {
    setViewAllProjects(true);
    setSearchQuery('');
  }

  function handleBack() {
    setOpenFolder(null);
    setViewAllProjects(false);
    setProjects([]);
    setSearchQuery('');
  }

  function handleCategoryChange(next: ProjectCategory) {
    if (next === category) return;
    setCategory(next);
    setOpenFolder(null);
    setViewAllProjects(false);
    setProjects([]);
    setStatusFilter('all');
    setYearFilter(new Date().getFullYear());
    setSearchQuery('');
    setTagSearch('');
  }

  async function refreshAll() {
    await Promise.all([
      loadStats(category),
      loadYearStats(category, yearFilter),
      loadYears(category, statusFilter),
      loadFolders(category, statusFilter, yearFilter),
      (openFolder || viewAllProjects) ? loadProjects(category, openFolder ? openFolder.name : '', statusFilter, yearFilter, searchQuery) : Promise.resolve(),
    ]);
  }

  async function handleSaveFolder(name: string, coverImage: string | null, coverPosition: string | null) {
    if (editingFolder) {
      await dbUpdateFolder(editingFolder.id, name, coverImage, coverPosition);
      setEditingFolder(null);
      if (openFolder && openFolder.id === editingFolder.id) {
        setOpenFolder({ ...openFolder, name, cover_image: coverImage, cover_position: coverPosition });
      }
    } else {
      await dbAddFolder(name, coverImage, category, coverPosition);
      setShowAddFolderModal(false);
    }
    await loadFolders(category, statusFilter, yearFilter);
  }

  async function handleRepositionFolderCover(folder: ProjectFolder, position: string) {
    await dbUpdateFolderCoverPosition(folder.id, position);
    setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, cover_position: position } : f)));
  }

  async function commitDeleteFolder(folder: ProjectFolder) {
    await dbDeleteFolder(folder.id);
    setPendingDeleteFolder(null);
    await Promise.all([loadStats(category), loadYearStats(category, yearFilter), loadYears(category, statusFilter)]);
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
    loadFolders(category, statusFilter, yearFilter);
    setPendingDeleteFolder(null);
  }

  async function handleAddProject(data: NewProject, coverPosition: string | null) {
    const p = await dbAddProject(data);
    if (p) {
      if (coverPosition) await dbUpdateProjectCoverPosition(p.id, coverPosition);
      setShowAddProjectModal(false);
      await refreshAll();
    }
  }

  async function handleUpdateProject(data: NewProject, coverPosition: string | null) {
    if (!editingProject) return;
    await dbUpdateProject(editingProject.id, data);
    await dbUpdateProjectCoverPosition(editingProject.id, coverPosition);
    setEditingProject(null);
    await refreshAll();
  }

  async function handleRepositionCover(project: Project, position: string) {
    await dbUpdateProjectCoverPosition(project.id, position);
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, cover_position: position } : p)));
    setViewingProject((prev) => (prev && prev.id === project.id ? { ...prev, cover_position: position } : prev));
  }

  async function handleQuickStatusChange(project: Project, status: ProjectStatus) {
    const completed_date = status === 'completed' ? project.completed_date ?? format(new Date(), 'yyyy-MM-dd') : null;
    await dbUpdateProject(project.id, {
      title: project.title,
      category: project.category,
      status,
      start_date: project.start_date,
      completed_date,
      notes: project.notes ?? undefined,
      link_repo: project.link_repo ?? undefined,
      link_youtube: project.link_youtube ?? undefined,
      composer: project.composer ?? undefined,
      cover_image: project.cover_image,
      folders: project.folders,
    });
    setViewingProject((prev) => (prev && prev.id === project.id ? { ...prev, status, completed_date } : prev));
    await refreshAll();
  }

  async function commitDeleteProject(project: Project) {
    await dbDeleteProject(project.id);
    await Promise.all([loadStats(category), loadYearStats(category, yearFilter), loadYears(category, statusFilter), loadFolders(category, statusFilter, yearFilter)]);
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
    if (!pendingDeleteProject || (!openFolder && !viewAllProjects)) return;
    loadProjects(category, openFolder ? openFolder.name : '', statusFilter, yearFilter, searchQuery);
    setPendingDeleteProject(null);
  }

  async function commitDeleteFolderTag(name: string, cat: ProjectCategory) {
    await dbDeleteFolderByName(name, cat);
    setPendingDeleteFolderTag(null);
    await loadFolders(category, statusFilter, yearFilter);
  }

  function handleFolderTagDeleted(name: string, cat: ProjectCategory, undo: () => void) {
    if (deleteFolderTagTimerRef.current) clearTimeout(deleteFolderTagTimerRef.current);
    if (pendingDeleteFolderTag) commitDeleteFolderTag(pendingDeleteFolderTag.name, pendingDeleteFolderTag.category);

    setPendingDeleteFolderTag({ name, category: cat, undo });
    deleteFolderTagTimerRef.current = setTimeout(() => commitDeleteFolderTag(name, cat), 4000);
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

  useLayoutEffect(() => {
    const el = yearListRef.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const full = el.scrollHeight;
    const collapsed = items.length > YEAR_LIST_VISIBLE
      ? items[YEAR_LIST_VISIBLE - 1].offsetTop + items[YEAR_LIST_VISIBLE - 1].offsetHeight
      : full;
    setYearListFullHeight(full);
    setYearListCollapsedHeight(collapsed);
  }, [years]);

  useEffect(() => {
    setYearListExpanded(false);
  }, [category, statusFilter]);

  const copy = t.projects.categoryCopy[category];

  useLayoutEffect(() => {
    const row = titleRowRef.current;
    const label = titleTabLabelRefs.current[viewAllProjects ? 1 : 0];
    if (!row || !label) return;
    const rowRect = row.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    setTitleIndicatorStyle({ left: labelRect.left - rowRect.left, top: labelRect.bottom - rowRect.top - 2, width: labelRect.width });
  }, [viewAllProjects, copy.pageTitle, t.projects.viewAll]);

  const sortedProjects = useMemo(() => sortProjects(projects, sortBy), [projects, sortBy]);

  const isFiltering = statusFilter !== 'all' || yearFilter !== null;

  const visibleFolders = useMemo(
    () => (isFiltering ? folders.filter((f) => f.project_count > 0) : folders),
    [folders, isFiltering]
  );

  // Danh sách tag luôn đầy đủ, không ẩn theo status/year filter — chỉ số đếm
  // (project_count) trên mỗi tag thay đổi theo filter đang chọn. Thứ tự cố định
  // theo lúc tạo (id tăng dần), không đổi theo last_activity như lưới folder chính.
  const filteredTagFolders = useMemo(
    () =>
      folders
        .filter((f) => !tagSearch || f.name.toLowerCase().includes(tagSearch.toLowerCase()))
        .sort((a, b) => a.id - b.id),
    [folders, tagSearch]
  );

  const headerSubText = useMemo(() => {
    if (statusFilter === 'in_progress') return copy.totalCount(yearStats.inProgress);
    if (statusFilter === 'completed') return copy.totalCount(yearStats.completed);
    return copy.totalCount(yearStats.total);
  }, [yearStats, copy, statusFilter]);

  const emptyProjectsText = searchQuery ? copy.emptySearch : (viewAllProjects ? copy.emptyAll : copy.emptyItems);

  return (
    <>
      <div className="projects-category-tabs">
        {(['product', 'figma', 'piano'] as ProjectCategory[]).map((cat) => (
          <button
            key={cat}
            className={`projects-category-tab${category === cat ? ' active' : ''}`}
            onClick={() => handleCategoryChange(cat)}
          >
            {CATEGORY_TAB_ICON[cat]}
            {t.projects.categoryLabels[cat]}
          </button>
        ))}
      </div>
      <div className="books-wrap">
      {/* ── Sidebar ── */}
      <div ref={sidebarRef} className="books-sidebar projects-sidebar">
        <div key={`status-${category}`} className="books-sb-section projects-sidebar-anim">
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
            {copy.statusInProgress}
            <span className="books-sb-count">{stats.inProgress}</span>
          </button>
          <button
            className={`books-sb-item${statusFilter === 'completed' ? ' active' : ''}`}
            onClick={() => handleStatusFilter('completed')}
          >
            <IconCircleCheck size={14} />
            {copy.statusCompleted}
            <span className="books-sb-count">{stats.completed}</span>
          </button>
        </div>

        {years.length > 0 && (
          <div className="books-sb-section">
            <div className="books-sb-label">{t.projects.byYear}</div>
            <div
              key={`years-${category}`}
              ref={yearListRef}
              className={`projects-year-list${years.length > YEAR_LIST_VISIBLE ? ' collapsible' : ''}${yearListExpanded ? ' expanded' : ''}`}
              style={{ maxHeight: yearListExpanded ? yearListFullHeight : (yearListCollapsedHeight ?? yearListFullHeight) }}
            >
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
            {years.length > YEAR_LIST_VISIBLE && (
              <button
                type="button"
                className="projects-year-list-toggle"
                onClick={() => setYearListExpanded((v) => !v)}
              >
                {yearListExpanded ? t.projects.seeLess : t.projects.seeMore}
                <IconChevronDown size={12} className={`projects-year-list-chevron${yearListExpanded ? ' open' : ''}`} />
              </button>
            )}
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
            <div key={`tags-${category}`} className="projects-tag-list-anim">
              <div className="books-sb-tag-list">
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
          </div>
        )}
      </div>

      {/* ── Main ── */}
      <div ref={mainRef} className="books-main projects-main">
        {!openFolder ? (
          <>
            <div className="books-header">
              <div>
                <div className="projects-title-row" ref={titleRowRef}>
                  <button
                    type="button"
                    className={`projects-title-tab${!viewAllProjects ? ' active' : ''}`}
                    onClick={() => setViewAllProjects(false)}
                  >
                    <span className="projects-title-tab-label" ref={(el) => { titleTabLabelRefs.current[0] = el; }}>{copy.pageTitle}</span>
                  </button>
                  <button
                    type="button"
                    className={`projects-title-tab${viewAllProjects ? ' active' : ''}`}
                    onClick={handleShowAllProjects}
                  >
                    <span className="projects-title-tab-label" ref={(el) => { titleTabLabelRefs.current[1] = el; }}>{t.projects.viewAll}</span>
                  </button>
                  {titleIndicatorStyle && (
                    <span
                      className="projects-title-indicator"
                      style={{
                        transform: `translate(${titleIndicatorStyle.left}px, ${titleIndicatorStyle.top}px)`,
                        width: titleIndicatorStyle.width,
                      }}
                    />
                  )}
                </div>
                <div className="books-header-sub">{viewAllProjects ? copy.totalCount(projects.length) : headerSubText}</div>
              </div>
              {viewAllProjects ? (
                <button className="books-btn-add" onClick={() => setShowAddProjectModal(true)}>
                  <IconPlus size={13} />
                  {copy.addItem}
                </button>
              ) : (
                <button className="books-btn-add" onClick={() => setShowAddFolderModal(true)}>
                  <IconPlus size={13} />
                  {t.projects.addFolder}
                </button>
              )}
            </div>

            {!viewAllProjects ? (
              <div key={`${category}-${statusFilter}-${yearFilter ?? ''}`} className="books-content-view">
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
                        onRepositionCover={(position) => handleRepositionFolderCover(folder, position)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="books-toolbar">
                  <div className="books-search-wrap">
                    <IconSearch size={13} className="books-search-icon" />
                    <input
                      className="books-search-input"
                      placeholder={copy.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      spellCheck={false}
                    />
                    {searchQuery && (
                      <button
                        className="books-search-clear"
                        onClick={() => { setSearchQuery(''); loadProjects(category, '', statusFilter, yearFilter, ''); }}
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

                <div key={`all-${statusFilter}-${yearFilter ?? ''}`} className="books-content-view">
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
                          onRepositionCover={(position) => handleRepositionCover(project, position)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="books-header">
              <div className="projects-header-title-group">
                <button className="icon-btn" onClick={handleBack} title={t.projects.back}>
                  <IconArrowLeft size={16} />
                </button>
                <div>
                  <div className="books-header-title">{openFolder.name}</div>
                  <div className="books-header-sub">{copy.folderCount(projects.length)}</div>
                </div>
              </div>
              <div className="books-header-actions">
                <button className="books-btn-add" onClick={() => setShowAddProjectModal(true)}>
                  <IconPlus size={13} />
                  {copy.addItem}
                </button>
              </div>
            </div>

            <div className="books-toolbar">
              <div className="books-search-wrap">
                <IconSearch size={13} className="books-search-icon" />
                <input
                  className="books-search-input"
                  placeholder={copy.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  spellCheck={false}
                />
                {searchQuery && (
                  <button
                    className="books-search-clear"
                    onClick={() => { setSearchQuery(''); loadProjects(category, openFolder.name, statusFilter, yearFilter, ''); }}
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
                      onRepositionCover={(position) => handleRepositionCover(project, position)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showAddFolderModal && (
        <AddFolderModal category={category} onSave={handleSaveFolder} onClose={() => setShowAddFolderModal(false)} />
      )}

      {editingFolder && (
        <AddFolderModal category={editingFolder.category} onSave={handleSaveFolder} onClose={() => setEditingFolder(null)} initialFolder={editingFolder} />
      )}

      {showAddProjectModal && (
        <AddProjectModal
          category={category}
          onSave={handleAddProject}
          onClose={() => setShowAddProjectModal(false)}
          initialFolders={openFolder ? [openFolder.name] : undefined}
          onFolderDeleted={handleFolderTagDeleted}
        />
      )}

      {editingProject && (
        <AddProjectModal
          category={editingProject.category}
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
    </>
  );
}
