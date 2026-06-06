import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconTrash, IconCalendarEvent, IconCheck } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type { Goal, GoalStatus } from "../../types";

const COLOR_PALETTE: string[] = [
  '#C05476', '#E3683E', '#D8BE5E', '#489160', '#6E72C3', '#A75ABA',
  '#D85675', '#DD7835', '#BCC256', '#429A8E', '#828BC2', '#957367',
  '#DA5234', '#E0963C', '#82AA57', '#4B99D2', '#AE9CCE', '#7C7C7C',
  '#D38179', '#E4B751', '#54AD7F', '#6489DF', '#A277AF', '#A3978B',
];

const PROGRESS_COLOR: Record<GoalStatus, string> = {
  todo: "#888780",
  doing: "#3B9FE8",
  review: "#EF9F27",
  done: "#639922",
};

interface Props {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  status: GoalStatus;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function GoalCard({ goal, onEdit, status }: Props) {
  const t = useT();
  const { softDeleteGoal, checklistItems, categoryColors, updateTaskColor } = useAppStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    function handleClose(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null);
    }
    window.addEventListener('mousedown', handleClose);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClose);
      window.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const MENU_W = 180;
    const MENU_H = 170;
    let x = e.clientX;
    let y = e.clientY;
    if (x + MENU_W > window.innerWidth) x = window.innerWidth - MENU_W - 8;
    if (y + MENU_H > window.innerHeight) y = window.innerHeight - MENU_H - 8;
    setContextMenu({ x, y });
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: undefined,
  };

  const progressColor = PROGRESS_COLOR[status];
  const cardBg = hexToRgba(categoryColors[goal.category], 1);
  const items = checklistItems[goal.id] ?? [];
  const totalItems = items.length;
  const doneItems = items.filter((i) => i.is_done).length;
  const pct = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: cardBg }}
      className={`goal-card goal-card--colored${isDragging ? " goal-card-ghost" : ""}`}
      data-card-id={goal.id}
      onContextMenu={handleContextMenu}
      {...listeners}
      {...attributes}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
        <div
          className="goal-card-body"
          style={{ flex: 1 }}
          onClick={() => onEdit(goal)}
        >
          <div className="goal-title">{goal.title}</div>
          {goal.description && (
            <div className="goal-desc">{goal.description}</div>
          )}

          {totalItems > 0 && (
            <div className="goal-checklist-progress">
              <div className="goal-progress-wrap" style={{ flex: 1 }}>
                <div
                  className="goal-progress-fill"
                  style={{ width: `${pct}%`, background: progressColor }}
                />
              </div>
              <span
                className="goal-progress-xy"
                style={{ color: progressColor }}
              >
                {doneItems}/{totalItems}
              </span>
            </div>
          )}

          <div className="goal-meta">
            <span className={`tag tag-${goal.category}`}>
              {t.cat[goal.category]}
            </span>
            <span className="goal-quarter">
              <IconCalendarEvent
                size={10}
                style={{ verticalAlign: "middle", marginRight: 2 }}
              />
              {t.quarterShort[goal.quarter]}
            </span>
          </div>
        </div>

        <button
          className="icon-btn goal-card-delete"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            softDeleteGoal(goal.id);
          }}
          title={t.kanban.deleteGoal}
        >
          <IconTrash size={14} />
        </button>
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className="task-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          <button
            className="day-context-item day-context-item-danger"
            onClick={() => { softDeleteGoal(goal.id); setContextMenu(null); }}
          >
            <IconTrash size={16} />
            {t.kanban.deleteGoal}
          </button>
          <div className="task-context-divider" />
          <div className="task-context-colors">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                className="task-context-color-btn"
                style={{ backgroundColor: color }}
                onClick={() => { updateTaskColor(goal.category, color); setContextMenu(null); }}
                title={color}
              >
                {categoryColors[goal.category] === color && (
                  <IconCheck size={12} color="white" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
