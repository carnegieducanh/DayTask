import { IconGripVertical, IconCalendarEvent } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type { Goal, GoalStatus } from "../../types";

interface Props {
  goal: Goal;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function GoalCardOverlay({ goal }: Props) {
  const t = useT();
  const { checklistItems, theme, categoryColors } = useAppStore();
  const PROGRESS_COLOR: Record<GoalStatus, string> = {
    todo: "#888780",
    doing: theme === "dark" ? "#7ab0e0" : "#125680",
    review: "#EF9F27",
    done: "#639922",
  };
  const progressColor = PROGRESS_COLOR[goal.status];
  const items = checklistItems[goal.id] ?? [];
  const totalItems = items.length;
  const doneItems = items.filter((i) => i.is_done).length;
  const pct = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  const cardBg = hexToRgba(categoryColors[goal.category], 1);

  return (
    <div
      className="goal-card goal-card--colored goal-card-drag-overlay"
      style={{ backgroundColor: cardBg }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
        <div className="goal-drag-handle" style={{ cursor: "grabbing" }}>
          <IconGripVertical size={14} />
        </div>
        <div className="goal-card-body" style={{ flex: 1 }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span className="goal-quarter">
                <IconCalendarEvent
                  size={10}
                  style={{ verticalAlign: "middle", marginRight: 2 }}
                />
                {t.quarterShort[goal.quarter]}
              </span>
              <span
                className="priority-dot"
                style={{
                  background:
                    goal.priority === "high"
                      ? "var(--pri-high)"
                      : goal.priority === "mid"
                        ? "var(--pri-mid)"
                        : "var(--pri-low)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
