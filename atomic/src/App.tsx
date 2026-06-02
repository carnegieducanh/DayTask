import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
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
import ReminderPopup from './components/ReminderPopup';
import DeleteToast from './components/DeleteToast';
import SettingsModal from './components/SettingsModal';
import UpdateDialog from './components/UpdateDialog';
import { useReminder } from './hooks/useReminder';
import type { Goal, GoalStatus } from './types';
import './App.css';

const STATUSES: GoalStatus[] = ['todo', 'doing', 'review', 'done'];

function App() {
  useReminder();
  const {
    activeTab, theme, uiScale, language, selectedDate, selectedYear,
    loadTasks, loadGoals, loadCategoryColors,
    goals, reorderGoal, kanbanDragActiveId, setKanbanDragActiveId,
  } = useAppStore();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | null>(null);
  // Visual-only goals list during drag: moves active card to destination column for sort animation
  const [liveGoals, setLiveGoals] = useState<Goal[] | null>(null);

  // Auto-update state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateRef = useRef<any>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-lang', language);
  }, [language]);

  // Dùng root font-size để scale UI. Tất cả giá trị font/icon/padding dùng rem/em
  // sẽ tự scale theo. Layout px (column width, sidebar...) giữ nguyên.
  // Cách này không ảnh hưởng hệ tọa độ DOM, nên @dnd-kit đo BCR chính xác.
  useEffect(() => {
    document.documentElement.style.fontSize = `${14 * uiScale}px`;
  }, [uiScale]);

  useEffect(() => {
    loadTasks(selectedDate);
    loadCategoryColors();
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

  function handleDragStart(event: DragStartEvent) {
    setKanbanDragActiveId(Number(event.active.id));
    setDragOverlayWidth(event.active.rect.current.initial?.width ?? null);
    setLiveGoals(null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || over.id === active.id) return;

    const activeId = Number(active.id);
    const activeGoal = goals.find((g) => g.id === activeId);
    if (!activeGoal) return;

    // Determine which column the cursor is over
    let destStatus: GoalStatus;
    if (STATUSES.includes(over.id as GoalStatus)) {
      destStatus = over.id as GoalStatus;
    } else {
      const overGoal = goals.find((g) => g.id === Number(over.id));
      if (!overGoal) return;
      destStatus = overGoal.status;
    }

    if (destStatus === activeGoal.status) {
      // Hovering back over original column — reset to let native sort handle it
      setLiveGoals(null);
      return;
    }

    // Build live goals: remove active from source, insert into destination
    const withoutActive = goals.filter((g) => g.id !== activeId);
    const destGoals = withoutActive
      .filter((g) => g.status === destStatus)
      .sort((a, b) => a.position - b.position);

    let insertIndex: number;
    if (STATUSES.includes(over.id as GoalStatus)) {
      insertIndex = destGoals.length;
    } else {
      const overIndex = destGoals.findIndex((g) => g.id === Number(over.id));
      const isBelowOverItem =
        active.rect.current.translated &&
        active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
      insertIndex = overIndex >= 0 ? overIndex + (isBelowOverItem ? 1 : 0) : destGoals.length;
    }

    const movedGoal = { ...activeGoal, status: destStatus };
    setLiveGoals([
      ...withoutActive.filter((g) => g.status !== destStatus),
      ...destGoals.slice(0, insertIndex),
      movedGoal,
      ...destGoals.slice(insertIndex),
    ]);
  }

  function handleDragEnd(event: DragEndEvent) {
    setKanbanDragActiveId(null);
    setDragOverlayWidth(null);
    setLiveGoals(null);
    const { active, over } = event;
    const activeId = Number(active.id);

    // Normal path: dnd-kit gave a clear, non-self target
    if (over && over.id !== active.id) {
      const overId = over.id;
      let newStatus: GoalStatus;
      let newIndex: number;

      if (STATUSES.includes(overId as GoalStatus)) {
        newStatus = overId as GoalStatus;
        newIndex = goals.filter((g) => g.status === newStatus && g.id !== activeId).length;
      } else {
        const overGoal = goals.find((g) => g.id === Number(overId));
        if (!overGoal) return;
        newStatus = overGoal.status;
        const targetIds = goals
          .filter((g) => g.status === newStatus && g.id !== activeId)
          .sort((a, b) => a.position - b.position)
          .map((g) => g.id);
        const overIndex = targetIds.indexOf(Number(overId));
        const activeRect = active.rect.current.translated;
        const insertAfter =
          activeRect
            ? activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2
            : false;
        newIndex = (overIndex < 0 ? targetIds.length : overIndex) + (insertAfter ? 1 : 0);
      }
      reorderGoal(activeId, newStatus, newIndex);
      return;
    }

    // Fast-drag fallback: over is null or collision picked the active card itself.
    // Use the overlay's final screen position to determine target column and index.
    const overlayRect = active.rect.current.translated;
    if (!overlayRect) return;

    const cx = overlayRect.left + overlayRect.width / 2;
    const cy = overlayRect.top + overlayRect.height / 2;

    // Find the nearest column by horizontal distance
    let targetStatus: GoalStatus | null = null;
    let minDist = Infinity;
    for (const status of STATUSES) {
      const colEl = document.querySelector<HTMLElement>(`[data-kanban-col="${status}"]`);
      if (!colEl) continue;
      const r = colEl.getBoundingClientRect();
      const dist = Math.abs(cx - (r.left + r.width / 2));
      if (dist < minDist) { minDist = dist; targetStatus = status; }
    }
    if (!targetStatus) return;

    const colEl = document.querySelector<HTMLElement>(`[data-kanban-col="${targetStatus}"]`);
    if (!colEl) return;

    // Find insert index by comparing overlay center Y to each card's midpoint
    const cardEls = colEl.querySelectorAll<HTMLElement>('[data-card-id]');
    const colGoals = goals
      .filter((g) => g.status === targetStatus && g.id !== activeId)
      .sort((a, b) => a.position - b.position);
    let newIndex = colGoals.length;
    let validIdx = 0;
    for (const cardEl of cardEls) {
      if (Number(cardEl.getAttribute('data-card-id')) === activeId) continue;
      const r = cardEl.getBoundingClientRect();
      if (cy < r.top + r.height / 2) { newIndex = validIdx; break; }
      validIdx++;
    }

    reorderGoal(activeId, targetStatus, newIndex);
  }

  const overlayGoal = kanbanDragActiveId
    ? (goals.find((g) => g.id === kanbanDragActiveId) ?? null)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Không còn scale wrapper — UI scale dùng native webview zoom (xem useEffect).
          @dnd-kit thấy toạ độ 1:1 nên kéo thả chính xác. */}
      <div className="app-shell">
        <Sidebar />
        <div className="main-wrap" style={{ position: 'relative' }}>
          {activeTab === 'today' && <TodayView />}
          {activeTab === 'kanban' && <KanbanView liveGoals={liveGoals} />}
          {activeTab === 'heatmap' && <HeatmapView />}
          {activeTab === 'calendar' && <CalendarView />}
          <ReminderPopup />
          <DeleteToast />
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
        </div>
      </div>

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
