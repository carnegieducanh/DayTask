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

export default function VocabWidget() {
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
    <div className="vocab-widget" onClick={advance} title={t.vocab.clickHint}>
      <div className="vocab-widget-content" key={contentKey}>
        <span className="vocab-widget-word">{current.word}</span>
        {current.ipa && (
          <span className="vocab-widget-ipa">/{current.ipa}/</span>
        )}
        <span className="vocab-widget-meaning">{current.meaning}</span>
      </div>
    </div>
  );
}
