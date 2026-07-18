import type { StateCreator } from 'zustand';
import { writeFile, readFile, remove, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { compressBackgroundImage, dataUrlToBytes, safeBackgroundFilename, BG_DIR, LEGACY_BG_FILENAME } from '../backgroundImage';
import { isTauri } from '../mockDb';
import type { AppState } from '../appStore';

// Never overwrites an existing background file: if `desiredName` is taken, appends " (n)" before the extension.
async function uniqueBackgroundFilename(desiredName: string): Promise<string> {
  const dot = desiredName.lastIndexOf('.');
  const base = dot > 0 ? desiredName.slice(0, dot) : desiredName;
  const ext = dot > 0 ? desiredName.slice(dot) : '';
  let candidate = desiredName;
  for (let n = 1; await exists(`${BG_DIR}/${candidate}`, { baseDir: BaseDirectory.AppData }); n++) {
    candidate = `${base} (${n})${ext}`;
  }
  return candidate;
}

export interface BackgroundSlice {
  backgroundEnabled: boolean;
  backgroundOpacity: number;
  backgroundImageUrl: string | null;
  uiTransparency: number;

  loadBackgroundImage: () => Promise<void>;
  setBackgroundImage: (file: File) => Promise<void>;
  removeBackgroundImage: () => Promise<void>;
  setBackgroundOpacity: (n: number) => void;
  setBackgroundEnabled: (v: boolean) => void;
  setUiTransparency: (n: number) => void;
  openBackgroundImageFolder: () => Promise<void>;
}

export const createBackgroundSlice: StateCreator<AppState, [], [], BackgroundSlice> = (set, get) => ({
  backgroundEnabled: localStorage.getItem('backgroundEnabled') === '1',
  backgroundOpacity: parseInt(localStorage.getItem('backgroundOpacity') ?? '60', 10),
  backgroundImageUrl: null,
  uiTransparency: parseInt(localStorage.getItem('uiTransparency') ?? '0', 10),

  loadBackgroundImage: async () => {
    if (!isTauri()) return;
    let filename = localStorage.getItem('backgroundActiveFilename');

    if (!filename) {
      // One-time migration from the old fixed-filename scheme.
      if (localStorage.getItem('backgroundHasImage') !== '1') return;
      let migrated = await exists(`${BG_DIR}/${LEGACY_BG_FILENAME}`, { baseDir: BaseDirectory.AppData });
      if (!migrated) {
        // Even older: bare filename directly under AppData root (pre-subfolder).
        const legacyAtRoot = await exists(LEGACY_BG_FILENAME, { baseDir: BaseDirectory.AppData });
        if (legacyAtRoot) {
          const legacyBytes = await readFile(LEGACY_BG_FILENAME, { baseDir: BaseDirectory.AppData });
          await mkdir(BG_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
          await writeFile(`${BG_DIR}/${LEGACY_BG_FILENAME}`, legacyBytes, { baseDir: BaseDirectory.AppData });
          await remove(LEGACY_BG_FILENAME, { baseDir: BaseDirectory.AppData });
          migrated = true;
        }
      }
      if (!migrated) return;
      filename = LEGACY_BG_FILENAME;
      localStorage.setItem('backgroundActiveFilename', filename);
    }

    const path = `${BG_DIR}/${filename}`;
    const has = await exists(path, { baseDir: BaseDirectory.AppData });
    if (!has) return;
    const bytes = await readFile(path, { baseDir: BaseDirectory.AppData });
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const prev = get().backgroundImageUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ backgroundImageUrl: url });
  },

  setBackgroundImage: async (file) => {
    if (!isTauri()) return;
    const dataUrl = await compressBackgroundImage(file);
    const bytes = dataUrlToBytes(dataUrl);
    await mkdir(BG_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
    // Keeps the original filename; never overwrites a previously saved background.
    const filename = await uniqueBackgroundFilename(safeBackgroundFilename(file.name));
    await writeFile(`${BG_DIR}/${filename}`, bytes, { baseDir: BaseDirectory.AppData });
    localStorage.setItem('backgroundActiveFilename', filename);
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const prev = get().backgroundImageUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ backgroundImageUrl: url });
  },

  removeBackgroundImage: async () => {
    const prev = get().backgroundImageUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ backgroundImageUrl: null });
    const filename = localStorage.getItem('backgroundActiveFilename');
    localStorage.removeItem('backgroundActiveFilename');
    localStorage.removeItem('backgroundHasImage');
    if (!isTauri() || !filename) return;
    // Only the active file is removed — older backgrounds saved under previous uploads stay on disk.
    const path = `${BG_DIR}/${filename}`;
    const has = await exists(path, { baseDir: BaseDirectory.AppData });
    if (has) await remove(path, { baseDir: BaseDirectory.AppData });
  },

  setBackgroundOpacity: (n) => {
    localStorage.setItem('backgroundOpacity', String(n));
    set({ backgroundOpacity: n });
  },

  setBackgroundEnabled: (v) => {
    localStorage.setItem('backgroundEnabled', v ? '1' : '0');
    set({ backgroundEnabled: v });
  },

  openBackgroundImageFolder: async () => {
    if (!isTauri()) return;
    const filename = localStorage.getItem('backgroundActiveFilename') ?? LEGACY_BG_FILENAME;
    const dir = await appDataDir();
    const path = await join(dir, BG_DIR, filename);
    await revealItemInDir(path);
  },

  setUiTransparency: (n) => {
    localStorage.setItem('uiTransparency', String(n));
    set({ uiTransparency: n });
  },
});
