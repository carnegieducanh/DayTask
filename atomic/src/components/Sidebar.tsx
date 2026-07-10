import { useEffect, useRef, useState } from "react";
import {
  IconSun,
  IconCalendarStats,
  IconChartDots,
  IconCalendar,
  IconNotebook,
  IconQuote,
  IconBooks,
  IconFolderCode,
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
    setOpenSettingsModal,
  } = useAppStore();

  const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "today",    label: t.nav.today,    icon: <IconSun size={16} /> },
    { id: "calendar", label: t.nav.calendar, icon: <IconCalendar size={16} /> },
    { id: "kanban",   label: t.nav.yearPlan, icon: <IconCalendarStats size={16} /> },
    { id: "projects", label: t.nav.projects, icon: <IconFolderCode size={16} /> },
    { id: "books",    label: t.nav.books,    icon: <IconBooks size={16} /> },
    { id: "journal",  label: t.nav.journal,  icon: <IconNotebook size={16} /> },
    { id: "quotes",   label: t.nav.quotes,   icon: <IconQuote size={16} /> },
    { id: "heatmap",  label: t.nav.heatmap,  icon: <IconChartDots size={16} /> },
  ];

  const pendingCount = tasks.filter((t) => !t.is_done).length;

  const navRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = navRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    updateScrollState();
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  // Recheck when items/labels change width (language switch, badge appearing, etc.)
  useEffect(() => {
    updateScrollState();
  }, [t, activeTab, pendingCount]);

  const scrollAnimRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, []);

  const easeInOutCubic = (x: number) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  const scrollNav = (direction: 1 | -1) => {
    const el = navRef.current;
    if (!el) return;
    if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);

    const start = el.scrollLeft;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const target = Math.max(0, Math.min(maxScroll, start + direction * el.clientWidth * 0.7));
    const distance = target - start;
    const duration = 380;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      el.scrollLeft = start + distance * easeInOutCubic(progress);
      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(step);
      } else {
        scrollAnimRef.current = null;
      }
    };
    scrollAnimRef.current = requestAnimationFrame(step);
  };

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div
        className="sidebar-header"
        onClick={() => {
          setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
          setActiveTab('today');
        }}
      >
        <div className="app-logo">
          <img src="/atom-icon.svg" width="30" height="30" alt="Atomic" />
          Atomic
        </div>
      </div>

      {/* Nav tabs */}
      <div className="sidebar-nav-viewport">
        <button
          className={`sidebar-nav-arrow sidebar-nav-arrow-left${canScrollLeft ? " visible" : ""}`}
          onClick={() => scrollNav(-1)}
          tabIndex={canScrollLeft ? 0 : -1}
          aria-hidden={!canScrollLeft}
        >
          <span className="sidebar-nav-arrow-icon"><IconChevronLeft size={16} /></span>
        </button>
        <div className="sidebar-nav" ref={navRef}>
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
                <span className="nav-badge">{pendingCount > 9 ? "9+" : pendingCount}</span>
              )}
            </button>
          ))}
        </div>
        <button
          className={`sidebar-nav-arrow sidebar-nav-arrow-right${canScrollRight ? " visible" : ""}`}
          onClick={() => scrollNav(1)}
          tabIndex={canScrollRight ? 0 : -1}
          aria-hidden={!canScrollRight}
        >
          <span className="sidebar-nav-arrow-icon"><IconChevronRight size={16} /></span>
        </button>
      </div>

      {/* Right side controls */}
      <div className="sidebar-footer">
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
