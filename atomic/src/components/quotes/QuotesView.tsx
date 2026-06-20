import { useState, useEffect, useRef, useCallback } from 'react';
import {
  IconQuote,
  IconHeart,
  IconHeartFilled,
  IconCopy,
  IconTrash,
  IconPlus,
  IconSettings,
  IconCheck,
  IconPin,
  IconPinFilled,
  IconSearch,
  IconX,
  IconSparkles,
  IconStack2,
  IconClock,
} from '@tabler/icons-react';
import type { Quote, QuoteHeroMode } from '../../types';
import {
  dbGetQuotes,
  dbAddQuote,
  dbDeleteQuote,
  dbToggleQuoteFavorite,
  dbGetHeroQuote,
  dbGetLanguageCounts,
  dbGetQuoteCounts,
  getHeroModeLS,
  setHeroModeLS,
  getPinnedIdLS,
  setPinnedIdLS,
  invalidateDailyCache,
} from '../../store/quotesDb';
import { useT } from '../../i18n';

const LANG_NAMES: Record<string, string> = {
  EN: 'English',
  VI: 'Tiếng Việt',
  JA: '日本語',
  ZH: '中文',
  KO: '한국어',
  FR: 'Français',
  DE: 'Deutsch',
  ES: 'Español',
  RU: 'Русский',
};

const LANG_OPTIONS = ['EN', 'VI', 'JA', 'ZH', 'KO', 'FR', 'DE', 'ES', 'RU'];

type SidebarFilter = 'all' | 'favorites' | 'recent';

// ── AddQuoteModal ────────────────────────────────────────────────────────────

interface AddQuoteModalProps {
  onSave: (text: string, author: string, language: string, tags: string[]) => Promise<void>;
  onClose: () => void;
}

