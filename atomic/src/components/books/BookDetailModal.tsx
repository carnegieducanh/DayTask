import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  IconX,
  IconBooks,
  IconChevronDown,
  IconCheck,
  IconTrash,
  IconPencil,
} from '@tabler/icons-react';
import type { Book, BookStatus } from '../../types';
import { useT } from '../../i18n';
import { formatISODate } from '../../utils/imageUtils';
import { useCoverGlow } from './bookUtils';

interface BookDetailModalProps {
  book: Book;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: BookStatus) => void;
}

export default function BookDetailModal({ book, onClose, onEdit, onDelete, onStatusChange }: BookDetailModalProps) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const glowStyle = useCoverGlow(book.cover_image);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notesOverflow, setNotesOverflow] = useState(false);
  const [notesCollapsedHeight, setNotesCollapsedHeight] = useState(0);
  const [notesExpandedHeight, setNotesExpandedHeight] = useState(0);
  const notesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6;
    const paddingV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const collapsed = lineHeight * 2 + paddingV;
    const full = el.scrollHeight;
    setNotesCollapsedHeight(collapsed);
    setNotesExpandedHeight(full);
    setNotesOverflow(full - collapsed > 1);
  }, [book.notes]);

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

  return createPortal(
    <div
      className="books-modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="bk-detail">
        <button ref={closeRef} className="bk-detail-close" onClick={onClose}>
          <IconX size={15} />
        </button>

        <div className="bk-detail-body">
          <div className="books-detail-cover" style={glowStyle}>
            <div className="books-detail-cover-inner">
              {book.cover_image ? (
                <img src={book.cover_image} alt={book.title} />
              ) : (
                <div className="books-card-cover-placeholder">
                  <IconBooks size={40} />
                </div>
              )}
            </div>
          </div>

          <div className="bk-detail-info">
            <div className="bk-detail-head">
              <h2 className="bk-detail-title">{book.title}</h2>
              {book.author && <span className="bk-byline">{book.author}</span>}
            </div>

            <div className="bk-detail-status-row">
              <div className="bk-status-dropdown" ref={statusMenuRef}>
                <button
                  type="button"
                  className={`bk-status-trigger status-${book.status}${statusMenuOpen ? ' open' : ''}`}
                  onClick={() => setStatusMenuOpen((v) => !v)}
                >
                  <span className="bk-status-dot" />
                  {statusLabel}
                  <IconChevronDown size={12} className="bk-status-chevron" />
                </button>
                {statusMenuOpen && (
                  <div className="bk-status-menu">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`bk-status-option status-${opt.id}${opt.id === book.status ? ' active' : ''}`}
                        onClick={() => handleStatusPick(opt.id)}
                      >
                        <span className="bk-status-dot" />
                        {opt.label}
                        {opt.id === book.status && <IconCheck size={13} className="bk-status-check" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {book.status === 'finished' && book.finished_date && (
                <span className="bk-detail-date">{formatISODate(book.finished_date)}</span>
              )}
            </div>

            {book.started_date && (
              <div className="bk-detail-date">{t.books.startedOn(formatISODate(book.started_date))}</div>
            )}

            {book.tags.length > 0 && (
              <div className="bk-detail-tags">
                {book.tags.map((tag) => (
                  <span key={tag} className="bk-tag">{tag}</span>
                ))}
              </div>
            )}

            {book.notes && (
              <div className="bk-detail-notes-wrap">
                <div
                  ref={notesRef}
                  className={`bk-detail-notes${notesOverflow ? ' has-fade' : ''}${notesExpanded ? ' expanded' : ''}`}
                  style={{ maxHeight: notesExpanded ? notesExpandedHeight : notesCollapsedHeight || undefined }}
                >
                  {book.notes}
                </div>
                {notesOverflow && (
                  <button
                    type="button"
                    className="bk-detail-notes-toggle"
                    onClick={() => setNotesExpanded((v) => !v)}
                  >
                    {notesExpanded ? t.books.seeLess : t.books.seeMore}
                    <IconChevronDown
                      size={12}
                      className={`bk-detail-notes-chevron${notesExpanded ? ' open' : ''}`}
                    />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bk-detail-foot">
          <div className="bk-detail-foot-group">
            <button className="bk-text-btn danger" onClick={onDelete}>
              <IconTrash size={14} />
              {t.books.delete}
            </button>
            <button className="bk-text-btn" onClick={onEdit}>
              <IconPencil size={14} />
              {t.books.edit}
            </button>
          </div>
          <button className="bk-btn-primary" onClick={onClose}>
            {t.books.done}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
