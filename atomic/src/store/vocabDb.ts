import { isTauri } from './mockDb';
import type { VocabWord } from '../types';

let _db: import('@tauri-apps/plugin-sql').default | null = null;

async function getDb() {
  if (!_db) {
    const Database = (await import('@tauri-apps/plugin-sql')).default;
    _db = await Database.load('sqlite:atomic.db');
  }
  return _db;
}

export function getVocabInterval(): number {
  return Math.max(1, parseInt(localStorage.getItem('vocabIntervalMinutes') ?? '5') || 5);
}

export function saveVocabInterval(minutes: number): void {
  localStorage.setItem('vocabIntervalMinutes', String(minutes));
  window.dispatchEvent(new CustomEvent('vocabSettingsChanged'));
}

export async function dbGetVocabWords(): Promise<VocabWord[]> {
  if (!isTauri()) return [];
  const db = await getDb();
  return db.select<VocabWord[]>('SELECT * FROM vocab_words ORDER BY position ASC, id ASC');
}

export async function dbAddVocabWord(word: string, ipa: string, meaning: string): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  const maxPos = await db.select<{ m: number }[]>(
    'SELECT COALESCE(MAX(position), -1) as m FROM vocab_words'
  );
  const pos = (maxPos[0]?.m ?? -1) + 1;
  await db.execute(
    'INSERT INTO vocab_words (word, ipa, meaning, position) VALUES ($1, $2, $3, $4)',
    [word.trim(), ipa.trim(), meaning.trim(), pos]
  );
}

export async function dbBulkAddVocabWords(
  rows: Array<{ word: string; ipa: string; meaning: string }>
): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  const maxPos = await db.select<{ m: number }[]>(
    'SELECT COALESCE(MAX(position), -1) as m FROM vocab_words'
  );
  let pos = (maxPos[0]?.m ?? -1) + 1;
  for (const r of rows) {
    await db.execute(
      'INSERT INTO vocab_words (word, ipa, meaning, position) VALUES ($1, $2, $3, $4)',
      [r.word.trim(), r.ipa.trim(), r.meaning.trim(), pos++]
    );
  }
  window.dispatchEvent(new CustomEvent('vocabWordsChanged'));
}

export async function dbDeleteVocabWord(id: number): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  await db.execute('DELETE FROM vocab_words WHERE id = $1', [id]);
  window.dispatchEvent(new CustomEvent('vocabWordsChanged'));
}
