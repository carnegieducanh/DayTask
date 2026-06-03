export type Category = 'work' | 'personal' | 'health' | 'learn' | 'creative' | 'mindfulness' | 'finance';
export type Priority = 'high' | 'mid' | 'low';
export type GoalStatus = 'todo' | 'doing' | 'review' | 'done';
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'full';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  category: Category;
  date: string;
  is_done: number;
  repeat_daily: number;
  series_id: number | null;
  repeat_end_date: string | null;
  created_at: string;
}

export interface NewTask {
  title: string;
  description?: string;
  category: Category;
  date: string;
  repeat_daily?: number;
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  category?: Category;
  is_done?: number;
  repeat_daily?: number;
  repeat_end_date?: string | null;
}

export interface TaskTimeEntry {
  task_id: number;
  date: string;
  start_time: string;
  end_time: string;
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

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export type Tab = 'today' | 'kanban' | 'heatmap' | 'calendar';
export type Theme = 'light' | 'dark';
export type Language = 'vi' | 'en';
export type AccentColor = 'blue' | 'orange' | 'green' | 'purple' | 'red' | 'yellow';
export type CategoryColors = Record<Category, string>;
