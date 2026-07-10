import { useState, useEffect, useRef, useCallback } from 'react';
import { dbGetVocabWords, getVocabInterval, getVocabIndex, saveVocabIndex } from '../../store/vocabDb';
import { useT } from '../../i18n';
import type { VocabWord } from '../../types';

export default function VocabWidget({ noteStyle = false }: { noteStyle?: boolean }) {
  const t = useT();
  const [current, setCurrent] = useState<VocabWord | null>(null);
  const [contentKey, setContentKey] = useState(0);
  const [intervalMinutes, setIntervalMinutes] = useState(getVocabInterval);
  const [loaded, setLoaded] = useState(false);
  const wordsRef = useRef<VocabWord[]>([]);
  const indexRef = useRef(0);

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

  useEffect(() => {
    if (!loaded) return;
    const id = setInterval(advance, intervalMinutes * 60 * 1000);
    return () => clearInterval(id);
  }, [intervalMinutes, advance, loaded]);

  if (!current) return null;

  return (
    <div className={`vocab-widget-outer${noteStyle ? ' vocab-widget-note' : ''}`} onClick={advance} title={t.vocab.clickHint}>
      <div className="vocab-widget-label">{t.vocab.widgetHeader}</div>
      <div className="vocab-widget">
        {noteStyle && <span className="vocab-note-pin" aria-hidden="true">📌</span>}
        <div className="vocab-widget-content" key={contentKey}>
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
