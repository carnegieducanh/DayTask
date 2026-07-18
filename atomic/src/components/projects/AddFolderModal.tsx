import { useState, useEffect, useRef } from 'react';
import { IconX, IconCameraPlus, IconArrowsMove } from '@tabler/icons-react';
import type { ProjectFolder, ProjectCategory } from '../../types';
import { useT } from '../../i18n';
import { compressCoverImage, clampPercent, parseCoverPosition } from './projectImageUtils';

interface AddFolderModalProps {
  category: ProjectCategory;
  onSave: (name: string, coverImage: string | null, coverPosition: string | null) => Promise<void>;
  onClose: () => void;
  initialFolder?: ProjectFolder;
}

export default function AddFolderModal({ category, onSave, onClose, initialFolder }: AddFolderModalProps) {
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

  return (
    <div className="books-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown} onPaste={handlePaste}>
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
