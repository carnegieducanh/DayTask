import { IconBooks, IconPencil, IconTrash } from '@tabler/icons-react';
import type { Book } from '../../types';
import { useT } from '../../i18n';
import { useCoverGlow } from './bookUtils';

export default function BookCard({
  book, onView, onEdit, onDelete,
}: {
  book: Book; onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const t = useT();
  const glowStyle = useCoverGlow(book.cover_image);
  return (
    <article className="bk-book" onClick={onView}>
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
        <div className="bk-book-actions">
          <button className="bk-cover-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }} title={t.books.edit}>
            <IconPencil size={13} />
          </button>
          <button className="bk-cover-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(); }} title={t.books.delete}>
            <IconTrash size={13} />
          </button>
        </div>
      </div>
      <div className="bk-book-caption">
        <h3 className="bk-book-title" title={book.title}>{book.title}</h3>
        {book.author && <div className="bk-book-author" title={book.author}>{book.author}</div>}
        {book.tags.length > 0 && (
          <div className="bk-book-tags">
            <span className="bk-tag">{book.tags[0]}</span>
            {book.tags.length > 1 && <span className="bk-tag-more">+{book.tags.length - 1}</span>}
          </div>
        )}
      </div>
    </article>
  );
}
