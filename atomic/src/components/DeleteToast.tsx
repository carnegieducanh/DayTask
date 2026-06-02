import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';

const TOAST_DURATION = 4000;

export default function DeleteToast() {
  const t = useT();
  const { pendingDeleteTask, undoDeleteTask, confirmDeleteTask } = useAppStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!pendingDeleteTask) return;

    timerRef.current = setTimeout(() => {
      confirmDeleteTask(pendingDeleteTask);
    }, TOAST_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pendingDeleteTask]);

  if (!pendingDeleteTask) return null;

  return (
    <div className="delete-toast" role="status">
      <span className="delete-toast-msg">
        {t.toast.deleted(pendingDeleteTask.title)}
      </span>
      <button
        className="delete-toast-undo"
        onClick={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          undoDeleteTask();
        }}
      >
        {t.toast.undo}
      </button>
    </div>
  );
}
