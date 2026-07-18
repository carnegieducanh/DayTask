import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  IconX,
  IconBooks,
  IconRosetteDiscountCheckFilled,
  IconChevronDown,
  IconCheck,
  IconTrash,
  IconPencil,
  IconBook2,
  IconCircleCheck,
  IconBookmark,
} from '@tabler/icons-react';
import type { Book, BookStatus } from '../../types';
import { useT } from '../../i18n';
import { formatISODate } from '../../utils/imageUtils';
import { useCoverGlow } from './bookUtils';

const STATUS_ICON: Record<BookStatus, React.ReactNode> = {
  reading: <IconBook2 size={13} />,
  finished: <IconCircleCheck size={13} />,
  want_to_read: <IconBookmark size={13} />,
};

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

  return (
    <div
      className="books-modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="books-detail-modal">
        <button ref={closeRef} className="books-detail-close" onClick={onClose}>
          <IconX size={16} />
        </button>

        <div className="books-detail-body">
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

          <div className="books-detail-info">
            <div className="books-detail-title">{book.title}</div>
            {book.author && (
              <div className="books-detail-author">
                <span className="books-detail-author-name">{book.author}</span>
                <IconRosetteDiscountCheckFilled size={16} className="books-detail-author-badge" />
              </div>
            )}

            {book.started_date && (
              <div className="books-detail-meta">
                {t.books.startedOn(formatISODate(book.started_date))}
              </div>
            )}

            <div className="books-detail-badges">
              <div className="books-detail-status-dropdown" ref={statusMenuRef}>
                <button
                  type="button"
                  className={`books-detail-status-badge status-${book.status}${statusMenuOpen ? ' open' : ''}`}
                  onClick={() => setStatusMenuOpen((v) => !v)}
                >
                  {STATUS_ICON[book.status]}
                  {statusLabel}
                  <IconChevronDown size={12} className={`books-detail-status-chevron${statusMenuOpen ? ' open' : ''}`} />
                </button>
                {statusMenuOpen && (
                  <div className="books-detail-status-menu">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`books-detail-status-option${opt.id === book.status ? ' active' : ''}`}
                        onClick={() => handleStatusPick(opt.id)}
                      >
                        {STATUS_ICON[opt.id]}
                        {opt.label}
                        {opt.id === book.status && <IconCheck size={12} className="books-detail-status-check" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {book.status === 'finished' && book.finished_date && (
                <span className="books-detail-date">{formatISODate(book.finished_date)}</span>
              )}
            </div>

            {book.tags.length > 0 && (
              <div className="books-detail-tags">
                {book.tags.map((tag) => (
                  <span key={tag} className="books-tag-chip-sm">{tag}</span>
                ))}
              </div>
            )}

            {book.notes && (
              <div className="books-detail-notes-wrap">
                <div
                  ref={notesRef}
                  className={`books-detail-notes${notesOverflow ? ' has-fade' : ''}${notesExpanded ? ' expanded' : ''}`}
                  style={{ maxHeight: notesExpanded ? notesExpandedHeight : notesCollapsedHeight || undefined }}
                >
                  {book.notes}
                </div>
                {notesOverflow && (
                  <button
                    type="button"
                    className="books-detail-notes-toggle"
                    onClick={() => setNotesExpanded((v) => !v)}
                  >
                    {notesExpanded ? t.books.seeLess : t.books.seeMore}
                    <IconChevronDown
                      size={12}
                      className={`books-detail-notes-chevron${notesExpanded ? ' open' : ''}`}
                    />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="books-modal-footer books-detail-footer">
          <div className="books-modal-footer-group">
            <button className="books-modal-btn-cancel books-detail-delete" onClick={onDelete}>
              {t.books.delete}
              <IconTrash size={13} />
            </button>
            <button className="books-modal-btn-cancel" onClick={onEdit}>
              {t.books.edit}
              <IconPencil size={13} />
            </button>
          </div>
          <button className="books-modal-btn-save" onClick={onClose}>
            {t.books.done}
          </button>
        </div>
      </div>
    </div>
  );
}
