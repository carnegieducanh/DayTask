import { useState, useEffect, useRef, useCallback } from 'react';
import { dbGetVocabWords, getVocabInterval } from '../../store/vocabDb';
import { useT } from '../../i18n';
import type { VocabWord } from '../../types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
    wordsRef.current = shuffle(ws);
    indexRef.current = 0;
    setCurrent(wordsRef.current[0]);
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
    let next = indexRef.current + 1;
    if (next >= words.length) {
      wordsRef.current = shuffle(words);
      next = 0;
    }
    indexRef.current = next;
    setCurrent(wordsRef.current[next]);
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
          <svg className="vocab-note-botanical" viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 36 Q15 25 15 6" stroke="#7A9E7E" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M15 28 Q7 23 8 17 Q13 22 15 28" fill="#8DB58F"/>
            <path d="M15 20 Q23 15 22 9 Q17 14 15 20" fill="#8DB58F"/>
            <path d="M15 12 Q10 8 11 3 Q14 7 15 12" fill="#8DB58F" opacity="0.75"/>
          </svg>
        )}
      </div>
    </div>
  );
}
