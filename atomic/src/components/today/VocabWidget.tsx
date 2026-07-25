import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { dbGetVocabWords, getVocabInterval, getVocabIndex, saveVocabIndex } from '../../store/vocabDb';
import { useT } from '../../i18n';
import type { VocabWord } from '../../types';

const EXPAND_MS = 400;
const COLLAPSE_MS = 320;
const EXPANDED_CLASS = 'vocab-widget-content-expanded';

export default function VocabWidget({ noteStyle = false }: { noteStyle?: boolean }) {
  const t = useT();
  const [current, setCurrent] = useState<VocabWord | null>(null);
  const [contentKey, setContentKey] = useState(0);
  const [intervalMinutes, setIntervalMinutes] = useState(getVocabInterval);
  const [loaded, setLoaded] = useState(false);
  const wordsRef = useRef<VocabWord[]>([]);
  const indexRef = useRef(0);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const isHoveringRef = useRef(false);

  const loadWords = useCallback(async () => {
    const ws = await dbGetVocabWords();
    if (ws.length === 0) {
      wordsRef.current = [];
      setCurrent(null);
      setLoaded(false);
      return;
    }
    wordsRef.current = ws;
    const idx = getVocabIndex() % ws.length;
    indexRef.current = idx;
    setCurrent(ws[idx]);
    setContentKey((k) => k + 1);
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  useEffect(() => {
    const onSettingsChange = () => setIntervalMinutes(getVocabInterval());
    const onWordsChange = () => loadWords();
    window.addEventListener('vocabSettingsChanged', onSettingsChange);
    window.addEventListener('vocabWordsChanged', onWordsChange);
    return () => {
      window.removeEventListener('vocabSettingsChanged', onSettingsChange);
      window.removeEventListener('vocabWordsChanged', onWordsChange);
    };
  }, [loadWords]);

  const advance = useCallback(() => {
    const words = wordsRef.current;
    if (words.length === 0) return;
    const next = (indexRef.current + 1) % words.length;
    indexRef.current = next;
    saveVocabIndex(next);
    setCurrent(words[next]);
    setContentKey((k) => k + 1);
  }, []);

  const handleClick = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    advance();
  }, [advance]);

  useEffect(() => {
    if (!loaded) return;
    const id = setInterval(advance, intervalMinutes * 60 * 1000);
    return () => clearInterval(id);
  }, [intervalMinutes, advance, loaded]);

  // Imperative expand/collapse (bypasses CSS `:hover` + React re-render
  // timing entirely — driving this through state/`:hover` was racy: the
  // white-space flip on .vocab-widget-meaning and the max-height change
  // could land in the same style recalc, leaving the browser nothing to
  // interpolate from, which read as an instant snap instead of a
  // transition. Here every step is forced synchronously in order: add the
  // class that un-wraps the meaning text, measure the real height it now
  // needs, pin the box at its current height, force a reflow so that pinned
  // height is committed as a real "before" frame, then only after that set
  // the transition and the target height — guaranteeing two distinct
  // frames for the browser to animate between.
  const expand = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const collapsedPx = el.getBoundingClientRect().height;
    el.classList.add(EXPANDED_CLASS);
    const fullPx = el.scrollHeight;
    if (fullPx <= collapsedPx) {
      // Content already fits within the baseline — nothing to reveal, so
      // hovering should have no visible effect at all.
      el.classList.remove(EXPANDED_CLASS);
      return;
    }
    el.style.transition = 'none';
    el.style.maxHeight = `${collapsedPx}px`;
    void el.offsetHeight; // force reflow — commits the pinned height as a real frame
    requestAnimationFrame(() => {
      el.style.transition = `max-height ${EXPAND_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`;
      el.style.maxHeight = `${fullPx}px`;
    });
  }, []);

  const collapse = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const currentPx = el.getBoundingClientRect().height;
    el.style.transition = 'none';
    el.style.maxHeight = `${currentPx}px`; // pin wherever it actually is (handles mid-expand interruption)
    void el.offsetHeight;
    requestAnimationFrame(() => {
      el.style.transition = `max-height ${COLLAPSE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`;
      el.style.maxHeight = '';
      el.classList.remove(EXPANDED_CLASS);
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    expand();
  }, [expand]);

  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    collapse();
  }, [collapse]);

  // Word changed while the mouse was already resting on the card (e.g. the
  // auto-advance timer fired mid-hover) — the freshly remounted content
  // node (new `key`) has no inline style/class yet, so re-apply the
  // expanded state for it immediately (a height snap here is fine, it's
  // riding along with the word-change's own slide/fade entrance).
  useLayoutEffect(() => {
    if (!isHoveringRef.current) return;
    const el = contentRef.current;
    if (!el) return;
    el.classList.add(EXPANDED_CLASS);
    const collapsedPx = parseFloat(getComputedStyle(el).maxHeight) || 0;
    const fullPx = el.scrollHeight;
    if (fullPx > collapsedPx) {
      el.style.transition = 'none';
      el.style.maxHeight = `${fullPx}px`;
    } else {
      el.classList.remove(EXPANDED_CLASS);
    }
  }, [current]);

  if (!current) return null;

  return (
    <div className={`vocab-widget-outer${noteStyle ? ' vocab-widget-note' : ''}`} onClick={handleClick} title={t.vocab.clickHint}>
      <div className="vocab-widget-label">{t.vocab.widgetHeader}</div>
      <div className="vocab-widget" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {noteStyle && <span className="vocab-note-pin" aria-hidden="true">📌</span>}
        <div className="vocab-widget-content" key={contentKey} ref={contentRef}>
          <div className="vocab-widget-word-row">
            <span className="vocab-widget-word">{current.word}</span>
            {current.ipa && (
              <span className="vocab-widget-ipa">/ {current.ipa} /</span>
            )}
          </div>
          <div className="vocab-widget-divider" />
          <span className="vocab-widget-meaning">{current.meaning}</span>
          {current.meaning_en && (
            <span className="vocab-widget-meaning-en">{current.meaning_en}</span>
          )}
        </div>
        {noteStyle && (
          <div className="vn-leaf-pile" aria-hidden="true">
            <span>🍂</span>
            <span>🍂</span>
            <span>🍂</span>
            <span>🍂</span>
            <span>🍂</span>
            <span>🍂</span>
            <span>🍂</span>
          </div>
        )}
      </div>
    </div>
  );
}
