import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './books.css';
import { format } from 'date-fns';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import {
  IconPlus,
  IconPencil,
  IconX,
  IconCheck,
  IconSearch,
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

  // Eyebrow = bối cảnh đang xem: thể loại (hoặc nhóm thư viện) · năm
  const eyebrowText = [
    tagFilter ?? {
      all: t.books.library,
      finished: t.books.filterFinished,
      reading: t.books.filterReading,
      want_to_read: t.books.filterWantToRead,
    }[libraryFilter],
    yearFilter !== null ? String(yearFilter) : null,
  ].filter(Boolean).join(' · ');

  const libraryItems: { id: LibraryFilter; label: string; count: number }[] = [
    { id: 'all', label: t.books.filterAll, count: stats.total },
    { id: 'finished', label: t.books.filterFinished, count: stats.finished },
    { id: 'reading', label: t.books.filterReading, count: stats.reading },
    { id: 'want_to_read', label: t.books.filterWantToRead, count: stats.wantToRead },
  ];

  function renderShelf(list: Book[]) {
    return (
      <div className="bk-shelf">
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
    );
  }

  return (
    <div className="bk-wrap">
      {/* ── Cột lọc ── */}
      <aside ref={sidebarRef} className="bk-rail">
        <section className="bk-rail-section">
          <div className="bk-rail-label">{t.books.library}</div>
          {libraryItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`bk-rail-item${libraryFilter === item.id ? ' active' : ''}`}
              onClick={() => handleLibraryFilter(item.id)}
            >
              <span className={`bk-status-dot status-${item.id}`} />
              <span className="bk-rail-name">{item.label}</span>
              <span className="bk-rail-count">{item.count}</span>
            </button>
          ))}
        </section>

        {years.length > 0 && (
          <section className="bk-rail-section">
            <div className="bk-rail-label">{t.books.byYear}</div>
            {years.map(({ year, total, finished, reading, wantToRead }) => {
              const badgeCount = libraryFilter === 'finished' ? finished
                : libraryFilter === 'reading' ? reading
                : libraryFilter === 'want_to_read' ? wantToRead
                : total;
              return (
                <button
                  key={year}
                  type="button"
                  className={`bk-rail-item${yearFilter === year ? ' active' : ''}`}
                  onClick={() => handleYearFilter(year)}
                >
                  <span className="bk-rail-name bk-rail-year">{year}</span>
                  <span className="bk-rail-count">{badgeCount}</span>
                </button>
              );
            })}
          </section>
        )}

        {tagCounts.length > 0 && (
          <section className="bk-rail-section">
            <div className="bk-rail-label">{t.books.genre}</div>
            {tagCounts.map(({ tag, count }) => (
              <button
                key={tag}
                type="button"
                className={`bk-rail-item${tagFilter === tag ? ' active' : ''}`}
                onClick={() => handleTagFilter(tag)}
              >
                <span className="bk-rail-name">{tag}</span>
                <span className="bk-rail-count">{count}</span>
              </button>
            ))}
          </section>
        )}
      </aside>

      {/* ── Trang chính ── */}
      <div ref={mainRef} className="bk-main">
        <div className="bk-page">
          <header className="bk-head">
            <div className="bk-head-main">
              <span className="bk-eyebrow">{eyebrowText}</span>
              <h1 className="bk-title">{t.books.title}</h1>
              <p className="bk-subtitle">{headerSubText}</p>
            </div>

            <div className="bk-head-side">
              <div className="bk-goal">
                <div className="bk-goal-top">
                  <span className="bk-goal-label">{t.books.goalTitle(currentYear)}</span>
                  {readingGoal !== null && !editingGoal && (
                    <button className="bk-goal-edit" onClick={handleStartGoalEdit} title={t.books.edit}>
                      <IconPencil size={12} />
                    </button>
                  )}
                </div>

                {editingGoal ? (
                  <div className="bk-goal-editor">
                    <input
                      type="number"
                      min={1}
                      className="bk-goal-input"
                      placeholder={t.books.goalPlaceholder}
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
                    />
                    <button className="bk-goal-editor-btn" onClick={handleSaveGoal}><IconCheck size={13} /></button>
                    <button className="bk-goal-editor-btn" onClick={() => setEditingGoal(false)}><IconX size={13} /></button>
                  </div>
                ) : readingGoal ? (
                  <>
                    <div className="bk-goal-value">
                      <span className="bk-goal-num">{currentYearCount}</span>
                      <span className="bk-goal-of">/ {t.books.booksCount(readingGoal)}</span>
                      <span className="bk-goal-pct">{goalPct}%</span>
                    </div>
                    <span className="bk-progress"><span style={{ width: `${goalPct}%` }} /></span>
                  </>
                ) : (
                  <button className="bk-goal-cta" onClick={handleStartGoalEdit}>{t.books.setGoalCta}</button>
                )}
              </div>

              <button type="button" className="bk-btn-primary" onClick={() => setShowAddModal(true)}>
                <IconPlus size={15} />
                {t.books.addBook}
              </button>
            </div>
          </header>

          <div className="bk-toolbar">
            <div className="bk-search">
              <IconSearch size={14} />
              <input
                placeholder={t.books.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                spellCheck={false}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="bk-search-clear"
                  onClick={() => { setSearchQuery(''); loadBooks(libraryFilter, yearFilter, tagFilter, ''); }}
                >
                  <IconX size={12} />
                </button>
              )}
            </div>
            <label className="bk-sort">
              <span className="bk-sort-label">{t.projects.sortBy}</span>
              <select className="bk-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                <option value="date">{t.books.sortDate}</option>
                <option value="title">{t.books.sortTitle}</option>
                <option value="author">{t.books.sortAuthor}</option>
              </select>
            </label>
          </div>

          {/* Khối nội dung phải giữ animation (transform → stacking context): khối giấy
              sau bìa (::after z-index -1) cần một stacking context gần nhất không có nền. */}
          <div key={`${libraryFilter}-${yearFilter ?? ''}-${tagFilter ?? ''}`} className="bk-content">
            {books.length === 0 ? (
              <div className="bk-empty">
                <p>{emptyText}</p>
                {!searchQuery && (
                  <button type="button" className="bk-btn-primary" onClick={() => setShowAddModal(true)}>
                    <IconPlus size={15} />
                    {t.books.addBook}
                  </button>
                )}
              </div>
            ) : groupByYear ? (
              grouped.map(([year, list]) => (
                <section key={year} className="bk-year">
                  <div className="bk-year-head">
                    <h2 className="bk-year-num">{year}</h2>
                    <span className="bk-year-count">{t.books.booksCount(list.length)}</span>
                  </div>
                  {renderShelf(list)}
                </section>
              ))
            ) : (
              renderShelf(flatList)
            )}
            {hasMoreBooks && (
              <div ref={loadMoreSentinelRef} className="bk-load-more">
                {loadingMore && <span>{t.books.loadingMore}</span>}
              </div>
            )}
          </div>
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
        <div className="bk-celebration" role="status">
          <IconTrophy size={18} />
          <span>{t.books.goalCelebration(readingGoal ?? currentYearCount)}</span>
          <button className="bk-celebration-close" onClick={() => setGoalCelebration(false)}>
            <IconX size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
