import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store/appStore';

export default function TrayContextMenu() {
  const { theme, language } = useAppStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.fontSize = '14px';
  }, [theme]);

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
