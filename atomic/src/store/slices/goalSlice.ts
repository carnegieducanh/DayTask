import type { StateCreator } from 'zustand';
import type { Goal, NewGoal, GoalUpdate, GoalChecklistItem } from '../../types';
import {
  isTauri,
  dbGetGoals, dbAddGoal, dbUpdateGoal, dbDeleteGoal,
  dbGetAllChecklistItems, dbAddChecklistItem, dbToggleChecklistItem, dbUpdateChecklistItem, dbDeleteChecklistItem, dbDeleteChecklistItemsByGoal,
} from '../mockDb';
import { getDb } from '../db';
import type { AppState } from '../appStore';

export interface GoalSlice {
  goals: Goal[];
  checklistItems: Record<number, GoalChecklistItem[]>;
  pendingDeleteGoal: Goal | null;
  pendingDeleteChecklistItem: { item: GoalChecklistItem; goalId: number } | null;

  loadGoals: (year: number) => Promise<void>;
  addGoal: (goal: NewGoal) => Promise<number>;
  updateGoal: (id: number, updates: GoalUpdate) => Promise<void>;
  reorderGoal: (activeId: number, newStatus: Goal['status'], newIndex: number) => Promise<void>;
  deleteGoal: (id: number) => Promise<void>;
  softDeleteGoal: (id: number) => void;
  undoDeleteGoal: () => void;
  confirmDeleteGoal: (goal: Goal) => Promise<void>;

  addChecklistItem: (goalId: number, text: string) => Promise<void>;
  toggleChecklistItem: (itemId: number, goalId: number) => Promise<void>;
  updateChecklistItem: (itemId: number, goalId: number, text: string) => Promise<void>;
  softDeleteChecklistItem: (itemId: number, goalId: number) => void;
  undoDeleteChecklistItem: () => void;
  confirmDeleteChecklistItem: (itemId: number, goalId: number) => Promise<void>;
  deleteChecklistItem: (itemId: number, goalId: number) => Promise<void>;
}

