import { IconBooks, IconPencil, IconTrash, IconRosetteDiscountCheckFilled } from '@tabler/icons-react';
import type { Book } from '../../types';
import { useCoverGlow } from './bookUtils';

export default function BookCard({
  book, onView, onEdit, onDelete,
}: {
  book: Book; onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const glowStyle = useCoverGlow(book.cover_image);
  return (
    <div className="books-card" onClick={onView}>
      <div className="books-card-cover" style={glowStyle}>
        <div className="books-card-cover-inner">
          {book.cover_image ? (
            <img src={book.cover_image} alt={book.title} />
          ) : (
            <div className="books-card-cover-placeholder">
              <IconBooks size={28} />
            </div>
          )}
        </div>
        <div className="books-card-actions">
          <button className="books-card-action-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <IconPencil size={13} />
          </button>
          <button className="books-card-action-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <IconTrash size={13} />
          </button>
        </div>
      </div>
      <div className="books-card-title" title={book.title}>{book.title}</div>
      {book.author && (
        <div className="books-card-author" title={book.author}>
          <span className="books-card-author-name">{book.author}</span>
          <IconRosetteDiscountCheckFilled size={14} className="books-card-author-badge" />
        </div>
      )}
      {book.tags.length > 0 && (
        <div className="books-card-tags">
          <span className="books-tag-chip-sm">{book.tags[0]}</span>
          {book.tags.length > 1 && (
            <span className="books-tag-chip-sm books-tag-chip-more">+{book.tags.length - 1} more</span>
          )}
        </div>
      )}
    </div>
  );
}
