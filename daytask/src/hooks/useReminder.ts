import { useEffect, useRef } from 'react';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { format } from 'date-fns';
import { useAppStore } from '../store/appStore';

export function useReminder() {
  const { loadTasks, setReminderPopup } = useAppStore();
  const permGranted = useRef(false);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    async function init() {
      let granted = await isPermissionGranted();
      if (!granted) {
        const result = await requestPermission();
        granted = result === 'granted';
      }
      permGranted.current = granted;
    }
    init();
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function check() {
      const now   = format(new Date(), 'HH:mm');
      const today = format(new Date(), 'yyyy-MM-dd');
      const nowMs = Date.now();

      await loadTasks(today);

      const { tasks: latestTasks, snoozedUntil } = useAppStore.getState();

      const due = latestTasks.filter((t) => {
        if (t.is_done || t.date !== today) return false;

        const snoozeTs = snoozedUntil[t.id];

        if (snoozeTs) {
          // Snoozed path: kiểm tra theo timestamp, không theo reminder string
          if (nowMs < snoozeTs) return false;
          return !firedRef.current.has(`${t.id}-snooze-${snoozeTs}`);
        }

        // Normal path: match đúng phút của reminder
        if (!t.reminder || t.reminder !== now) return false;
        return !firedRef.current.has(`${t.id}-${now}`);
      });

      if (due.length === 0) return;

      // Đánh dấu fired trước khi show (tránh race nếu check() chạy đồng thời)
      due.forEach((t) => {
        const snoozeTs = snoozedUntil[t.id];
        firedRef.current.add(
          snoozeTs ? `${t.id}-snooze-${snoozeTs}` : `${t.id}-${now}`
        );
      });

      // Xóa các snooze đã hết hạn khỏi store để không bị trigger lại vô hạn
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
          sendNotification({ title: 'DayTask — Nhắc nhở', body: t.title });
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
