import { IconBellRinging, IconX } from '@tabler/icons-react';
import { useAppStore } from '../store/appStore';

export default function ReminderPopup() {
  const { reminderPopup, dismissReminder, snoozeReminder, setActiveTab } = useAppStore();

  if (!reminderPopup) return null;

  const task = reminderPopup;

  function handleView() {
    setActiveTab('today');
    dismissReminder();
  }

  return (
    <div className="reminder-popup">
      <div className="reminder-popup-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--primary)', fontSize: 13, fontWeight: 500 }}>
          <IconBellRinging size={14} />
          Nhắc nhở
        </span>
        <button
          className="icon-btn"
          style={{ width: 22, height: 22, border: 'none' }}
          onClick={dismissReminder}
          title="Đóng"
        >
          <IconX size={12} />
        </button>
      </div>

      <div className="reminder-popup-title">{task.title}</div>
      {task.reminder && (
        <div className="reminder-popup-time">
          {task.reminder} hôm nay
        </div>
      )}

      <div className="reminder-popup-actions">
        <button className="popup-btn" onClick={dismissReminder}>Bỏ qua</button>
        <button className="popup-btn" onClick={() => snoozeReminder(task.id, 10)}>Dời 10 phút</button>
        <button className="popup-btn primary" onClick={handleView}>Xem</button>
      </div>
    </div>
  );
}
