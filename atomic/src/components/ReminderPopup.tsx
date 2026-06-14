import { useEffect } from 'react';
import { IconBellRinging, IconX } from '@tabler/icons-react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';

export default function ReminderPopup() {
  const t = useT();
  const { reminderPopup, taskTimeEntries, dismissReminder, snoozeReminder, setActiveTab } = useAppStore();

  useEffect(() => {
    if (!reminderPopup) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissReminder();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [reminderPopup, dismissReminder]);

  useEffect(() => {
    if (!reminderPopup) return;
    const timer = setTimeout(dismissReminder, 60_000);
    return () => clearTimeout(timer);
  }, [reminderPopup, dismissReminder]);

  if (!reminderPopup) return null;

  const task = reminderPopup;
  const entry = taskTimeEntries.find((e) => e.task_id === task.id && e.date === task.date);

  function handleView() {
    setActiveTab('today');
    dismissReminder();
  }

  return (
    <div className="reminder-popup">
      <div className="reminder-popup-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--primary)', fontSize: 13, fontWeight: 500 }}>
          <IconBellRinging size={14} />
          {t.reminder.title}
        </span>
        <button
          className="icon-btn"
          style={{ width: 22, height: 22, border: 'none' }}
          onClick={dismissReminder}
          title={t.reminder.close}
        >
          <IconX size={12} />
        </button>
      </div>

      <div className="reminder-popup-title">{task.title}</div>
      {entry && (
        <div className="reminder-popup-time">
          {entry.start_time} → {entry.end_time}
        </div>
      )}

      <div className="reminder-popup-actions">
        <button className="popup-btn" onClick={dismissReminder}>{t.reminder.dismiss}</button>
        <button className="popup-btn" onClick={() => snoozeReminder(task.id, 10)}>{t.reminder.snooze}</button>
        <button className="popup-btn primary" onClick={handleView}>{t.reminder.view}</button>
      </div>
    </div>
  );
}
