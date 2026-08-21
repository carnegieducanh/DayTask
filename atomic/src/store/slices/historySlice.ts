import type { StateCreator } from 'zustand';
import type { AppState } from '../appStore';

export interface HistoryEntry {
  // Tên hiển thị trên toast khi hoàn tác (vd: tên task/goal/tag bị ảnh hưởng)
  label: string;
  undo: () => void | Promise<void>;
}

const MAX_HISTORY = 20;

export interface HistorySlice {
  historyStack: HistoryEntry[];
  isUndoing: boolean;
  undoneLabel: string | null;
  undoneToken: number;
  pushHistory: (entry: HistoryEntry) => void;
  undoLastAction: () => Promise<void>;
}

export const createHistorySlice: StateCreator<AppState, [], [], HistorySlice> = (set, get) => ({
  historyStack: [],
  isUndoing: false,
  undoneLabel: null,
  undoneToken: 0,

  pushHistory: (entry) => {
    // Bỏ qua khi action này tự phát sinh từ chính một lệnh hoàn tác đang chạy,
    // tránh nhồi lại "undo của undo" vào stack gây ping-pong khi bấm Ctrl+Z liên tiếp.
    if (get().isUndoing) return;
    set({ historyStack: [...get().historyStack, entry].slice(-MAX_HISTORY) });
  },

  undoLastAction: async () => {
    const stack = get().historyStack;
    if (stack.length === 0) return;
    const entry = stack[stack.length - 1];
    set({ historyStack: stack.slice(0, -1), isUndoing: true });
    try {
      await entry.undo();
    } finally {
      set({ isUndoing: false, undoneLabel: entry.label, undoneToken: get().undoneToken + 1 });
    }
  },
});
