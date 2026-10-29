import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconTrash, IconCheck } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import GoalCardBody from "./GoalCardBody";
import type { Goal } from "../../types";

const COLOR_PALETTE: string[] = [
  '#C05476', '#E3683E', '#D8BE5E', '#489160', '#6E72C3', '#A75ABA',
  '#D85675', '#DD7835', '#BCC256', '#429A8E', '#828BC2', '#957367',
  '#DA5234', '#E0963C', '#82AA57', '#4B99D2', '#AE9CCE', '#7C7C7C',
  '#D38179', '#E4B751', '#54AD7F', '#6489DF', '#A277AF', '#A3978B',
];

interface Props {
  goal: Goal;
  onEdit: (goal: Goal) => void;
}

export default function GoalCard({ goal, onEdit }: Props) {
  const t = useT();
  const { softDeleteGoal, categoryColors, updateTaskColor } = useAppStore();

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
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  // Clamp to the real rendered size (not a hardcoded estimate) after mount — see
  // context_menu_viewport_clamp memory for why a fixed guess drifts out of sync.
  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) return;
    const PADDING = 8;
    const rect = menuRef.current.getBoundingClientRect();
    let x = contextMenu.x;
    let y = contextMenu.y;
    let changed = false;
    if (x + rect.width > window.innerWidth - PADDING) {
      x = Math.max(PADDING, window.innerWidth - rect.width - PADDING);
      changed = true;
    }
    if (y + rect.height > window.innerHeight - PADDING) {
      y = Math.max(PADDING, window.innerHeight - rect.height - PADDING);
      changed = true;
    }
    if (changed) setContextMenu((prev) => (prev ? { ...prev, x, y } : prev));
  }, [contextMenu]);

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

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: categoryColors[goal.category] }}
      className={`goal-card${isDragging ? " goal-card-ghost" : ""}`}
      data-card-id={goal.id}
      onContextMenu={handleContextMenu}
      {...listeners}
      {...attributes}
    >
      <div className="goal-card-body" onClick={() => onEdit(goal)}>
        <GoalCardBody
          goal={goal}
          actions={
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
          }
        />
      </div>

      {contextMenu && createPortal(
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
        </div>,
        document.body
      )}
    </div>
  );
}
