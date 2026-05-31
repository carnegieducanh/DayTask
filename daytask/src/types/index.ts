export type Category = 'work' | 'personal' | 'health' | 'learn';
export type Priority = 'high' | 'mid' | 'low';
export type GoalStatus = 'todo' | 'doing' | 'review' | 'done';
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'full';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  category: Category;
  priority: Priority;
  reminder: string | null;
  date: string;
  is_done: number;
  created_at: string;
}

export interface NewTask {
  title: string;
  description?: string;
  category: Category;
  priority: Priority;
  reminder?: string;
  date: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  category?: Category;
  priority?: Priority;
  reminder?: string;
  is_done?: number;
}

export interface Goal {
  id: number;
  title: string;
  description: string | null;
  category: Category;
  priority: Priority;
  year: number;
  quarter: Quarter;
  status: GoalStatus;
  progress: number;
  position: number;
  created_at: string;
}

export interface NewGoal {
  title: string;
  description?: string;
  category: Category;
  priority: Priority;
  year: number;
  quarter: Quarter;
  status?: GoalStatus;
}

export interface GoalUpdate {
  title?: string;
  description?: string;
  category?: Category;
  priority?: Priority;
  quarter?: Quarter;
  status?: GoalStatus;
  progress?: number;
  position?: number;
}

export interface GoalChecklistItem {
  id: number;
  goal_id: number;
  text: string;
  is_done: number;
  position: number;
}

export interface DayActivity {
  date: string;
  count: number;
}

export type Tab = 'today' | 'kanban' | 'heatmap';
export type Theme = 'light' | 'dark';
