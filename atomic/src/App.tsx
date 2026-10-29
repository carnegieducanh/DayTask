import { useEffect, useRef, useState } from 'react';
// Must load before any component's own CSS import below: App.css holds the shared/base
// rules (.view-topbar, .modal, etc.) that feature CSS files are meant to override via
// later cascade position, same relative order as the original single-file App.css.
import './App.css';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from './store/mockDb';
import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  DroppableContainer,
  Over,
  PointerSensor,
  UniqueIdentifier,
  useSensor,
  useSensors,
  closestCorners,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { useAppStore } from './store/appStore';
import Sidebar from './components/Sidebar';
import TodayView from './components/today/TodayView';
import KanbanView from './components/kanban/KanbanView';
import GoalCardOverlay from './components/kanban/GoalCardOverlay';
import HeatmapView from './components/heatmap/HeatmapView';
import CalendarView from './components/calendar/CalendarView';
import JournalView from './components/journal/JournalView';
import QuotesView from './components/quotes/QuotesView';
import BooksView from './components/books/BooksView';
import ProjectsView from './components/projects/ProjectsView';
import VisionView from './components/vision/VisionView';
import ReminderPopup from './components/ReminderPopup';
import DeleteToast from './components/DeleteToast';
import UndoToast from './components/UndoToast';
import SettingsModal from './components/SettingsModal';
import UpdateDialog from './components/UpdateDialog';
import { useReminder } from './hooks/useReminder';
import type { Goal, GoalStatus } from './types';

const STATUSES: GoalStatus[] = ['todo', 'doing', 'done'];

function isColumnId(id: UniqueIdentifier): id is GoalStatus {
  return STATUSES.includes(id as GoalStatus);
}

// Chọn cột trước theo vị trí ngang của thẻ kéo, rồi closestCorners trong riêng cột
// đó. Dùng closestCorners trên toàn bảng thì khi thẻ kéo nằm giữa 2 cột, chuyển
// thẻ sang cột này làm thẻ cột kia trồi lên gần hơn → over nhảy qua lại giữa 2 cột
// không dừng (Maximum update depth exceeded, bảng trắng). Các cột không xê dịch khi
// thẻ đổi chỗ nên chọn cột theo trục ngang luôn ổn định.
const kanbanCollision: CollisionDetection = (args) => {
  const { collisionRect, droppableContainers, droppableRects } = args;
  const cx = collisionRect.left + collisionRect.width / 2;
  let column: DroppableContainer | null = null;
  let best = Infinity;
  for (const c of droppableContainers) {
    const r = droppableRects.get(c.id);
    if (!isColumnId(c.id) || !r) continue;
    const dist = cx < r.left ? r.left - cx : cx > r.right ? cx - r.right : 0;
    if (dist < best) { best = dist; column = c; }
  }
  const colNode = column?.node.current;
  if (!column || !colNode) return closestCorners(args);
  const inColumn = droppableContainers.filter(
    (c) => c.id === column.id || (c.node.current !== null && colNode.contains(c.node.current)),
  );
  return closestCorners({ ...args, droppableContainers: inColumn });
};

// Thứ tự id của 1 cột — giống cách KanbanView sắp thẻ (theo position)
function columnIds(list: Goal[], status: GoalStatus): number[] {
  return list
    .filter((g) => g.status === status)
    .sort((a, b) => a.position - b.position)
    .map((g) => g.id);
}

// Đưa thẻ tới vị trí `index` của cột `status` rồi đánh số lại position cho cột
// đích (và cột nguồn) — KanbanView sắp theo position nên phải đánh số lại thì
// bản xem trước mới hiện đúng chỗ chèn.
function moveGoal(list: Goal[], activeId: number, status: GoalStatus, index: number): Goal[] {
  const active = list.find((g) => g.id === activeId);
  if (!active) return list;
  const dest = columnIds(list, status).filter((id) => id !== activeId);
  dest.splice(Math.max(0, Math.min(index, dest.length)), 0, activeId);
  const next = new Map<number, Pick<Goal, 'status' | 'position'>>();
  dest.forEach((id, i) => next.set(id, { status, position: i }));
  if (active.status !== status) {
    columnIds(list, active.status)
      .filter((id) => id !== activeId)
      .forEach((id, i) => next.set(id, { status: active.status, position: i }));
  }
  return list.map((g) => (next.has(g.id) ? { ...g, ...next.get(g.id)! } : g));
}

