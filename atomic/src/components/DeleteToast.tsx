import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';

const TOAST_DURATION = 4000;

export default function DeleteToast() {
  const t = useT();
  const {
    pendingDeleteTask, undoDeleteTask, confirmDeleteTask,
    pendingDeleteGoal, undoDeleteGoal, confirmDeleteGoal,
    pendingDeleteTag, undoDeleteTag, confirmDeleteTag,
    pendingDeleteChecklistItem, undoDeleteChecklistItem, confirmDeleteChecklistItem,
  } = useAppStore();
  const taskTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goalTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checklistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (tagTimerRef.current) clearTimeout(tagTimerRef.current);
    if (!pendingDeleteTag) return;
    tagTimerRef.current = setTimeout(() => {
      confirmDeleteTag(pendingDeleteTag);
    }, TOAST_DURATION);
    return () => { if (tagTimerRef.current) clearTimeout(tagTimerRef.current); };
  }, [pendingDeleteTag]);

  useEffect(() => {
    if (checklistTimerRef.current) clearTimeout(checklistTimerRef.current);
    if (!pendingDeleteChecklistItem) return;
    checklistTimerRef.current = setTimeout(() => {
      confirmDeleteChecklistItem(pendingDeleteChecklistItem.item.id, pendingDeleteChecklistItem.goalId);
    }, TOAST_DURATION);
    return () => { if (checklistTimerRef.current) clearTimeout(checklistTimerRef.current); };
  }, [pendingDeleteChecklistItem]);

  if (!pendingDeleteTask && !pendingDeleteGoal && !pendingDeleteTag && !pendingDeleteChecklistItem) return null;

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
      {pendingDeleteTag && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">
            {t.toast.deleted(pendingDeleteTag.name)}
          </span>
          <button
            className="delete-toast-undo"
            onClick={() => {
              if (tagTimerRef.current) clearTimeout(tagTimerRef.current);
              undoDeleteTag();
            }}
          >
            {t.toast.undo}
          </button>
        </div>
      )}
      {pendingDeleteChecklistItem && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">
            {t.toast.deleted(pendingDeleteChecklistItem.item.text)}
          </span>
          <button
            className="delete-toast-undo"
            onClick={() => {
              if (checklistTimerRef.current) clearTimeout(checklistTimerRef.current);
              undoDeleteChecklistItem();
            }}
          >
            {t.toast.undo}
          </button>
        </div>
      )}
    </>
  );
}
