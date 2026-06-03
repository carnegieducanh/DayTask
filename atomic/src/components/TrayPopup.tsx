import { useEffect } from 'react';
import { format } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';

export default function TrayPopup() {
  const t = useT();
  const { tasks, loadTasks, theme, language } = useAppStore();

  const today = format(new Date(), 'yyyy-MM-dd');
  const done = tasks.filter((task) => task.is_done).length;
  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const dateLabel = format(
    new Date(),
    'EEEE, d MMM',
    language === 'vi' ? { locale: viLocale } : undefined,
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.fontSize = '14px';

    const refresh = () => loadTasks(format(new Date(), 'yyyy-MM-dd'));
    refresh();

    let unlisten: (() => void) | undefined;
    listen('tauri://focus', refresh).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  async function openMain() {
    await invoke('show_main_window');
  }

  async function handleQuit() {
    await invoke('quit_app');
  }

  return (
    <div className="tp">
      <div className="tp-header">
        <span className="tp-appname">Atomic</span>
        <span className="tp-date">{dateLabel}</span>
      </div>

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
              ? '🎉 ' + (language === 'vi' ? 'Hoàn thành tất cả!' : 'All done!')
              : `${total - done} ${language === 'vi' ? 'việc còn lại' : 'remaining'}`}
        </div>
      </div>

      <div className="tp-actions">
        <button className="tp-btn tp-btn-primary" onClick={openMain}>
          {language === 'vi' ? 'Mở Atomic' : 'Open Atomic'}
        </button>
        <button className="tp-btn" onClick={handleQuit}>
          {language === 'vi' ? 'Thoát' : 'Quit'}
        </button>
      </div>
    </div>
  );
}
