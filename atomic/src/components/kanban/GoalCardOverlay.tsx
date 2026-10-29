import { useAppStore } from "../../store/appStore";
import GoalCardBody from "./GoalCardBody";
import type { Goal } from "../../types";

interface Props {
  goal: Goal;
}

export default function GoalCardOverlay({ goal }: Props) {
  const { categoryColors } = useAppStore();

  return (
    <div
      className="goal-card goal-card-drag-overlay"
      style={{ backgroundColor: categoryColors[goal.category] }}
    >
      <div className="goal-card-body">
        <GoalCardBody goal={goal} />
      </div>
    </div>
  );
}