export const createGoalSlice: StateCreator<AppState, [], [], GoalSlice> = (set, get) => ({
  goals: [],
  checklistItems: {},
  pendingDeleteGoal: null,
  pendingDeleteChecklistItem: null,

  loadGoals: async (year) => {
    if (!isTauri()) {
      const allItems = dbGetAllChecklistItems();
      const byGoal: Record<number, GoalChecklistItem[]> = {};
      for (const item of allItems) {
        if (!byGoal[item.goal_id]) byGoal[item.goal_id] = [];
        byGoal[item.goal_id].push(item);
      }
      set({ goals: dbGetGoals(year), checklistItems: byGoal });
      return;
    }
    const db = await getDb();
    const goals = await db.select<Goal[]>(
      'SELECT * FROM goals WHERE year = $1 ORDER BY status ASC, position ASC',
      [year]
    );
    const allItems = await db.select<GoalChecklistItem[]>(
      'SELECT * FROM goal_checklist_items ORDER BY goal_id, position ASC'
    );
    const byGoal: Record<number, GoalChecklistItem[]> = {};
    for (const item of allItems) {
      if (!byGoal[item.goal_id]) byGoal[item.goal_id] = [];
      byGoal[item.goal_id].push(item);
    }
    set({ goals, checklistItems: byGoal });
  },

  addGoal: async (goal) => {
    const priority = goal.priority ?? 'mid';
    if (!isTauri()) {
      const g = dbAddGoal({ title: goal.title, description: goal.description ?? null, category: goal.category, priority, year: goal.year, quarter: goal.quarter, status: goal.status ?? 'todo', progress: 0, position: dbGetGoals(goal.year).filter(g => g.status === (goal.status ?? 'todo')).length });
      set({ goals: dbGetGoals(get().selectedYear) });
      return g.id;
    }
    const db = await getDb();
    const result = await db.execute(
      `INSERT INTO goals (title, description, category, priority, year, quarter, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [goal.title, goal.description ?? null, goal.category, priority, goal.year, goal.quarter, goal.status ?? 'todo']
    );
    const newId = result.lastInsertId!;
    await get().loadGoals(get().selectedYear);
    return newId;
  },

  updateGoal: async (id, updates) => {
    if (!isTauri()) {
      dbUpdateGoal(id, updates);
      set({ goals: dbGetGoals(get().selectedYear) });
      return;
    }
    const db = await getDb();
    const fields = Object.keys(updates) as (keyof GoalUpdate)[];
    const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => updates[f]);
    await db.execute(
      `UPDATE goals SET ${setClauses} WHERE id = $1`,
      [id, ...values]
    );
    await get().loadGoals(get().selectedYear);
  },

  // Kéo thả Kanban: chèn card vào newIndex của cột đích rồi ĐÁNH SỐ LẠI
  // position 0..n cho cả cột đích (và cột nguồn nếu đổi cột). Trước đây chỉ gán
  // position = position của card đích nên 2 card trùng số → thứ tự nhảy lung tung.
  reorderGoal: async (activeId, newStatus, newIndex) => {
    const goals = get().goals;
    const active = goals.find((g) => g.id === activeId);
    if (!active) return;
    const oldStatus = active.status;

    // Thứ tự id cột đích (loại card đang kéo), rồi chèn vào newIndex đã clamp
    const targetIds = goals
      .filter((g) => g.status === newStatus && g.id !== activeId)
      .sort((a, b) => a.position - b.position)
      .map((g) => g.id);
    const idx = Math.max(0, Math.min(newIndex, targetIds.length));
    targetIds.splice(idx, 0, activeId);

    const updates: { id: number; status: Goal['status']; position: number }[] =
      targetIds.map((id, i) => ({ id, status: newStatus, position: i }));

    // Đổi cột → đánh số lại cột nguồn cho liền mạch
    if (oldStatus !== newStatus) {
      goals
        .filter((g) => g.status === oldStatus && g.id !== activeId)
        .sort((a, b) => a.position - b.position)
        .forEach((g, i) => updates.push({ id: g.id, status: oldStatus, position: i }));
    }

    // Optimistic update — tránh giật/nhảy, không cần reload từ DB
    const byId = new Map(updates.map((u) => [u.id, u]));
    set({
      goals: goals.map((g) =>
        byId.has(g.id)
          ? { ...g, status: byId.get(g.id)!.status, position: byId.get(g.id)!.position }
          : g
      ),
    });

    // Lưu xuống DB
    if (!isTauri()) {
      for (const u of updates) dbUpdateGoal(u.id, { status: u.status, position: u.position });
      return;
    }
    const db = await getDb();
    for (const u of updates) {
      await db.execute('UPDATE goals SET status = $1, position = $2 WHERE id = $3', [
        u.status,
        u.position,
        u.id,
      ]);
    }
  },

  deleteGoal: async (id) => {
    if (!isTauri()) {
      dbDeleteChecklistItemsByGoal(id);
      dbDeleteGoal(id);
      const { [id]: _, ...rest } = get().checklistItems;
      set({ goals: get().goals.filter((g) => g.id !== id), checklistItems: rest });
      return;
    }
    const db = await getDb();
    await db.execute('DELETE FROM goal_checklist_items WHERE goal_id = $1', [id]);
    await db.execute('DELETE FROM goals WHERE id = $1', [id]);
    const { [id]: _, ...rest } = get().checklistItems;
    set({ goals: get().goals.filter((g) => g.id !== id), checklistItems: rest });
  },

  softDeleteGoal: (id) => {
    const goal = get().goals.find((g) => g.id === id);
    if (!goal) return;
    const prev = get().pendingDeleteGoal;
    if (prev) get().confirmDeleteGoal(prev);
    const { [id]: _, ...restChecklist } = get().checklistItems;
    set({
      goals: get().goals.filter((g) => g.id !== id),
      checklistItems: restChecklist,
      pendingDeleteGoal: goal,
    });
  },

  undoDeleteGoal: () => {
    const goal = get().pendingDeleteGoal;
    if (!goal) return;
    const goals = [...get().goals, goal].sort((a, b) => a.position - b.position);
    set({ goals, pendingDeleteGoal: null });
  },

  confirmDeleteGoal: async (goal) => {
    set({ pendingDeleteGoal: null });
    if (!isTauri()) {
      dbDeleteChecklistItemsByGoal(goal.id);
      dbDeleteGoal(goal.id);
      return;
    }
    const db = await getDb();
    await db.execute('DELETE FROM goal_checklist_items WHERE goal_id = $1', [goal.id]);
    await db.execute('DELETE FROM goals WHERE id = $1', [goal.id]);
  },

  addChecklistItem: async (goalId, text) => {
    if (!isTauri()) {
      const item = dbAddChecklistItem(goalId, text);
      const prev = get().checklistItems[goalId] ?? [];
      set({ checklistItems: { ...get().checklistItems, [goalId]: [...prev, item] } });
      return;
    }
    const db = await getDb();
    const prev = get().checklistItems[goalId] ?? [];
    const position = prev.length;
    await db.execute(
      'INSERT INTO goal_checklist_items (goal_id, text, is_done, position) VALUES ($1, $2, 0, $3)',
      [goalId, text, position]
    );
    const items = await db.select<GoalChecklistItem[]>(
      'SELECT * FROM goal_checklist_items WHERE goal_id = $1 ORDER BY position ASC',
      [goalId]
    );
    set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
  },

  toggleChecklistItem: async (itemId, goalId) => {
    if (!isTauri()) {
      dbToggleChecklistItem(itemId);
      const items = (get().checklistItems[goalId] ?? []).map((i) =>
        i.id === itemId ? { ...i, is_done: i.is_done ? 0 : 1 } : i
      );
      set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
      return;
    }
    const db = await getDb();
    const item = (get().checklistItems[goalId] ?? []).find((i) => i.id === itemId);
    if (!item) return;
    await db.execute(
      'UPDATE goal_checklist_items SET is_done = $1 WHERE id = $2',
      [item.is_done ? 0 : 1, itemId]
    );
    const items = (get().checklistItems[goalId] ?? []).map((i) =>
      i.id === itemId ? { ...i, is_done: i.is_done ? 0 : 1 } : i
    );
    set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
  },

  updateChecklistItem: async (itemId, goalId, text) => {
    if (!isTauri()) {
      dbUpdateChecklistItem(itemId, text);
      const items = (get().checklistItems[goalId] ?? []).map((i) =>
        i.id === itemId ? { ...i, text } : i
      );
      set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
      return;
    }
    const db = await getDb();
    await db.execute('UPDATE goal_checklist_items SET text = $1 WHERE id = $2', [text, itemId]);
    const items = (get().checklistItems[goalId] ?? []).map((i) =>
      i.id === itemId ? { ...i, text } : i
    );
    set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
  },

  softDeleteChecklistItem: (itemId, goalId) => {
    const item = (get().checklistItems[goalId] ?? []).find((i) => i.id === itemId);
    if (!item) return;
    const prev = get().pendingDeleteChecklistItem;
    if (prev) get().confirmDeleteChecklistItem(prev.item.id, prev.goalId);
    const items = (get().checklistItems[goalId] ?? []).filter((i) => i.id !== itemId);
    set({ checklistItems: { ...get().checklistItems, [goalId]: items }, pendingDeleteChecklistItem: { item, goalId } });
  },

  undoDeleteChecklistItem: () => {
    const pending = get().pendingDeleteChecklistItem;
    if (!pending) return;
    const prev = get().checklistItems[pending.goalId] ?? [];
    const restored = [...prev, pending.item].sort((a, b) => a.position - b.position);
    set({ checklistItems: { ...get().checklistItems, [pending.goalId]: restored }, pendingDeleteChecklistItem: null });
  },

  confirmDeleteChecklistItem: async (itemId, _goalId) => {
    set({ pendingDeleteChecklistItem: null });
    if (!isTauri()) { dbDeleteChecklistItem(itemId); return; }
    const db = await getDb();
    await db.execute('DELETE FROM goal_checklist_items WHERE id = $1', [itemId]);
  },

  deleteChecklistItem: async (itemId, goalId) => {
    if (!isTauri()) {
      dbDeleteChecklistItem(itemId);
      const items = (get().checklistItems[goalId] ?? []).filter((i) => i.id !== itemId);
      set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
      return;
    }
    const db = await getDb();
    await db.execute('DELETE FROM goal_checklist_items WHERE id = $1', [itemId]);
    const items = (get().checklistItems[goalId] ?? []).filter((i) => i.id !== itemId);
    set({ checklistItems: { ...get().checklistItems, [goalId]: items } });
  },
});