// Thẻ sẽ nằm ở đâu (cột + chỉ số cuối cùng trong cột) nếu thả ngay lúc này,
// tính trên bố cục đang hiển thị `list`:
//  - không có over / over là chính nó → giữ nguyên chỗ đang hiện
//  - over là thẻ CÙNG cột → chiếm đúng chỗ thẻ đó (arrayMove), khớp với
//    verticalListSortingStrategy. Trước đây so tâm 2 thẻ: closestCorners đổi over
//    ngay khi kéo được nửa ô, còn tâm thì phải qua hết 1 ô → bản xem trước đã đổi
//    chỗ nhưng thả ra thẻ quay về chỗ cũ.
//  - over là thẻ khác cột → chèn trên/dưới tuỳ mép trên thẻ kéo đã qua giữa thẻ đó chưa
//  - over là thân cột (khoảng trống) → cuối cột
function resolveDropTarget(
  list: Goal[],
  activeId: number,
  over: Over | null,
  activeTop: number | null,
): { status: GoalStatus; index: number } | null {
  const current = list.find((g) => g.id === activeId);
  if (!current) return null;
  if (!over || over.id === activeId) {
    return { status: current.status, index: columnIds(list, current.status).indexOf(activeId) };
  }
  if (isColumnId(over.id)) {
    return { status: over.id, index: columnIds(list, over.id).filter((id) => id !== activeId).length };
  }
  const overGoal = list.find((g) => g.id === Number(over.id));
  if (!overGoal) return null;
  const ids = columnIds(list, overGoal.status);
  const overIndex = ids.indexOf(overGoal.id);
  if (overGoal.status === current.status) return { status: current.status, index: overIndex };
  const below = activeTop !== null && activeTop > over.rect.top + over.rect.height / 2;
  return { status: overGoal.status, index: overIndex + (below ? 1 : 0) };
}

