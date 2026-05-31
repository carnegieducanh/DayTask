import {
  IconChecklist,
  IconSun,
  IconCalendarStats,
  IconChartDots,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconSearch,
  IconPlus,
  IconSettings,
} from '@tabler/icons-react';
import { useAppStore } from '../store/appStore';
import type { Tab } from '../types';

const THEME_LABEL: Record<string, string> = {
  light: '☽  Dark mode',
  dark:  '☼  Light mode',
};

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'today',   label: 'Hôm nay',      icon: <IconSun size={16} /> },
  { id: 'kanban',  label: 'Kế hoạch năm', icon: <IconCalendarStats size={16} /> },
  { id: 'heatmap', label: 'Heatmap',       icon: <IconChartDots size={16} /> },
];

export default function Sidebar() {
  const {
    activeTab, tasks, setActiveTab, theme, toggleTheme,
    selectedYear, setSelectedYear, setOpenAddGoalModal, setOpenSettingsModal,
  } = useAppStore();

  const pendingCount = tasks.filter((t) => !t.is_done).length;

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div className="app-logo">
          <IconChecklist size={20} color="#125680" />
          DayTask
        </div>
      </div>

      {/* Nav tabs */}
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

      {/* Right side controls */}
      <div className="sidebar-footer">
        {activeTab === 'kanban' && (
          <>
            <div className="year-pill">
              <button
                className="icon-btn"
                style={{ border: 'none' }}
                onClick={() => setSelectedYear(selectedYear - 1)}
                title="Năm trước"
              >
                <IconChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 500, minWidth: 36, textAlign: 'center' }}>
                {selectedYear}
              </span>
              <button
                className="icon-btn"
                style={{ border: 'none' }}
                onClick={() => setSelectedYear(selectedYear + 1)}
                title="Năm sau"
              >
                <IconChevronRight size={14} />
              </button>
            </div>
            <button className="icon-btn" title="Lọc"><IconFilter size={16} /></button>
            <button className="icon-btn" title="Tìm kiếm"><IconSearch size={16} /></button>
            <button
              className="icon-btn"
              title="Thêm mục tiêu"
              onClick={() => setOpenAddGoalModal(true)}
            >
              <IconPlus size={16} />
            </button>
          </>
        )}
        <button
          className="icon-btn"
          title="Cài đặt"
          onClick={() => setOpenSettingsModal(true)}
        >
          <IconSettings size={16} />
        </button>
        <button className="nav-item" onClick={toggleTheme}>
          <span className="nav-icon">◐</span>
          {THEME_LABEL[theme]}
        </button>
      </div>
    </nav>
  );
}
