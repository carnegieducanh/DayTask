import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import Sidebar from './components/Sidebar';
import TodayView from './components/today/TodayView';
import KanbanView from './components/kanban/KanbanView';
import HeatmapView from './components/heatmap/HeatmapView';
import ReminderPopup from './components/ReminderPopup';
import { useReminder } from './hooks/useReminder';
import './App.css';

function App() {
  useReminder();
  const { activeTab, theme, selectedDate, selectedYear, loadTasks, loadGoals } = useAppStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    loadTasks(selectedDate);
  }, []);

  useEffect(() => {
    if (activeTab === 'kanban') loadGoals(selectedYear);
  }, [activeTab]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-wrap" style={{ position: 'relative' }}>
        {activeTab === 'today' && <TodayView />}
        {activeTab === 'kanban' && <KanbanView />}
        {activeTab === 'heatmap' && <HeatmapView />}
        <ReminderPopup />
      </div>
    </div>
  );
}

export default App;
