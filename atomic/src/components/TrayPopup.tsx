import { useEffect } from 'react';
import { format } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { IconPlayerPlay } from '@tabler/icons-react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';
import { formatMins } from './calendar/calendarUtils';

export default function TrayPopup() {
  const t = useT();
  const { tasks, taskTimeEntries, loadTasks, loadTimeEntries, theme, language } = useAppStore();

  const done = tasks.filter((task) => task.is_done).length;
  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const doneTaskIds = new Set(tasks.filter((t) => t.is_done === 1).map((t) => t.id));
  const totalMins = taskTimeEntries
    .filter((e) => doneTaskIds.has(e.task_id))
    .reduce((sum, entry) => {
      const [sh, sm] = entry.start_time.split(':').map(Number);
      const [eh, em] = entry.end_time.split(':').map(Number);
      return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm));
    }, 0);

  const nextTask = (() => {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const candidates = tasks
      .filter((t) => !t.is_done)
      .flatMap((t) => {
        const entry = taskTimeEntries.find((e) => e.task_id === t.id);
        if (!entry) return [];
        const [sh, sm] = entry.start_time.split(':').map(Number);
        const [eh, em] = entry.end_time.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        return [{ task: t, startMins, endMins, startTime: entry.start_time }];
      });
    const inProgress = candidates
      .filter((x) => x.startMins <= nowMins && x.endMins > nowMins)
      .sort((a, b) => a.startMins - b.startMins);
    if (inProgress.length > 0) return inProgress[0];
    const upcoming = candidates
      .filter((x) => x.startMins > nowMins)
      .sort((a, b) => a.startMins - b.startMins);
    if (upcoming.length > 0) return upcoming[0];
    return null;
  })();

  const dateLabel = format(
    new Date(),
    'EEEE, d MMM',
    language === 'vi' ? { locale: viLocale } : undefined,
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.fontSize = '14px';

    const refresh = () => {
      const date = format(new Date(), 'yyyy-MM-dd');
      loadTasks(date);
      loadTimeEntries(date);
    };
    refresh();

    let unlisten: (() => void) | undefined;
    listen('tauri://focus', refresh).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', '#DA7756');
  }, []);

  async function openMain() {
    await invoke('show_main_window');
  }

  const timeDisplay = formatMins(totalMins) || '0m';

  return (
    <div className="tp">
      <div className="tp-header">
        <span className="tp-appname">Atomic</span>
        <span className="tp-date">{dateLabel}</span>
      </div>

      <div className="tp-time-section">
        <span className="tp-time-big">{timeDisplay}</span>
        <span className="tp-time-label">
          {language === 'vi' ? 'đã làm hôm nay' : 'tracked today'}
        </span>
      </div>

      <div className="tp-sep" />

      <div className="tp-next">
        {nextTask ? (
          <>
            <div className="tp-next-row">
              <IconPlayerPlay size={11} strokeWidth={2.5} className="tp-next-icon" />
              <span className="tp-next-title">{nextTask.task.title}</span>
            </div>
            <div className="tp-next-meta">
              <span className="tp-next-time">{nextTask.startTime}</span>
              <span className="tp-next-dot">·</span>
              <span className="tp-next-cat">
                {t.cat?.[nextTask.task.category] ?? nextTask.task.category}
              </span>
            </div>
          </>
        ) : done === total && total > 0 ? (
          <span className="tp-next-done">
            {language === 'vi' ? 'Tất cả đã xong!' : 'All done!'}
          </span>
        ) : (
          <span className="tp-next-fresh">
            {language === 'vi' ? 'Ngày mới, khởi đầu mới!' : 'New day, fresh start!'}
          </span>
        )}
      </div>

      <div className="tp-sep" />

      <div className="tp-body">
        <div className="tp-stat-row">
          <span className="tp-stat-label">{t.today.title}</span>
          <span className="tp-stat-count">
            {done}/{total} {t.today.taskUnit}
          </span>
        </div>
        <div className="tp-bar">
          <div className="tp-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="tp-stat-sub">
          {total === 0
            ? t.today.emptyState
            : done === total && total > 0
              ? (language === 'vi' ? 'Hoàn thành tất cả!' : 'All done!')
              : `${total - done} ${language === 'vi' ? 'việc còn lại' : 'remaining'}`}
        </div>
      </div>

      <div className="tp-actions">
        <button className="tp-btn tp-btn-primary" onClick={openMain}>
          {language === 'vi' ? 'Mở Atomic' : 'Open Atomic'}
        </button>
      </div>
    </div>
  );
}
