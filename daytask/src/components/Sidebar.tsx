import {
  IconChecklist,
  IconSun,
  IconCalendarStats,
  IconChartDots,
  IconMoon,
  IconSunFilled,
} from '@tabler/icons-react';
import { useAppStore } from '../store/appStore';
import type { Tab } from '../types';

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'today',   label: 'Hôm nay',   icon: <IconSun size={17} /> },
  { id: 'kanban',  label: 'Kế hoạch',  icon: <IconCalendarStats size={17} /> },
  { id: 'heatmap', label: 'Heatmap',   icon: <IconChartDots size={17} /> },
];

export default function Sidebar() {
  const { activeTab, tasks, setActiveTab, theme, toggleTheme } = useAppStore();
  const pendingCount = tasks.filter((t) => !t.is_done).length;

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="app-logo">
          <IconChecklist size={20} color="#185FA5" />
          DayTask
        </div>
      </div>

      <div className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item${activeTab === item.id ? ' active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.id === 'today' && pendingCount > 0 && (
              <span className="nav-badge">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={toggleTheme} style={{ width: '100%' }}>
          <span className="nav-icon">
            {theme === 'light' ? <IconMoon size={16} /> : <IconSunFilled size={16} />}
          </span>
          {theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
        </button>
      </div>
    </nav>
  );
}
