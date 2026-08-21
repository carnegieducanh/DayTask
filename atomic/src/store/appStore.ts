import { create } from 'zustand';
import { createUiSlice, type UiSlice } from './slices/uiSlice';
import { createBackgroundSlice, type BackgroundSlice } from './slices/backgroundSlice';
import { createTagSlice, type TagSlice } from './slices/tagSlice';
import { createTaskSlice, type TaskSlice } from './slices/taskSlice';
import { createGoalSlice, type GoalSlice } from './slices/goalSlice';
import { createHeatmapSlice, type HeatmapSlice } from './slices/heatmapSlice';
import { createDataSlice, type DataSlice } from './slices/dataSlice';
import { createHistorySlice, type HistorySlice } from './slices/historySlice';

export type AppState = UiSlice & BackgroundSlice & TagSlice & TaskSlice & GoalSlice & HeatmapSlice & DataSlice & HistorySlice;

export const useAppStore = create<AppState>((...a) => ({
  ...createUiSlice(...a),
  ...createBackgroundSlice(...a),
  ...createTagSlice(...a),
  ...createTaskSlice(...a),
  ...createGoalSlice(...a),
  ...createHeatmapSlice(...a),
  ...createDataSlice(...a),
  ...createHistorySlice(...a),
}));
