import { useEffect, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
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
import ReminderPopup from './components/ReminderPopup';
import SettingsModal from './components/SettingsModal';
import { useReminder } from './hooks/useReminder';
import type { GoalStatus } from './types';
import './App.css';

const STATUSES: GoalStatus[] = ['todo', 'doing', 'review', 'done'];

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
  const {
    activeTab, theme, uiScale, selectedDate, selectedYear,
    loadTasks, loadGoals, seedIfEmpty,
    goals, reorderGoal, kanbanDragActiveId, setKanbanDragActiveId,
  } = useAppStore();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Dùng root font-size để scale UI. Tất cả giá trị font/icon/padding dùng rem/em
  // sẽ tự scale theo. Layout px (column width, sidebar...) giữ nguyên.
  // Cách này không ảnh hưởng hệ tọa độ DOM, nên @dnd-kit đo BCR chính xác.
  useEffect(() => {
    document.documentElement.style.fontSize = `${14 * uiScale}px`;
  }, [uiScale]);

  useEffect(() => {
    seedIfEmpty().then(() => loadTasks(selectedDate));
    checkForUpdates();
  }, []);

  useEffect(() => {
    if (activeTab === 'kanban') loadGoals(selectedYear);
  }, [activeTab]);

  function handleDragStart(event: DragStartEvent) {
    setKanbanDragActiveId(Number(event.active.id));
    setDragOverlayWidth(event.active.rect.current.initial?.width ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setKanbanDragActiveId(null);
    setDragOverlayWidth(null);
    const { active, over } = event;
    if (!over || over.id === active.id) return;

    const activeId = Number(active.id);
    const overId = over.id;

    let newStatus: GoalStatus;
    let newIndex: number;

    if (STATUSES.includes(overId as GoalStatus)) {
      // Thả vào vùng trống của cột → xuống cuối cột đó
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
      // Chèn trước/sau card đích tuỳ con trỏ nằm trên hay dưới tâm card đó
      const activeRect = active.rect.current.translated;
      const overRect = over.rect;
      const insertAfter =
        activeRect && overRect
          ? activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2
          : false;
      newIndex = (overIndex < 0 ? targetIds.length : overIndex) + (insertAfter ? 1 : 0);
    }

    reorderGoal(activeId, newStatus, newIndex);
  }

  const overlayGoal = kanbanDragActiveId
    ? (goals.find((g) => g.id === kanbanDragActiveId) ?? null)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Không còn scale wrapper — UI scale dùng native webview zoom (xem useEffect).
          @dnd-kit thấy toạ độ 1:1 nên kéo thả chính xác. */}
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
