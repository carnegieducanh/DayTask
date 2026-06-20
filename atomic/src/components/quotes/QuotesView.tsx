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
  IconPencil,
  IconTag,
  IconChevronDown,
} from '@tabler/icons-react';
import type { Quote, QuoteHeroMode } from '../../types';
import {
  dbGetQuotes,
  dbAddQuote,
  dbUpdateQuote,
  dbDeleteQuote,
  dbToggleQuoteFavorite,
  dbGetHeroQuote,
  dbGetLanguageCounts,
  dbGetQuoteCounts,
  dbGetAllQuoteTagNames,
  dbRenameQuoteTag,
  dbDeleteQuoteTag,
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
};

const LANG_OPTIONS = ['EN', 'VI', 'JA', 'ZH'];

type SidebarFilter = 'all' | 'favorites' | 'recent';

// ── AddQuoteModal ────────────────────────────────────────────────────────────

interface AddQuoteModalProps {
  onSave: (text: string, author: string, language: string, tags: string[]) => Promise<void>;
  onClose: () => void;
  initialQuote?: Quote;
  onTagDeleted: (name: string, undo: () => void) => void;
}

function AddQuoteModal({ onSave, onClose, initialQuote, onTagDeleted }: AddQuoteModalProps) {
  const t = useT();
  const isEdit = !!initialQuote;
  const [text, setText] = useState(initialQuote?.text ?? '');
  const [author, setAuthor] = useState(initialQuote?.author ?? '');
  const [language, setLanguage] = useState(initialQuote?.language ?? 'EN');
  const [tags, setTags] = useState<string[]>(initialQuote?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagDropOpen, setTagDropOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagPanelStyle, setTagPanelStyle] = useState<React.CSSProperties>({});
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const tagDropRef = useRef<HTMLDivElement>(null);
  const tagTriggerRef = useRef<HTMLButtonElement>(null);
  const tagSearchRef = useRef<HTMLInputElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    textRef.current?.focus();
    dbGetAllQuoteTagNames().then(setAllTags);
  }, []);

  useEffect(() => {
    if (!tagDropOpen) return;
    function handler(e: MouseEvent) {
      if (tagDropRef.current && !tagDropRef.current.contains(e.target as Node)) {
        setTagDropOpen(false);
        setShowNewTagInput(false);
        setNewTagInput('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tagDropOpen]);

  function handleTagDropClick() {
    if (!tagDropOpen && tagTriggerRef.current) {
      const rect = tagTriggerRef.current.getBoundingClientRect();
      setTagPanelStyle({ top: rect.height + 4, left: 0, minWidth: rect.width });
      setTagSearch('');
      setTimeout(() => tagSearchRef.current?.focus(), 0);
    }
    setTagDropOpen((v) => !v);
  }

  function toggleTag(name: string) {
    setTags((prev) => prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]);
  }

  function handleCreateTag() {
    const name = newTagInput.trim();
    if (!name) return;
    if (!allTags.includes(name)) setAllTags((prev) => [...prev, name].sort());
    if (!tags.includes(name)) setTags((prev) => [...prev, name]);
    setNewTagInput('');
    setShowNewTagInput(false);
  }

  function handleNewTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleCreateTag(); }
    if (e.key === 'Escape') { setShowNewTagInput(false); setNewTagInput(''); }
  }

  async function handleRenameTag(oldName: string) {
    const newName = renameInput.trim();
    setRenamingTag(null);
    if (!newName || newName === oldName) return;
    await dbRenameQuoteTag(oldName, newName);
    setAllTags((prev) => prev.map((t) => t === oldName ? newName : t).sort());
    setTags((prev) => prev.map((t) => t === oldName ? newName : t));
  }

  function handleDeleteTag(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    const wasSelected = tags.includes(name);
    setAllTags((prev) => prev.filter((t) => t !== name));
    if (wasSelected) setTags((prev) => prev.filter((t) => t !== name));
    onTagDeleted(name, () => {
      setAllTags((prev) => [...prev, name].sort());
      if (wasSelected) setTags((prev) => [...prev, name]);
    });
  }

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    await onSave(text.trim(), author.trim(), language, tags);
    setSaving(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && !tagDropOpen) onClose();
  }

  const filteredTags = allTags.filter((t) => !tagSearch || t.toLowerCase().includes(tagSearch.toLowerCase()));

  return (
    <div className="quotes-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={handleKeyDown}>
      <div className="quotes-modal">
        <div className="quotes-modal-header">
          <span className="quotes-modal-title">{isEdit ? t.quotes.modalEditTitle : t.quotes.modalAddTitle}</span>
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
            spellCheck={false}
          />

          <label className="quotes-modal-label">{t.quotes.authorLabel}</label>
          <input
            className="quotes-modal-input"
            placeholder={t.quotes.authorPlaceholder}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            spellCheck={false}
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
          <div className="tag-dropdown" ref={tagDropRef}>
            <button
              ref={tagTriggerRef}
              type="button"
              className={`tag-dropdown-trigger${tagDropOpen ? ' open' : ''}`}
              onClick={handleTagDropClick}
            >
              {tags.length === 0 ? (
                <>
                  <IconTag size={13} className="time-dropdown-icon muted" />
                  <span className="tag-dropdown-label placeholder">{t.quotes.tagsPlaceholder}</span>
                </>
              ) : (
                <span className="tag-dropdown-label">{tags.join(', ')}</span>
              )}
              <IconChevronDown size={13} className={`cat-dropdown-chevron${tagDropOpen ? ' open' : ''}`} />
            </button>

            {tagDropOpen && (
              <div className="tag-dropdown-panel" style={tagPanelStyle}>
                {allTags.length > 0 && (
                  <div className="tag-dropdown-search-wrap">
                    <input
                      ref={tagSearchRef}
                      className="tag-dropdown-search"
                      placeholder={t.calendar.filterTagSearch}
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                    />
                  </div>
                )}
                <div className="tag-dropdown-list">
                  {allTags.length === 0 && (
                    <div className="tag-dropdown-empty">{t.tags.noTags}</div>
                  )}
                  {allTags.length > 0 && tagSearch && filteredTags.length === 0 && (
                    <div className="tag-dropdown-empty">{t.tags.noTags}</div>
                  )}
                  {filteredTags.map((tagName) => {
                    const selected = tags.includes(tagName);
                    const isRenaming = renamingTag === tagName;
                    return (
                      <div
                        key={tagName}
                        className={`tag-dropdown-item${selected && !isRenaming ? ' selected' : ''}`}
                      >
                        {isRenaming ? (
                          <>
                            <input
                              className="tag-dropdown-rename-input"
                              value={renameInput}
                              onChange={(e) => setRenameInput(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={() => handleRenameTag(tagName)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleRenameTag(tagName); }
                                if (e.key === 'Escape') setRenamingTag(null);
                              }}
                              autoFocus
                            />
                            <div className="tag-dropdown-item-actions">
                              <button className="tag-dropdown-action-btn" onClick={(e) => { e.stopPropagation(); handleRenameTag(tagName); }}>
                                <IconCheck size={12} />
                              </button>
                              <button className="tag-dropdown-action-btn" onClick={(e) => { e.stopPropagation(); setRenamingTag(null); }}>
                                <IconX size={12} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="tag-dropdown-item-select" onClick={() => toggleTag(tagName)}>
                              <span className="tag-dropdown-check">
                                {selected && <IconCheck size={11} />}
                              </span>
                              <span>{tagName}</span>
                            </div>
                            <div className="tag-dropdown-item-actions">
                              <button
                                className="tag-dropdown-action-btn"
                                onClick={(e) => { e.stopPropagation(); setRenamingTag(tagName); setRenameInput(tagName); }}
                              >
                                <IconPencil size={12} />
                              </button>
                              <button
                                className="tag-dropdown-action-btn tag-dropdown-action-delete"
                                onClick={(e) => handleDeleteTag(tagName, e)}
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
                  {showNewTagInput ? (
                    <div className="tag-picker-new-input">
                      <input
                        ref={newTagInputRef}
                        className="tag-picker-input"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={handleNewTagKeyDown}
                        placeholder={t.tags.addPlaceholder}
                      />
                      <button type="button" className="tag-picker-confirm" onClick={handleCreateTag}>
                        <IconCheck size={13} />
                      </button>
                      <button type="button" className="tag-picker-cancel" onClick={() => { setShowNewTagInput(false); setNewTagInput(''); }}>
                        <IconX size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="tag-dropdown-add-btn"
                      onClick={() => { setShowNewTagInput(true); setTimeout(() => newTagInputRef.current?.focus(), 0); }}
                    >
                      {t.tags.createNew}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="quotes-modal-footer">
          <button className="quotes-modal-btn-cancel" onClick={onClose}>{t.quotes.cancel}</button>
          <button
            className="quotes-modal-btn-save"
            onClick={handleSave}
            disabled={!text.trim() || saving}
          >
            {saving ? '...' : isEdit ? t.quotes.editSave : t.quotes.save}
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
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [heroAnimKey, setHeroAnimKey] = useState(0);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [pendingDeleteQuote, setPendingDeleteQuote] = useState<Quote | null>(null);
  const [pendingDeleteHeroWas, setPendingDeleteHeroWas] = useState<Quote | null>(null);
  const [pendingDeleteQuoteTag, setPendingDeleteQuoteTag] = useState<{ name: string; undo: () => void } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  async function commitDelete(quote: Quote, wasHero: Quote | null) {
    await dbDeleteQuote(quote.id);
    if (wasHero?.id === quote.id && heroMode === 'manual') setPinnedIdLS(null);
    await loadStats();
    setPendingDeleteQuote(null);
    setPendingDeleteHeroWas(null);
  }

  function handleDelete(quote: Quote) {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (pendingDeleteQuote) {
      commitDelete(pendingDeleteQuote, pendingDeleteHeroWas);
    }

    setQuotes((prev) => prev.filter((q) => q.id !== quote.id));

    const savedHero = heroQuote?.id === quote.id ? heroQuote : null;
    if (savedHero) {
      if (heroMode === 'manual') setPinnedIdLS(null);
      setHeroQuote(null);
    }

    setPendingDeleteQuote(quote);
    setPendingDeleteHeroWas(savedHero);

    deleteTimerRef.current = setTimeout(() => {
      commitDelete(quote, savedHero);
    }, 4000);
  }

  function handleUndoDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (!pendingDeleteQuote) return;
    if (pendingDeleteHeroWas) {
      setHeroQuote(pendingDeleteHeroWas);
      if (heroMode === 'manual') setPinnedIdLS(pendingDeleteHeroWas.id);
    }
    loadQuotes(sidebarFilter, langFilter, searchQuery);
    setPendingDeleteQuote(null);
    setPendingDeleteHeroWas(null);
  }

  async function handleUpdateQuote(text: string, author: string, language: string, tags: string[]) {
    if (!editingQuote) return;
    await dbUpdateQuote(editingQuote.id, text, author || null, language, tags);
    const updated: Quote = { ...editingQuote, text, author: author || null, language, tags };
    setQuotes((prev) => prev.map((q) => (q.id === editingQuote.id ? updated : q)));
    if (heroQuote?.id === editingQuote.id) setHeroQuote(updated);
    setEditingQuote(null);
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

  function handleTagDeleted(name: string, undo: () => void) {
    if (tagDeleteTimerRef.current) clearTimeout(tagDeleteTimerRef.current);
    setPendingDeleteQuoteTag({ name, undo });
    tagDeleteTimerRef.current = setTimeout(async () => {
      await dbDeleteQuoteTag(name);
      setPendingDeleteQuoteTag(null);
      tagDeleteTimerRef.current = null;
    }, 4000);
  }

  function handleUndoTagDelete() {
    if (!pendingDeleteQuoteTag) return;
    if (tagDeleteTimerRef.current) { clearTimeout(tagDeleteTimerRef.current); tagDeleteTimerRef.current = null; }
    pendingDeleteQuoteTag.undo();
    setPendingDeleteQuoteTag(null);
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

          <div className={`quotes-hero-body${heroQuote ? ` quotes-lang-${heroQuote.language.toLowerCase()}` : ''}`}>
            <div className="quotes-hero-bigmark">
              <IconQuote size={40} strokeWidth={1.5} />
            </div>
            {heroQuote ? (
              <div key={heroAnimKey} className="quotes-hero-content-animate">
                <div className="quotes-hero-text">{heroQuote.text}</div>
                {heroQuote.author && (
                  <div className="quotes-hero-author">
                    — <span>{heroQuote.author}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="quotes-hero-empty">{heroEmpty}</div>
            )}
          </div>
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
              spellCheck={false}
            />
            <span className="quotes-search-line" aria-hidden>{t.quotes.searchPlaceholder}</span>
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
                <div key={quote.id} className={`quotes-item quotes-lang-${quote.language.toLowerCase()}${heroQuote?.id === quote.id ? ' hero-active' : ''}`}>
                  <div className="quotes-item-body" onClick={() => { setHeroQuote(quote); setHeroAnimKey((k) => k + 1); }}>
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
                      className="quotes-btn-sm"
                      onClick={() => setEditingQuote(quote)}
                      title={t.quotes.edit}
                    >
                      <IconPencil size={14} />
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
        <AddQuoteModal onSave={handleAddQuote} onClose={() => setShowAddModal(false)} onTagDeleted={handleTagDeleted} />
      )}

      {editingQuote && (
        <AddQuoteModal
          onSave={handleUpdateQuote}
          onClose={() => setEditingQuote(null)}
          initialQuote={editingQuote}
          onTagDeleted={handleTagDeleted}
        />
      )}

      {pendingDeleteQuote && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">
            {t.quotes.deleted(pendingDeleteQuote.text)}
          </span>
          <button className="delete-toast-undo" onClick={handleUndoDelete}>
            {t.quotes.undo}
          </button>
        </div>
      )}

      {pendingDeleteQuoteTag && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">
            {t.toast.deleted(pendingDeleteQuoteTag.name)}
          </span>
          <button className="delete-toast-undo" onClick={handleUndoTagDelete}>
            {t.toast.undo}
          </button>
        </div>
      )}
    </div>
  );
}
