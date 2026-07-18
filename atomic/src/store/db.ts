let _db: import('@tauri-apps/plugin-sql').default | null = null;

export async function getDb(): Promise<import('@tauri-apps/plugin-sql').default> {
  if (!_db) {
    const Database = (await import('@tauri-apps/plugin-sql')).default;
    _db = await Database.load('sqlite:atomic.db');
  }
  return _db;
}
