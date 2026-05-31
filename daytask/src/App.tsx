import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import Sidebar from './components/Sidebar';
import TodayView from './components/today/TodayView';
import KanbanView from './components/kanban/KanbanView';
import HeatmapView from './components/heatmap/HeatmapView';
import ReminderPopup from './components/ReminderPopup';
import SettingsModal from './components/SettingsModal';
import { useReminder } from './hooks/useReminder';
import './App.css';

async function checkForUpdates() {
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (update) {
      console.log(`Update available: ${update.version}`);
      await update.downloadAndInstall();
    }
  } catch {
    // Silently ignore — running in browser or no network
  }
}

function App() {
  useReminder();
  const { activeTab, theme, uiScale, selectedDate, selectedYear, loadTasks, loadGoals, seedIfEmpty } = useAppStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    (document.documentElement.style as any).zoom = String(uiScale);
  }, [uiScale]);

  useEffect(() => {
    seedIfEmpty().then(() => loadTasks(selectedDate));
    checkForUpdates();
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
        <SettingsModal />
      </div>
    </div>
  );
}

export default App;
