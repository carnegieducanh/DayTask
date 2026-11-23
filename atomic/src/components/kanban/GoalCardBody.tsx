import type { ReactNode } from "react";
import { IconCheck } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import { quarterSpan } from "../../utils/quarterUtils";
import type { Goal } from "../../types";

interface Props {
  goal: Goal;
  /** Nút hành động hiện khi hover (vd. xóa) — overlay lúc kéo không có. */
  actions?: ReactNode;
}

// Nội dung thẻ mục tiêu, dùng chung cho GoalCard (trên bảng) và GoalCardOverlay (lúc kéo)
// để hai bản không lệch nhau.
export default function GoalCardBody({ goal, actions }: Props) {
  const t = useT();
  const { checklistItems } = useAppStore();

  const items = checklistItems[goal.id] ?? [];
  const totalItems = items.length;
  const doneItems = items.filter((i) => i.is_done).length;
  const pct = totalItems === 0 ? 0 : (doneItems / totalItems) * 100;

  const quarterLabel = goal.quarters.includes("full")
    ? t.quarter.full
    : t.kanban.quarterSpan(quarterSpan(goal.quarters, (q) => t.kanban.quarterNum[q]));

  // Bố cục gọn (2026-11-23): tiêu đề lên đầu, mô tả 1 dòng, nhãn danh mục + quý + checklist
  // gom chung một hàng chân — để cột nhiều thẻ đỡ phải cuộn.
  return (
    <>
      <div className="goal-card-top">
        <div className="goal-title">{goal.title}</div>
        {actions}
        {goal.status === "done" && (
          <span className="goal-seal" title={t.kanban.completed} aria-label={t.kanban.completed}>
            <IconCheck size={12} stroke={2.2} />
          </span>
        )}
      </div>
      {goal.description && <div className="goal-desc">{goal.description}</div>}
      <div className="goal-foot">
        <span className="tag goal-cat">{t.cat[goal.category]}</span>
        <span className="goal-quarter">{quarterLabel}</span>
        {totalItems > 0 && (
          <span className="goal-check">
            <span className="goal-check-track">
              <span className="goal-check-fill" style={{ width: `${pct}%` }} />
            </span>
            {doneItems} / {totalItems}
          </span>
        )}
      </div>
    </>
  );
}