function hexToSecondary(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const newL = Math.min(l + 0.22, 0.82);
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let or: number, og: number, ob: number;
  if (s === 0) { or = og = ob = newL; }
  else {
    const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s;
    const p = 2 * newL - q;
    or = hue2rgb(p, q, h + 1/3); og = hue2rgb(p, q, h); ob = hue2rgb(p, q, h - 1/3);
  }
  const toH = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toH(or)}${toH(og)}${toH(ob)}`;
}

function App() {
  useReminder();
  const {
    activeTab, theme, uiScale, language, accentColor, customAccentColor, selectedDate, selectedYear,
    loadTasks, loadGoals, loadCategoryColors, loadTags, initAutostart,
    goals, reorderGoal, kanbanDragActiveId, setKanbanDragActiveId,
    backgroundEnabled, backgroundOpacity, backgroundImageUrl, loadBackgroundImage, uiTransparency,
    undoLastAction,
  } = useAppStore();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | null>(null);
  // Visual-only goals list during drag: moves active card to destination column for sort animation.
  // Ref đi kèm vì onDragOver/onDragEnd có thể chạy trước khi setLiveGoals kịp render.
  const [liveGoals, setLiveGoals] = useState<Goal[] | null>(null);
  const liveGoalsRef = useRef<Goal[] | null>(null);

  // Auto-update state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateRef = useRef<any>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (isTauri()) {
      getCurrentWindow().setTheme(theme === 'dark' ? 'dark' : 'light').catch(() => {});
    }
  }, [theme]);

  useEffect(() => {
    const accentMap: Record<string, string> = {
      orange: '#DA7756',
      green:  '#1D9E75',
      purple: '#7F77DD',
      red:    '#E24B4A',
      yellow: '#EF9F27',
    };
    // Lighter variant of each accent — used as journal secondary color (Bài học view)
    const accentSecondaryMap: Record<string, string> = {
      blue:   '#5B9FD6',
      orange: '#EFA884',
      green:  '#52C4A0',
      purple: '#ABA5EC',
      red:    '#EF8080',
      yellow: '#F5C06A',
    };
    if (accentColor === 'custom') {
      document.documentElement.style.setProperty('--primary', customAccentColor);
      document.documentElement.style.setProperty('--journal-secondary', hexToSecondary(customAccentColor));
    } else if (accentMap[accentColor]) {
      document.documentElement.style.setProperty('--primary', accentMap[accentColor]);
      document.documentElement.style.setProperty('--journal-secondary', accentSecondaryMap[accentColor] ?? '#5B9FD6');
    } else {
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.setProperty('--journal-secondary', '#5B9FD6');
    }
  }, [accentColor, customAccentColor]);

  useEffect(() => {
    document.documentElement.setAttribute('data-lang', language);
  }, [language]);

  useEffect(() => {
    loadBackgroundImage();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('has-bg-image', backgroundEnabled && !!backgroundImageUrl);
  }, [backgroundEnabled, backgroundImageUrl]);

  // "UI transparency" slider (0-100): 0 keeps the original glass panel look
  // (alpha 0.9 / blur 20px / saturate 180%), 100 removes the panel filter
  // entirely (alpha 0 / blur 0 / saturate 100%) so the wallpaper shows at
  // full clarity with its original colors. All three scale together — the
  // saturate boost previously stayed hard-coded at 180% even at t=1, which
  // made the wallpaper look more vivid than the source file no matter how
  // high both sliders were set.
  useEffect(() => {
    const t = uiTransparency / 100;
    const alpha = 0.9 * (1 - t);
    const blur = 20 * (1 - t);
    const saturate = 180 - 80 * t;
    document.documentElement.style.setProperty('--bg-glass-panel-alpha', alpha.toFixed(2));
    document.documentElement.style.setProperty('--bg-glass-blur', `${blur.toFixed(1)}px`);
    document.documentElement.style.setProperty('--bg-glass-saturate', `${saturate.toFixed(0)}%`);
  }, [uiTransparency]);

  // Dùng root font-size để scale UI. Tất cả giá trị font/icon/padding dùng rem/em
  // sẽ tự scale theo. Layout px (column width, sidebar...) giữ nguyên.
  // Cách này không ảnh hưởng hệ tọa độ DOM, nên @dnd-kit đo BCR chính xác.
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * uiScale}px`;
  }, [uiScale]);

  useEffect(() => {
    loadTasks(selectedDate);
    loadCategoryColors();
    loadTags();
    initAutostart().catch(() => {});
    // Check for updates after a short delay to not block initial render
    setTimeout(async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update?.available) {
          updateRef.current = update;
          setUpdateVersion(update.version);
        }
      } catch {
        // Running in browser or offline — ignore
      }
    }, 3000);
  }, []);

  useEffect(() => {
    if (activeTab === 'kanban') loadGoals(selectedYear);
  }, [activeTab]);

  // Ctrl+Z toàn app: hoàn tác thao tác gần nhất (task/goal/tag — xem historySlice.ts).
  // Bỏ qua khi đang gõ trong input/textarea/contentEditable để không đè lên
  // undo gõ chữ mặc định của trình duyệt (vd. đang sửa tên task inline).
  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key !== 'z' && e.key !== 'Z') return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      undoLastAction();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoLastAction]);

  async function handleInstallUpdate() {
    const update = updateRef.current;
    if (!update) return;
    setUpdateDownloading(true);
    setUpdateProgress(null);
    let downloaded = 0;
    let contentLength = 0;
    try {
      await update.downloadAndInstall((event: { event: string; data: { contentLength?: number; chunkLength?: number } }) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength ?? 0;
          if (contentLength > 0) setUpdateProgress((downloaded / contentLength) * 100);
        }
      });
    } catch {
      setUpdateDownloading(false);
      setUpdateProgress(null);
    }
  }

  function setLive(next: Goal[] | null) {
    liveGoalsRef.current = next;
    setLiveGoals(next);
  }

  function resetDrag() {
    setKanbanDragActiveId(null);
    setDragOverlayWidth(null);
    setLive(null);
  }

  function handleDragStart(event: DragStartEvent) {
    setKanbanDragActiveId(Number(event.active.id));
    setDragOverlayWidth(event.active.rect.current.initial?.width ?? null);
    setLive(null);
  }

  // Chỉ đổi bố cục khi thẻ sang cột khác (hoặc rơi vào khoảng trống của cột).
  // Đảo thứ tự trong cùng cột để verticalListSortingStrategy tự xem trước.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || over.id === active.id) return;

    const activeId = Number(active.id);
    const list = liveGoalsRef.current ?? goals;
    const current = list.find((g) => g.id === activeId);
    if (!current) return;
    if (!isColumnId(over.id) && list.find((g) => g.id === Number(over.id))?.status === current.status) return;

    const target = resolveDropTarget(list, activeId, over, active.rect.current.translated?.top ?? null);
    if (!target) return;
    if (target.status === current.status && target.index === columnIds(list, current.status).indexOf(activeId)) return;
    setLive(moveGoal(list, activeId, target.status, target.index));
  }

  // Thả đúng chỗ đang hiển thị: tính trên bố cục xem trước (liveGoals), không phải goals gốc
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeId = Number(active.id);
    const list = liveGoalsRef.current ?? goals;
    const target = resolveDropTarget(list, activeId, over, active.rect.current.translated?.top ?? null);
    resetDrag();
    if (!target) return;

    const original = goals.find((g) => g.id === activeId);
    if (!original) return;
    if (target.status === original.status && target.index === columnIds(goals, original.status).indexOf(activeId)) return;
    reorderGoal(activeId, target.status, target.index);
  }

  const overlayGoal = kanbanDragActiveId
    ? (goals.find((g) => g.id === kanbanDragActiveId) ?? null)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollision}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDrag}
    >
      {backgroundEnabled && backgroundImageUrl && (
        <div
          className="app-bg-image-layer"
          style={{ backgroundImage: `url(${backgroundImageUrl})`, opacity: backgroundOpacity / 100 }}
        />
      )}

      {/* Không còn scale wrapper — UI scale dùng native webview zoom (xem useEffect).
          @dnd-kit thấy toạ độ 1:1 nên kéo thả chính xác. */}
      <div className="app-shell">
        <Sidebar />
        <div className="main-wrap" style={{ position: 'relative' }}>
          {activeTab === 'today' && <TodayView />}
          {activeTab === 'kanban' && <KanbanView liveGoals={liveGoals} />}
          {activeTab === 'vision' && <VisionView />}
          {activeTab === 'heatmap' && <HeatmapView />}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'journal' && <JournalView />}
          {activeTab === 'quotes' && <QuotesView />}
          {activeTab === 'books' && <BooksView />}
          {activeTab === 'projects' && <ProjectsView />}
          <ReminderPopup />
          <DeleteToast />
          <UndoToast />
        </div>
      </div>

      {/* SettingsModal/UpdateDialog render ở đây, KHÔNG bên trong .main-wrap:
          .main-wrap nhận backdrop-filter khi html.has-bg-image (xem App.css),
          và backdrop-filter tạo containing block mới cho position:fixed —
          nếu modal nằm bên trong, nó sẽ tự center lại theo box .main-wrap
          (thay vì viewport) mỗi khi bật/tắt background, gây hiện tượng
          modal nhảy lên/xuống lúc toggle. */}
      <SettingsModal />
      {updateVersion && (
        <UpdateDialog
          version={updateVersion}
          downloading={updateDownloading}
          progress={updateProgress}
          onConfirm={handleInstallUpdate}
          onDismiss={() => setUpdateVersion(null)}
        />
      )}

      {/* DragOverlay: không scale content nữa. Webview zoom đã phóng to mọi thứ,
          BCR của card gốc trả về kích thước đúng → overlay khớp 1:1. */}
      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: 'ease',
          sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: '0.4' } },
          }),
        }}
      >
        {overlayGoal ? (
          <div style={{ width: dragOverlayWidth ?? undefined }}>
            <GoalCardOverlay goal={overlayGoal} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