function AddQuoteModal({ onSave, onClose }: AddQuoteModalProps) {
  const t = useT();
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [language, setLanguage] = useState('EN');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = tagInput.trim().replace(/,$/, '');
      if (trimmed && !tags.includes(trimmed)) {
        setTags((prev) => [...prev, trimmed]);
      }
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    await onSave(text.trim(), author.trim(), language, tags);
    setSaving(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="quotes-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <div className="quotes-modal">
        <div className="quotes-modal-header">
          <span className="quotes-modal-title">{t.quotes.modalAddTitle}</span>
          <button className="quotes-modal-close" onClick={onClose}><IconX size={16} /></button>
        </div>

        <div className="quotes-modal-body">
          <label className="quotes-modal-label">{t.quotes.textLabel}</label>
          <textarea
            ref={textRef}
            className="quotes-modal-textarea"
            placeholder={t.quotes.textPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
          />

          <label className="quotes-modal-label">{t.quotes.authorLabel}</label>
          <input
            className="quotes-modal-input"
            placeholder={t.quotes.authorPlaceholder}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />

          <div className="quotes-modal-row">
            <div style={{ flex: 1 }}>
              <label className="quotes-modal-label">{t.quotes.languageLabel}</label>
              <select
                className="quotes-modal-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANG_OPTIONS.map((l) => (
                  <option key={l} value={l}>{l} — {LANG_NAMES[l]}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="quotes-modal-label">{t.quotes.tagsLabel}</label>
          <div className="quotes-tag-input-wrap">
            {tags.map((tag) => (
              <span key={tag} className="quotes-tag-chip">
                {tag}
                <button className="quotes-tag-remove" onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}>
                  <IconX size={10} />
                </button>
              </span>
            ))}
            <input
              className="quotes-tag-input"
              placeholder={tags.length === 0 ? t.quotes.tagsPlaceholder : ''}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
            />
          </div>
        </div>

        <div className="quotes-modal-footer">
          <button className="quotes-modal-btn-cancel" onClick={onClose}>{t.quotes.cancel}</button>
          <button
            className="quotes-modal-btn-save"
            onClick={handleSave}
            disabled={!text.trim() || saving}
          >
            {saving ? '...' : t.quotes.save}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QuotesView ───────────────────────────────────────────────────────────────

export default function QuotesView() {
  const t = useT();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [heroQuote, setHeroQuote] = useState<Quote | null>(null);
  const [heroMode, setHeroMode] = useState<QuoteHeroMode>(getHeroModeLS);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>('all');
  const [langFilter, setLangFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [langCounts, setLangCounts] = useState<{ language: string; count: number }[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setShowModeMenu(false);
      }
    }
    if (showModeMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModeMenu]);

  const loadStats = useCallback(async () => {
    const [counts, langs] = await Promise.all([dbGetQuoteCounts(), dbGetLanguageCounts()]);
    setTotalCount(counts.total);
    setFavCount(counts.favorites);
    setLangCounts(langs);
  }, []);

  const loadHeroQuote = useCallback(async (mode: QuoteHeroMode) => {
    const q = await dbGetHeroQuote(mode);
    setHeroQuote(q);
  }, []);

  const loadQuotes = useCallback(async (filter: SidebarFilter, lang: string | null, search: string) => {
    const qs = await dbGetQuotes({ filter, language: lang ?? undefined, search });
    setQuotes(qs);
  }, []);

  useEffect(() => {
    loadStats();
    loadHeroQuote(heroMode);
  }, []);

  useEffect(() => {
    loadQuotes(sidebarFilter, langFilter, searchQuery);
  }, [sidebarFilter, langFilter]);

  function handleSearch(q: string) {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadQuotes(sidebarFilter, langFilter, q);
    }, 300);
  }

  async function handleToggleFavorite(quote: Quote) {
    await dbToggleQuoteFavorite(quote.id, quote.is_favorite);
    const newFav = quote.is_favorite ? 0 : 1;
    setQuotes((prev) =>
      prev.map((q) => (q.id === quote.id ? { ...q, is_favorite: newFav } : q))
    );
    if (heroQuote?.id === quote.id) {
      setHeroQuote((prev) => (prev ? { ...prev, is_favorite: newFav } : null));
    }
    await loadStats();
    if (heroMode === 'random_favorites') await loadHeroQuote(heroMode);
  }

  async function handleDelete(quote: Quote) {
    await dbDeleteQuote(quote.id);
    setQuotes((prev) => prev.filter((q) => q.id !== quote.id));
    if (heroQuote?.id === quote.id) {
      setPinnedIdLS(null);
      setHeroQuote(null);
    }
    await loadStats();
  }

  async function handleCopy(quote: Quote) {
    const text = quote.author
      ? `"${quote.text}" — ${quote.author}`
      : `"${quote.text}"`;
    await navigator.clipboard.writeText(text);
    setCopiedId(quote.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function handlePin(quote: Quote) {
    setPinnedIdLS(quote.id);
    setHeroQuote(quote);
    invalidateDailyCache();
  }

  async function handleChangeMode(mode: QuoteHeroMode) {
    setHeroMode(mode);
    setHeroModeLS(mode);
    setShowModeMenu(false);
    if (mode !== 'manual') invalidateDailyCache();
    await loadHeroQuote(mode);
  }

  async function handleAddQuote(text: string, author: string, language: string, tags: string[]) {
    const q = await dbAddQuote(text, author || null, language, tags);
    if (q) {
      setShowAddModal(false);
      await Promise.all([loadStats(), loadQuotes(sidebarFilter, langFilter, searchQuery)]);
    }
  }

  function handleSidebarFilter(f: SidebarFilter) {
    setSidebarFilter(f);
    setLangFilter(null);
    if (searchQuery) {
      setSearchQuery('');
    }
  }

  function handleLangFilter(lang: string) {
    setSidebarFilter('all');
    setLangFilter((prev) => (prev === lang ? null : lang));
    if (searchQuery) setSearchQuery('');
  }

  const sectionTitle = (() => {
    if (langFilter) {
      const cnt = langCounts.find((l) => l.language === langFilter)?.count ?? 0;
      return t.quotes.langSection(langFilter, cnt);
    }
    if (sidebarFilter === 'favorites') return t.quotes.favSection(favCount);
    if (sidebarFilter === 'recent') return t.quotes.recentSection;
    return t.quotes.allSection(totalCount);
  })();

  const pinnedId = getPinnedIdLS();

  const heroEmpty = heroMode === 'manual'
    ? t.quotes.heroEmptyManual
    : heroMode === 'random_favorites'
    ? t.quotes.heroEmptyFav
    : t.quotes.heroEmpty;

  return (
    <div className="quotes-wrap">
      {/* ── Sidebar ── */}
      <div className="quotes-sidebar">
        <div className="quotes-sb-section">
          <div className="quotes-sb-label">{t.quotes.library}</div>
          <button
            className={`quotes-sb-item${sidebarFilter === 'all' && !langFilter ? ' active' : ''}`}
            onClick={() => handleSidebarFilter('all')}
          >
            <IconStack2 size={14} />
            {t.quotes.sidebarAll}
            <span className="quotes-sb-count">{totalCount}</span>
          </button>
          <button
            className={`quotes-sb-item${sidebarFilter === 'favorites' ? ' active' : ''}`}
            onClick={() => handleSidebarFilter('favorites')}
          >
            <IconHeart size={14} />
            {t.quotes.sidebarFav}
            <span className="quotes-sb-count">{favCount}</span>
          </button>
          <button
            className={`quotes-sb-item${sidebarFilter === 'recent' ? ' active' : ''}`}
            onClick={() => handleSidebarFilter('recent')}
          >
            <IconClock size={14} />
            {t.quotes.sidebarRecent}
          </button>
        </div>

        {langCounts.length > 0 && (
          <div className="quotes-sb-section">
            <div className="quotes-sb-label">{t.quotes.language}</div>
            {langCounts.map(({ language, count }) => (
              <button
                key={language}
                className={`quotes-sb-item${langFilter === language ? ' active' : ''}`}
                onClick={() => handleLangFilter(language)}
              >
                <span className="quotes-lang-badge">{language}</span>
                <span className="quotes-sb-lang-name">{LANG_NAMES[language] ?? language}</span>
                <span className="quotes-sb-count">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Main ── */}
      <div className="quotes-main">
        {/* Hero card */}
        <div className="quotes-hero">
          <div className="quotes-hero-bigmark">
            <IconQuote size={44} strokeWidth={1.5} />
          </div>

          <div className="quotes-hero-top">
            <div className="quotes-hero-label">
              <IconSparkles size={12} />
              {t.quotes.heroLabel}
            </div>
            <div ref={modeMenuRef} className="quotes-hero-mode-wrap">
              <button
                className="quotes-hero-gear"
                title={t.quotes.heroModeTitle}
                onClick={() => setShowModeMenu((v) => !v)}
              >
                <IconSettings size={13} />
              </button>
              {showModeMenu && (
                <div className="quotes-mode-menu">
                  {(
                    [
                      { id: 'random_daily', label: t.quotes.modeRandomDaily },
                      { id: 'random_favorites', label: t.quotes.modeRandomFav },
                      { id: 'manual', label: t.quotes.modeManual },
                    ] as { id: QuoteHeroMode; label: string }[]
                  ).map((m) => (
                    <button
                      key={m.id}
                      className={`quotes-mode-item${heroMode === m.id ? ' active' : ''}`}
                      onClick={() => handleChangeMode(m.id)}
                    >
                      <span className="quotes-mode-check">
                        {heroMode === m.id && <IconCheck size={12} />}
                      </span>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {heroQuote ? (
            <>
              <div className="quotes-hero-text">{heroQuote.text}</div>
              {heroQuote.author && (
                <div className="quotes-hero-author">
                  — <span>{heroQuote.author}</span>
                </div>
              )}
            </>
          ) : (
            <div className="quotes-hero-empty">{heroEmpty}</div>
          )}
        </div>

        {/* List section */}
        <div className="quotes-list-section">
          <div className="quotes-list-header">
            <span className="quotes-section-title">{sectionTitle}</span>
            <button className="quotes-btn-add" onClick={() => setShowAddModal(true)}>
              <IconPlus size={13} />
              {t.quotes.addQuote}
            </button>
          </div>

          {/* Search bar */}
          <div className="quotes-search-wrap">
            <IconSearch size={13} className="quotes-search-icon" />
            <input
              className="quotes-search-input"
              placeholder={t.quotes.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {searchQuery && (
              <button
                className="quotes-search-clear"
                onClick={() => {
                  setSearchQuery('');
                  loadQuotes(sidebarFilter, langFilter, '');
                }}
              >
                <IconX size={12} />
              </button>
            )}
          </div>

          {/* Quote list */}
          <div className="quotes-list">
            {quotes.length === 0 ? (
              <div className="quotes-empty-state">
                <IconQuote size={36} className="quotes-empty-icon" />
                <p className="quotes-empty-text">
                  {searchQuery
                    ? t.quotes.emptySearch
                    : sidebarFilter === 'favorites'
                    ? t.quotes.emptyFav
                    : t.quotes.emptyAll}
                </p>
                {!searchQuery && sidebarFilter !== 'favorites' && (
                  <button className="quotes-btn-add" onClick={() => setShowAddModal(true)}>
                    <IconPlus size={13} />
                    {t.quotes.addQuote}
                  </button>
                )}
              </div>
            ) : (
              quotes.map((quote) => (
                <div key={quote.id} className="quotes-item">
                  <div className="quotes-item-body">
                    <div className="quotes-item-text">{quote.text}</div>
                    <div className="quotes-item-meta">
                      {quote.author && (
                        <span className="quotes-item-author">— {quote.author}</span>
                      )}
                      <span className="quotes-lang-tag">{quote.language}</span>
                      {quote.tags.map((tag) => (
                        <span key={tag} className="quotes-tag-chip-sm">{tag}</span>
                      ))}
                    </div>
                  </div>

                  <div className="quotes-item-actions">
                    {heroMode === 'manual' && (
                      <button
                        className={`quotes-btn-sm${pinnedId === quote.id ? ' pinned' : ''}`}
                        onClick={() => handlePin(quote)}
                        title={pinnedId === quote.id ? t.quotes.pinned : t.quotes.pin}
                      >
                        {pinnedId === quote.id ? <IconPinFilled size={14} /> : <IconPin size={14} />}
                      </button>
                    )}
                    <button
                      className={`quotes-btn-sm${quote.is_favorite ? ' fav' : ''}`}
                      onClick={() => handleToggleFavorite(quote)}
                      title={quote.is_favorite ? t.quotes.unfavorite : t.quotes.favorite}
                    >
                      {quote.is_favorite ? <IconHeartFilled size={14} /> : <IconHeart size={14} />}
                    </button>
                    <button
                      className="quotes-btn-sm"
                      onClick={() => handleCopy(quote)}
                      title={copiedId === quote.id ? t.quotes.copied : t.quotes.copy}
                    >
                      {copiedId === quote.id ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    </button>
                    <button
                      className="quotes-btn-sm danger"
                      onClick={() => handleDelete(quote)}
                      title={t.quotes.delete}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddQuoteModal onSave={handleAddQuote} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
