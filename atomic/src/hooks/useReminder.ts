import { useEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { format } from "date-fns";
import { useAppStore } from "../store/appStore";

export function useReminder() {
  const { loadTasks, setReminderPopup } = useAppStore();
  const permGranted = useRef(false);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function init() {
      let granted = await isPermissionGranted();
      if (!granted) {
        const result = await requestPermission();
        granted = result === "granted";
      }
      permGranted.current = granted;
    }
    init();
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function check() {
      const now = format(new Date(), "HH:mm");
      const today = format(new Date(), "yyyy-MM-dd");
      const nowMs = Date.now();

      await loadTasks(today);

      const { tasks: latestTasks, taskTimeEntries, snoozedUntil } = useAppStore.getState();

      const due = latestTasks.filter((t) => {
        if (t.is_done || t.date !== today) return false;

        const snoozeTs = snoozedUntil[t.id];

        if (snoozeTs) {
          if (nowMs < snoozeTs) return false;
          return !firedRef.current.has(`${t.id}-snooze-${snoozeTs}`);
        }

        const entry = taskTimeEntries.find((e) => e.task_id === t.id && e.date === today);
        if (!entry) return false;
        if (entry.start_time !== now) return false;
        return !firedRef.current.has(`${t.id}-${today}-${entry.start_time}`);
      });

      if (due.length === 0) return;

      due.forEach((t) => {
        const snoozeTs = snoozedUntil[t.id];
        const entry = taskTimeEntries.find((e) => e.task_id === t.id && e.date === today);
        firedRef.current.add(
          snoozeTs ? `${t.id}-snooze-${snoozeTs}` : `${t.id}-${today}-${entry?.start_time}`,
        );
      });

      const expiredIds = due
        .filter((t) => snoozedUntil[t.id] && nowMs >= snoozedUntil[t.id])
        .map((t) => t.id);

      if (expiredIds.length > 0) {
        useAppStore.setState((state) => {
          const next = { ...state.snoozedUntil };
          expiredIds.forEach((id) => delete next[id]);
          return { snoozedUntil: next };
        });
      }

      due.forEach((t) => {
        if (permGranted.current) {
          const entry = taskTimeEntries.find((e) => e.task_id === t.id && e.date === today);
          sendNotification({
            title: t.title,
            body: entry ? `${entry.start_time} → ${entry.end_time}` : 'Đến giờ rồi!',
          });
        }
        setReminderPopup(t);
      });
    }

    const startTime = new Date();
    const msToNextMinute =
      (60 - startTime.getSeconds()) * 1000 - startTime.getMilliseconds();

    const timeoutId = setTimeout(() => {
      check();
      intervalId = setInterval(check, 60_000);
    }, msToNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, []);
}
