import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './books.css';
import { format } from 'date-fns';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import {
  IconBooks,
  IconBook2,
  IconBookmark,
  IconStack2,
  IconPlus,
  IconPencil,
  IconX,
  IconCheck,
  IconCircleCheck,
  IconSearch,
  IconTarget,
  IconTrophy,
} from '@tabler/icons-react';
import type { Book, BookStatus, NewBook } from '../../types';
import {
  dbGetBooks,
  dbAddBook,
  dbUpdateBook,
  dbDeleteBook,
  dbGetYearsWithCounts,
  dbGetBookStats,
  dbGetTagCounts,
  dbDeleteBookTag,
  dbGetReadingGoal,
  dbSetReadingGoal,
  seedBooksIfEmpty,
} from '../../store/booksDb';
import { useT } from '../../i18n';
import { sortBooks, bookSortKey, type SortBy } from './bookUtils';
import BookCard from './BookCard';
import BookDetailModal from './BookDetailModal';
import AddBookModal from './AddBookModal';

type LibraryFilter = 'all' | BookStatus;

const BOOKS_PAGE_SIZE = 60;

export default function BooksView() {
  const t = useT();
  const currentYear = new Date().getFullYear();

  const [books, setBooks] = useState<Book[]>([]);
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('finished');
  const [yearFilter, setYearFilter] = useState<number | null>(currentYear);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [years, setYears] = useState<
    { year: number; total: number; finished: number; reading: number; wantToRead: number }[]
  >([]);
  const [tagCounts, setTagCounts] = useState<{ tag: string; count: number }[]>([]);
  const [stats, setStats] = useState({ total: 0, finished: 0, reading: 0, wantToRead: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [viewingBook, setViewingBook] = useState<Book | null>(null);
  const [pendingDeleteBook, setPendingDeleteBook] = useState<Book | null>(null);
  const [pendingDeleteBookTag, setPendingDeleteBookTag] = useState<{ name: string; undo: () => void } | null>(null);
  const [readingGoal, setReadingGoal] = useState<number | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [goalCelebration, setGoalCelebration] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [hasMoreBooks, setHasMoreBooks] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const booksOffsetRef = useRef(0);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  useSmoothScroll(mainRef);
  useSmoothScroll(sidebarRef);

  const loadStats = useCallback(async () => {
    setStats(await dbGetBookStats());
  }, []);

  const loadYears = useCallback(async () => {
    setYears(await dbGetYearsWithCounts());
  }, []);

  const loadTagCounts = useCallback(async (year: number | null) => {
    setTagCounts(await dbGetTagCounts(year ?? undefined));
  }, []);

  const loadGoal = useCallback(async () => {
    setReadingGoal(await dbGetReadingGoal(currentYear));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBooks = useCallback(async (
    filter: LibraryFilter,
    year: number | null,
    tag: string | null,
    search: string
  ) => {
    const status = filter === 'all' ? undefined : (filter as BookStatus);
    const { items, hasMore } = await dbGetBooks({
      status, year: year ?? undefined, tag: tag ?? undefined, search,
      limit: BOOKS_PAGE_SIZE, offset: 0,
    });
    setBooks(items);
    setHasMoreBooks(hasMore);
    booksOffsetRef.current = items.length;
  }, []);

  const loadMoreBooks = useCallback(async () => {
    if (loadingMore || !hasMoreBooks) return;
    setLoadingMore(true);
    const status = libraryFilter === 'all' ? undefined : (libraryFilter as BookStatus);
    const { items, hasMore } = await dbGetBooks({
      status, year: yearFilter ?? undefined, tag: tagFilter ?? undefined, search: searchQuery,
      limit: BOOKS_PAGE_SIZE, offset: booksOffsetRef.current,
    });
    setBooks((prev) => [...prev, ...items]);
    booksOffsetRef.current += items.length;
    setHasMoreBooks(hasMore);
    setLoadingMore(false);
  }, [libraryFilter, yearFilter, tagFilter, searchQuery, hasMoreBooks, loadingMore]);

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el || !hasMoreBooks) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreBooks(); },
      { root: mainRef.current, rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMoreBooks, loadMoreBooks]);

  useEffect(() => {
    seedBooksIfEmpty().then(() => setSeeded(true));
  }, []);

  useEffect(() => {
    if (!seeded) return;
    loadStats();
    loadYears();
    loadGoal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded]);

  useEffect(() => {
    if (!seeded) return;
    loadTagCounts(yearFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, yearFilter]);

  useEffect(() => {
    if (!seeded) return;
    loadBooks(libraryFilter, yearFilter, tagFilter, searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, libraryFilter, yearFilter, tagFilter]);

  const currentYearCount = years.find((y) => y.year === currentYear)?.finished ?? 0;

  useEffect(() => {
    if (!readingGoal || readingGoal <= 0 || currentYearCount < readingGoal) return;
    const key = `books_goal_celebrated_${currentYear}`;
    if (localStorage.getItem(key) === 'true') return;
    localStorage.setItem(key, 'true');
    setGoalCelebration(true);
  }, [readingGoal, currentYearCount, currentYear]);

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadBooks(libraryFilter, yearFilter, tagFilter, q);
    }, 300);
  }

  function handleLibraryFilter(f: LibraryFilter) {
    setLibraryFilter(f);
    if (searchQuery) setSearchQuery('');
  }

  function handleYearFilter(year: number) {
    setYearFilter((prev) => (prev === year ? null : year));
  }

  function handleTagFilter(tag: string) {
    const next = tagFilter === tag ? null : tag;
    setTagFilter(next);
    if (next) {
      setLibraryFilter('all');
    }
  }

  async function refreshAll() {
    await Promise.all([
      loadStats(),
      loadYears(),
      loadTagCounts(yearFilter),
      loadBooks(libraryFilter, yearFilter, tagFilter, searchQuery),
    ]);
  }

  async function handleAddBook(data: NewBook) {
    const b = await dbAddBook(data);
    if (b) {
      setShowAddModal(false);
      await refreshAll();
    }
  }

  async function handleUpdateBook(data: NewBook) {
    if (!editingBook) return;
    await dbUpdateBook(editingBook.id, data);
    setEditingBook(null);
    await refreshAll();
  }

  async function handleQuickStatusChange(book: Book, status: BookStatus) {
    const finished_date = status === 'finished' ? book.finished_date ?? format(new Date(), 'yyyy-MM-dd') : null;
    const started_date = book.started_date ?? format(new Date(), 'yyyy-MM-dd');
    await dbUpdateBook(book.id, {
      title: book.title,
      author: book.author,
      cover_image: book.cover_image,
      status,
      started_date,
      finished_date,
      notes: book.notes,
      tags: book.tags,
    });
    setViewingBook((prev) => (prev && prev.id === book.id ? { ...prev, status, started_date, finished_date } : prev));
    await refreshAll();
  }

  async function commitDelete(book: Book) {
    await dbDeleteBook(book.id);
    await Promise.all([loadStats(), loadYears(), loadTagCounts(yearFilter)]);
    setPendingDeleteBook(null);
  }

  function handleDelete(book: Book) {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (pendingDeleteBook) commitDelete(pendingDeleteBook);

    setBooks((prev) => prev.filter((b) => b.id !== book.id));
    setPendingDeleteBook(book);

    deleteTimerRef.current = setTimeout(() => {
      commitDelete(book);
    }, 4000);
  }

  function handleUndoDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (!pendingDeleteBook) return;
    loadBooks(libraryFilter, yearFilter, tagFilter, searchQuery);
    setPendingDeleteBook(null);
  }

  async function commitTagDelete(name: string) {
    await dbDeleteBookTag(name);
    setPendingDeleteBookTag(null);
    await loadTagCounts(yearFilter);
  }

  function handleTagDeleted(name: string, undo: () => void) {
    if (tagDeleteTimerRef.current) clearTimeout(tagDeleteTimerRef.current);
    if (pendingDeleteBookTag) commitTagDelete(pendingDeleteBookTag.name);

    setPendingDeleteBookTag({ name, undo });
    tagDeleteTimerRef.current = setTimeout(() => {
      commitTagDelete(name);
    }, 4000);
  }

  function handleUndoTagDelete() {
    if (!pendingDeleteBookTag) return;
    if (tagDeleteTimerRef.current) { clearTimeout(tagDeleteTimerRef.current); tagDeleteTimerRef.current = null; }
    pendingDeleteBookTag.undo();
    setPendingDeleteBookTag(null);
  }

  function handleStartGoalEdit() {
    setGoalInput(readingGoal ? String(readingGoal) : '');
    setEditingGoal(true);
  }

  async function handleSaveGoal() {
    const n = parseInt(goalInput, 10);
    if (!Number.isFinite(n) || n <= 0) { setEditingGoal(false); return; }
    await dbSetReadingGoal(currentYear, n);
    setReadingGoal(n);
    setEditingGoal(false);
    if (currentYearCount < n) {
      localStorage.removeItem(`books_goal_celebrated_${currentYear}`);
    }
  }

  const groupByYear = libraryFilter === 'finished' || libraryFilter === 'all';

  const grouped = useMemo(() => {
    if (!groupByYear) return [];
    const map = new Map<string, Book[]>();
    for (const b of sortBooks(books, sortBy)) {
      const y = bookSortKey(b).slice(0, 4);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(b);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [books, sortBy, groupByYear]);

  const flatList = useMemo(() => sortBooks(books, sortBy), [books, sortBy]);

  const goalPct = readingGoal ? Math.min(100, Math.round((currentYearCount / readingGoal) * 100)) : 0;

  const headerSubText = useMemo(() => {
    if (tagFilter) {
      const count = tagCounts.find((tc) => tc.tag === tagFilter)?.count ?? 0;
      return t.books.booksCount(count);
    }
    if (yearFilter) {
      const entry = years.find((y) => y.year === yearFilter);
      const count = libraryFilter === 'finished' ? entry?.finished
        : libraryFilter === 'reading' ? entry?.reading
        : libraryFilter === 'want_to_read' ? entry?.wantToRead
        : entry?.total;
      return t.books.booksCount(count ?? 0);
    }
    if (libraryFilter === 'reading') return t.books.booksCount(stats.reading);
    if (libraryFilter === 'want_to_read') return t.books.booksCount(stats.wantToRead);
    if (libraryFilter === 'finished') return t.books.totalRead(stats.finished);
    return t.books.booksCount(stats.total);
  }, [tagFilter, yearFilter, libraryFilter, tagCounts, years, stats, books, t]);

  const emptyText = searchQuery
    ? t.books.emptySearch
    : libraryFilter === 'reading'
    ? t.books.emptyReading
    : libraryFilter === 'want_to_read'
    ? t.books.emptyWantToRead
    : t.books.emptyAll;

  return (
    <div className="books-wrap">
      {/* ── Sidebar ── */}
      <div ref={sidebarRef} className="books-sidebar">
        <div className="books-sb-section">
          <div className="books-sb-label">{t.books.library}</div>
          <button
            className={`books-sb-item${libraryFilter === 'all' ? ' active' : ''}`}
            onClick={() => handleLibraryFilter('all')}
          >
            <IconStack2 size={14} />
            {t.books.filterAll}
            <span className="books-sb-count">{stats.total}</span>
          </button>
          <button
            className={`books-sb-item${libraryFilter === 'finished' ? ' active' : ''}`}
            onClick={() => handleLibraryFilter('finished')}
          >
            <IconCircleCheck size={14} />
            {t.books.filterFinished}
            <span className="books-sb-count">{stats.finished}</span>
          </button>
          <button
            className={`books-sb-item${libraryFilter === 'reading' ? ' active' : ''}`}
            onClick={() => handleLibraryFilter('reading')}
          >
            <IconBook2 size={14} />
            {t.books.filterReading}
            <span className="books-sb-count">{stats.reading}</span>
          </button>
          <button
            className={`books-sb-item${libraryFilter === 'want_to_read' ? ' active' : ''}`}
            onClick={() => handleLibraryFilter('want_to_read')}
          >
            <IconBookmark size={14} />
            {t.books.filterWantToRead}
            <span className="books-sb-count">{stats.wantToRead}</span>
          </button>
        </div>

        {years.length > 0 && (
          <div className="books-sb-section">
            <div className="books-sb-label">{t.books.byYear}</div>
            {years.map(({ year, total, finished, reading, wantToRead }) => {
              const badgeCount = libraryFilter === 'finished' ? finished
                : libraryFilter === 'reading' ? reading
                : libraryFilter === 'want_to_read' ? wantToRead
                : total;
              return (
                <button
                  key={year}
                  className={`books-sb-item${yearFilter === year ? ' active' : ''}`}
                  onClick={() => handleYearFilter(year)}
                >
                  <span className="books-year-badge">{year}</span>
                  <span className="books-sb-count">{badgeCount}</span>
                </button>
              );
            })}
          </div>
        )}

        {tagCounts.length > 0 && (
          <div className="books-sb-section">
            <div className="books-sb-label">{t.books.genre}</div>
            {tagCounts.map(({ tag, count }) => (
              <button
                key={tag}
                className={`books-sb-item${tagFilter === tag ? ' active' : ''}`}
                onClick={() => handleTagFilter(tag)}
              >
                {tag}
                <span className="books-sb-count">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Main ── */}
      <div ref={mainRef} className="books-main">
        <div className="books-header">
          <div>
            <div className="books-header-title">{t.books.title}</div>
            <div className="books-header-sub">{headerSubText}</div>
          </div>

          <div className="books-goal-card">
            <div className="books-goal-head">
              <IconTarget size={14} />
              <span>{t.books.goalTitle(currentYear)}</span>
              {readingGoal !== null && !editingGoal && (
                <>
                  <span className="books-goal-count-inline">{t.books.goalProgress(currentYearCount, readingGoal)}</span>
                  <button className="books-goal-edit" onClick={handleStartGoalEdit} title={t.books.edit}>
                    <IconPencil size={12} />
                  </button>
                </>
              )}
              {editingGoal && (
                <div className="books-goal-editor books-goal-editor-inline">
                  <input
                    type="number"
                    min={1}
                    className="books-goal-input"
                    placeholder={t.books.goalPlaceholder}
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
                  />
                  <button className="books-goal-editor-btn" onClick={handleSaveGoal}><IconCheck size={13} /></button>
                  <button className="books-goal-editor-btn" onClick={() => setEditingGoal(false)}><IconX size={13} /></button>
                </div>
              )}
            </div>

            {!editingGoal && (
              readingGoal ? (
                <div className="books-goal-bar-track">
                  <div className="books-goal-bar-fill" style={{ width: `${goalPct}%` }} />
                </div>
              ) : (
                <button className="books-goal-cta" onClick={handleStartGoalEdit}>{t.books.setGoalCta}</button>
              )
            )}
          </div>

          <button className="books-btn-add" onClick={() => setShowAddModal(true)}>
            <IconPlus size={13} />
            {t.books.addBook}
          </button>
        </div>

        <div className="books-toolbar">
          <div className="books-search-wrap">
            <IconSearch size={13} className="books-search-icon" />
            <input
              className="books-search-input"
              placeholder={t.books.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              spellCheck={false}
            />
            {searchQuery && (
              <button
                className="books-search-clear"
                onClick={() => { setSearchQuery(''); loadBooks(libraryFilter, yearFilter, tagFilter, ''); }}
              >
                <IconX size={12} />
              </button>
            )}
          </div>
          <select className="books-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="date">{t.books.sortDate}</option>
            <option value="title">{t.books.sortTitle}</option>
            <option value="author">{t.books.sortAuthor}</option>
          </select>
        </div>

        <div key={`${libraryFilter}-${yearFilter ?? ''}-${tagFilter ?? ''}`} className="books-content-view">
          {books.length === 0 ? (
            <div className="books-empty-state">
              <IconBooks size={36} className="books-empty-icon" />
              <p className="books-empty-text">{emptyText}</p>
              {!searchQuery && (
                <button className="books-btn-add" onClick={() => setShowAddModal(true)}>
                  <IconPlus size={13} />
                  {t.books.addBook}
                </button>
              )}
            </div>
          ) : groupByYear ? (
            grouped.map(([year, list]) => (
              <div key={year} className="books-year-section">
                <div className="books-year-heading">
                  <span>{year}</span>
                  <span className="books-year-count">{t.books.booksCount(list.length)}</span>
                </div>
                <div className="books-shelf-grid">
                  {list.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      onView={() => setViewingBook(book)}
                      onEdit={() => setEditingBook(book)}
                      onDelete={() => handleDelete(book)}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="books-shelf-grid">
              {flatList.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onView={() => setViewingBook(book)}
                  onEdit={() => setEditingBook(book)}
                  onDelete={() => handleDelete(book)}
                />
              ))}
            </div>
          )}
          {hasMoreBooks && (
            <div ref={loadMoreSentinelRef} className="books-load-more">
              {loadingMore && <span className="books-load-more-text">{t.books.loadingMore}</span>}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddBookModal onSave={handleAddBook} onClose={() => setShowAddModal(false)} onTagDeleted={handleTagDeleted} />
      )}

      {editingBook && (
        <AddBookModal
          onSave={handleUpdateBook}
          onClose={() => setEditingBook(null)}
          initialBook={editingBook}
          onTagDeleted={handleTagDeleted}
        />
      )}

      {viewingBook && (
        <BookDetailModal
          book={viewingBook}
          onClose={() => setViewingBook(null)}
          onEdit={() => { setEditingBook(viewingBook); setViewingBook(null); }}
          onDelete={() => { handleDelete(viewingBook); setViewingBook(null); }}
          onStatusChange={(status) => handleQuickStatusChange(viewingBook, status)}
        />
      )}

      {pendingDeleteBook && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{t.books.deleted(pendingDeleteBook.title)}</span>
          <button className="delete-toast-undo" onClick={handleUndoDelete}>{t.books.undo}</button>
        </div>
      )}

      {pendingDeleteBookTag && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{t.toast.deleted(pendingDeleteBookTag.name)}</span>
          <button className="delete-toast-undo" onClick={handleUndoTagDelete}>{t.toast.undo}</button>
        </div>
      )}

      {goalCelebration && (
        <div className="books-celebration-toast" role="status">
          <IconTrophy size={18} />
          <span>{t.books.goalCelebration(readingGoal ?? currentYearCount)}</span>
          <button className="books-celebration-close" onClick={() => setGoalCelebration(false)}>
            <IconX size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
