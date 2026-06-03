import {
  IconSun,
  IconCalendarStats,
  IconChartDots,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconSettings,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { useAppStore } from "../store/appStore";
import { useT } from "../i18n";
import type { Tab } from "../types";

export default function Sidebar() {
  const t = useT();
  const {
    activeTab,
    tasks,
    setActiveTab,
    setSelectedDate,
    theme,
    toggleTheme,
    selectedYear,
    setSelectedYear,
    setOpenSettingsModal,
  } = useAppStore();

  const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "today",    label: t.nav.today,    icon: <IconSun size={16} /> },
    { id: "calendar", label: t.nav.calendar, icon: <IconCalendar size={16} /> },
    { id: "kanban",   label: t.nav.yearPlan, icon: <IconCalendarStats size={16} /> },
    { id: "heatmap",  label: t.nav.heatmap,  icon: <IconChartDots size={16} /> },
  ];

  const pendingCount = tasks.filter((t) => !t.is_done).length;

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div className="app-logo">
          <img src="/atom-icon.svg" width="30" height="30" alt="Atomic" />
          Atomic
        </div>
      </div>

      {/* Nav tabs */}
      <div className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item${activeTab === item.id ? " active" : ""}`}
            onClick={() => {
              if (item.id === 'today') setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
              setActiveTab(item.id);
            }}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.id === "today" && pendingCount > 0 && (
              <span className="nav-badge">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Right side controls */}
      <div className="sidebar-footer">
        {activeTab === "kanban" && (
          <>
            <div className="year-pill">
              <button
                className="icon-btn"
                style={{ border: "none" }}
                onClick={() => setSelectedYear(selectedYear - 1)}
                title={t.nav.prevYear}
              >
                <IconChevronLeft size={14} />
              </button>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  minWidth: 36,
                  textAlign: "center",
                }}
              >
                {selectedYear}
              </span>
              <button
                className="icon-btn"
                style={{ border: "none" }}
                onClick={() => setSelectedYear(selectedYear + 1)}
                title={t.nav.nextYear}
              >
                <IconChevronRight size={14} />
              </button>
            </div>
          </>
        )}
        <button
          className="icon-btn"
          title={t.nav.settings}
          onClick={() => setOpenSettingsModal(true)}
        >
          <IconSettings size={16} />
        </button>
        <button className="nav-item" onClick={toggleTheme}>
          <span className="nav-icon">◐</span>
          {theme === 'light' ? t.nav.darkMode : t.nav.lightMode}
        </button>
      </div>
    </nav>
  );
}
