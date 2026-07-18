import type { StateCreator } from 'zustand';
import { format } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import type { Task, Tab, Theme, Language, AccentColor } from '../../types';
import { isTauri } from '../mockDb';
import type { AppState } from '../appStore';

export interface UiSlice {
  activeTab: Tab;
  theme: Theme;
  selectedDate: string;
  selectedYear: number;
  loading: boolean;

  reminderPopup: Task | null;
  snoozedUntil: Record<number, number>;
  openAddGoalModal: boolean;
  uiScale: number;
  openSettingsModal: boolean;
  kanbanDragActiveId: number | null;
  language: Language;
  autostart: boolean;
  accentColor: AccentColor;
  customAccentColor: string;
  savedAccentColors: string[];

  setActiveTab: (tab: Tab) => void;
  toggleTheme: () => void;
  setUiScale: (scale: number) => void;
  setLanguage: (lang: Language) => void;
  setAccentColor: (color: AccentColor) => void;
  setCustomAccentColor: (hex: string) => void;
  saveAccentColor: (hex: string) => void;
  removeAccentColor: (hex: string) => void;
  setOpenSettingsModal: (val: boolean) => void;
  setSelectedDate: (date: string) => void;
  setSelectedYear: (year: number) => void;
  setReminderPopup: (task: Task | null) => void;
  snoozeReminder: (taskId: number, minutes: number) => void;
  dismissReminder: () => void;
  setOpenAddGoalModal: (val: boolean) => void;
  setKanbanDragActiveId: (id: number | null) => void;
  initAutostart: () => Promise<void>;
  setAutostart: (v: boolean) => Promise<void>;
}

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set, get) => ({
  activeTab: 'today',
  theme: (localStorage.getItem('theme') as Theme) ?? 'light',
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  selectedYear: new Date().getFullYear(),
  loading: false,

  reminderPopup: null,
  snoozedUntil: {},
  openAddGoalModal: false,
  uiScale: parseFloat(localStorage.getItem('uiScale') ?? '1.1'),
  openSettingsModal: false,
  kanbanDragActiveId: null,
  language: (localStorage.getItem('language') as Language) ?? 'vi',
  autostart: true,
  accentColor: (localStorage.getItem('accentColor') as AccentColor) ?? 'blue',
  customAccentColor: localStorage.getItem('customAccentColor') ?? '#185FA5',
  savedAccentColors: JSON.parse(localStorage.getItem('savedAccentColors') ?? '[]'),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setUiScale: (scale) => {
    localStorage.setItem('uiScale', String(scale));
    set({ uiScale: scale });
  },

  setLanguage: (lang) => {
    localStorage.setItem('language', lang);
    set({ language: lang });
  },

  setAccentColor: (color) => {
    localStorage.setItem('accentColor', color);
    set({ accentColor: color });
  },

  setCustomAccentColor: (hex) => {
    localStorage.setItem('customAccentColor', hex);
    set({ customAccentColor: hex });
  },

  saveAccentColor: (hex) => {
    const prev: string[] = JSON.parse(localStorage.getItem('savedAccentColors') ?? '[]');
    const deduped = [hex, ...prev.filter(c => c !== hex)].slice(0, 8);
    localStorage.setItem('savedAccentColors', JSON.stringify(deduped));
    set({ savedAccentColors: deduped });
  },

  removeAccentColor: (hex) => {
    const prev: string[] = JSON.parse(localStorage.getItem('savedAccentColors') ?? '[]');
    const updated = prev.filter(c => c !== hex);
    localStorage.setItem('savedAccentColors', JSON.stringify(updated));
    set({ savedAccentColors: updated });
  },

  setOpenSettingsModal: (val) => set({ openSettingsModal: val }),

  toggleTheme: () => {
    const next: Theme = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    set({ theme: next });
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().loadTasks(date);
  },

  setSelectedYear: (year) => {
    set({ selectedYear: year });
    get().loadGoals(year);
  },

  setReminderPopup: (task) => set({ reminderPopup: task }),

  snoozeReminder: (taskId, minutes) => {
    const until = Date.now() + minutes * 60 * 1000;
    set((state) => ({
      snoozedUntil: { ...state.snoozedUntil, [taskId]: until },
      reminderPopup: null,
    }));
  },

  dismissReminder: () => set({ reminderPopup: null }),
  setOpenAddGoalModal: (val) => set({ openAddGoalModal: val }),
  setKanbanDragActiveId: (id) => set({ kanbanDragActiveId: id }),

  initAutostart: async () => {
    if (!isTauri()) return;
    const firstRun = !localStorage.getItem('autostartInitialized');
    if (firstRun) {
      await invoke('plugin:autostart|enable');
      localStorage.setItem('autostartInitialized', '1');
      set({ autostart: true });
    } else {
      const enabled = await invoke<boolean>('plugin:autostart|is_enabled');
      set({ autostart: enabled });
    }
  },

  setAutostart: async (v) => {
    set({ autostart: v });
    if (!isTauri()) return;
    if (v) {
      await invoke('plugin:autostart|enable');
    } else {
      await invoke('plugin:autostart|disable');
    }
  },
});
