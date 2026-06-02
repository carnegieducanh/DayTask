import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';

const TOAST_DURATION = 4000;

export default function DeleteToast() {
  const t = useT();
  const {
    pendingDeleteTask, undoDeleteTask, confirmDeleteTask,
    pendingDeleteGoal, undoDeleteGoal, confirmDeleteGoal,
  } = useAppStore();
  const taskTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (taskTimerRef.current) clearTimeout(taskTimerRef.current);
    if (!pendingDeleteTask) return;
    taskTimerRef.current = setTimeout(() => {
      confirmDeleteTask(pendingDeleteTask);
    }, TOAST_DURATION);
    return () => { if (taskTimerRef.current) clearTimeout(taskTimerRef.current); };
  }, [pendingDeleteTask]);

  useEffect(() => {
    if (goalTimerRef.current) clearTimeout(goalTimerRef.current);
    if (!pendingDeleteGoal) return;
    goalTimerRef.current = setTimeout(() => {
      confirmDeleteGoal(pendingDeleteGoal);
    }, TOAST_DURATION);
    return () => { if (goalTimerRef.current) clearTimeout(goalTimerRef.current); };
  }, [pendingDeleteGoal]);

  if (!pendingDeleteTask && !pendingDeleteGoal) return null;

  return (
    <>
      {pendingDeleteTask && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">
            {t.toast.deleted(pendingDeleteTask.title)}
          </span>
          <button
            className="delete-toast-undo"
            onClick={() => {
              if (taskTimerRef.current) clearTimeout(taskTimerRef.current);
              undoDeleteTask();
            }}
          >
            {t.toast.undo}
          </button>
        </div>
      )}
      {pendingDeleteGoal && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">
            {t.toast.deleted(pendingDeleteGoal.title)}
          </span>
          <button
            className="delete-toast-undo"
            onClick={() => {
              if (goalTimerRef.current) clearTimeout(goalTimerRef.current);
              undoDeleteGoal();
            }}
          >
            {t.toast.undo}
          </button>
        </div>
      )}
    </>
  );
}
