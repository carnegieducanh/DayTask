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
    async function check() {
      const now   = format(new Date(), 'HH:mm');
      const today = format(new Date(), 'yyyy-MM-dd');

      await loadTasks(today);

      const { tasks: latestTasks, snoozedUntil } = useAppStore.getState();
      const nowMs = Date.now();

      const due = latestTasks.filter((t) => {
        if (t.is_done || t.reminder !== now || t.date !== today) return false;
        const snoozeTs = snoozedUntil[t.id];
        return !snoozeTs || nowMs >= snoozeTs;
      });

      due.forEach((t) => {
        if (permGranted.current) {
          sendNotification({ title: 'DayTask — Nhắc nhở', body: t.title });
        }
        setReminderPopup(t);
      });
    }

    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    const firstTimeout = setTimeout(() => {
      check();
      const interval = setInterval(check, 60_000);
      (firstTimeout as any)._interval = interval;
    }, msToNextMinute);

    return () => {
      clearTimeout(firstTimeout);
      if ((firstTimeout as any)._interval) {
        clearInterval((firstTimeout as any)._interval);
      }
    };
  }, []);
}
