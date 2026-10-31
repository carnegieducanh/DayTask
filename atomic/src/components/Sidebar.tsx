import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import "./Sidebar.css";
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
  IconTelescope,
  IconMoon,
  IconSunHigh,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { useAppStore } from "../store/appStore";
import { useSmoothScrollX } from "../hooks/useSmoothScroll";
import { useT } from "../i18n";
import type { Tab } from "../types";

const TAB_ORDER: Tab[] = [
  "today",
  "calendar",
  "kanban",
  "vision",
  "projects",
  "books",
  "journal",
  "quotes",
  "heatmap",
];

export default function Sidebar() {
  const t = useT();
  const {
    activeTab,
    tasks,
    taskTimeEntries,
    setActiveTab,
    setSelectedDate,
    theme,
    toggleTheme,
    setOpenSettingsModal,
  } = useAppStore();

  const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "today",    label: t.nav.today,    icon: <IconSun size={16} stroke={1.75} /> },
    { id: "calendar", label: t.nav.calendar, icon: <IconCalendar size={16} stroke={1.75} /> },
    { id: "kanban",   label: t.nav.yearPlan, icon: <IconCalendarStats size={16} stroke={1.75} /> },
    { id: "vision",   label: t.nav.vision,   icon: <IconTelescope size={16} stroke={1.75} /> },
    { id: "projects", label: t.nav.projects, icon: <IconFolderCode size={16} stroke={1.75} /> },
    { id: "books",    label: t.nav.books,    icon: <IconBooks size={16} stroke={1.75} /> },
    { id: "journal",  label: t.nav.journal,  icon: <IconNotebook size={16} stroke={1.75} /> },
    { id: "quotes",   label: t.nav.quotes,   icon: <IconQuote size={16} stroke={1.75} /> },
    { id: "heatmap",  label: t.nav.heatmap,  icon: <IconChartDots size={16} stroke={1.75} /> },
  ];

  // Đổi theme có làm mờ dần cả app (View Transitions). Trình duyệt chụp ảnh "sau" ngay khi callback
  // chạy xong, nên phải render React đồng bộ (icon, màu heatmap tính bằng JS theo theme) và tự gắn
  // data-theme luôn — effect ở App.tsx chạy sau thời điểm chụp. Không có API thì đổi ngay như cũ.
  const switchTheme = () => {
    if (!document.startViewTransition) {
      toggleTheme();
      return;
    }
    document.startViewTransition(() => {
      flushSync(toggleTheme);
      document.documentElement.setAttribute("data-theme", useAppStore.getState().theme);
    });
  };

  // Chỉ đếm task đã xếp giờ — khớp với khối "Hôm nay" của TodayView (task còn nằm trong deck không tính)
  const pendingCount = tasks.filter(
    (t) => !t.is_done && taskTimeEntries.some((e) => e.task_id === t.id)
  ).length;

  // Ref luôn giữ giá trị activeTab mới nhất, dùng trong các effect không muốn re-subscribe mỗi lần đổi tab
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

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

  // Shift + lăn chuột (ở bất kỳ đâu trong app) → chuyển lần lượt qua các tab sidebar-nav
  useEffect(() => {
    let lastSwitch = 0;
    const handleWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 2) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastSwitch < 250) return; // debounce trackpad/wheel dồn dập
      lastSwitch = now;

      const currentIndex = TAB_ORDER.indexOf(activeTabRef.current);
      if (currentIndex === -1) return;
      const nextIndex =
        (currentIndex + (delta > 0 ? 1 : -1) + TAB_ORDER.length) % TAB_ORDER.length;
      const nextTab = TAB_ORDER[nextIndex];
      if (nextTab === "today") setSelectedDate(format(new Date(), "yyyy-MM-dd"));
      setActiveTab(nextTab);
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [setActiveTab, setSelectedDate]);

  const easeInOutCubic = (x: number) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  // Lăn chuột lên/xuống trên hàng tab (cả vùng mũi tên) → trượt ngang, mượt như dòng thời gian
  const navViewportRef = useRef<HTMLDivElement>(null);
  useSmoothScrollX(navRef, navViewportRef);

  // Lăn chuột giữa lúc mũi tên đang cuộn: dừng hiệu ứng mũi tên để 2 chuyển động không giành nhau
  const stopArrowScroll = () => {
    if (scrollAnimRef.current) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
  };

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
          <img src="/atom-icon.png" width="40" height="40" alt="Atomic" />
          Atomic
        </div>
      </div>

      {/* Nav tabs */}
      <div className="sidebar-nav-viewport" ref={navViewportRef} onWheel={stopArrowScroll}>
        <button
          className={`sidebar-nav-arrow sidebar-nav-arrow-left${canScrollLeft ? " visible" : ""}`}
          onClick={() => scrollNav(-1)}
          tabIndex={canScrollLeft ? 0 : -1}
          aria-hidden={!canScrollLeft}
        >
          <span className="sidebar-nav-arrow-icon"><IconChevronLeft size={16} stroke={1.75} /></span>
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
          <span className="sidebar-nav-arrow-icon"><IconChevronRight size={16} stroke={1.75} /></span>
        </button>
      </div>

      {/* Right side controls */}
      <div className="sidebar-footer">
        <button
          className="icon-btn"
          title={t.nav.settings}
          onClick={() => setOpenSettingsModal(true)}
        >
          <IconSettings size={16} stroke={1.75} />
        </button>
        <button
          className="icon-btn"
          title={theme === 'light' ? t.nav.darkMode : t.nav.lightMode}
          onClick={switchTheme}
        >
          {theme === 'light' ? <IconMoon size={16} stroke={1.75} /> : <IconSunHigh size={16} stroke={1.75} />}
        </button>
      </div>
    </nav>
  );
}
