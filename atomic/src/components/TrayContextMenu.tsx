import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store/appStore';

export default function TrayContextMenu() {
  const { theme, language, accentColor } = useAppStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.fontSize = '14px';
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, [theme]);

  useEffect(() => {
    if (accentColor === 'orange') {
      document.documentElement.style.setProperty('--primary', '#DA7756');
    } else {
      document.documentElement.style.removeProperty('--primary');
    }
  }, [accentColor]);

  async function openMain() {
    await invoke('show_main_window');
  }

  async function handleQuit() {
    await invoke('quit_app');
  }

  return (
    <div className="tcm">
      <button className="tcm-item" onClick={openMain}>
        {language === 'vi' ? 'Mở Atomic' : 'Open Atomic'}
      </button>
      <div className="tcm-divider" />
      <button className="tcm-item tcm-item-quit" onClick={handleQuit}>
        {language === 'vi' ? 'Thoát' : 'Quit'}
      </button>
    </div>
  );
}
