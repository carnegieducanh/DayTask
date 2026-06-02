import { useRef, useState } from 'react';
import { IconX, IconTextSize, IconDownload, IconUpload, IconDatabaseImport, IconLanguage } from '@tabler/icons-react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';
import type { Language } from '../types';

export default function SettingsModal() {
  const { openSettingsModal, setOpenSettingsModal, uiScale, setUiScale, language, setLanguage, exportAllData, importAllData } = useAppStore();
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState('');

  const SCALE_OPTIONS: { label: string; value: number; desc: string }[] = [
    { label: t.settings.small,      value: 0.9,  desc: '90%' },
    { label: t.settings.normal,     value: 1.0,  desc: '100%' },
    { label: t.settings.large,      value: 1.1,  desc: '110%' },
    { label: t.settings.extraLarge, value: 1.25, desc: '125%' },
  ];

  const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
    { value: 'vi', label: 'Tiếng Việt' },
    { value: 'en', label: 'English'    },
  ];

  if (!openSettingsModal) return null;

  async function handleExport() {
    await exportAllData();
  }

  function handleImportClick() {
    setImportStatus('idle');
    setImportError('');
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const ok = window.confirm(t.settings.importConfirm);
    if (!ok) return;

    setImportStatus('loading');
    try {
      await importAllData(file);
      setImportStatus('success');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t.settings.unknownError);
      setImportStatus('error');
    }
  }

  return (
    <div className="modal-overlay" onClick={() => setOpenSettingsModal(false)}>
      <div className="modal modal-settings" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{t.settings.title}</span>
          <button className="icon-btn" style={{ border: 'none' }} onClick={() => setOpenSettingsModal(false)}>
            <IconX size={16} />
          </button>
        </div>

        {/* Language */}
        <div className="settings-section">
          <div className="settings-section-label">
            <IconLanguage size={14} />
            {t.settings.language}
          </div>
          <div className="settings-lang-grid">
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`settings-lang-btn${language === opt.value ? ' active' : ''}`}
                onClick={() => setLanguage(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Font size */}
        <div className="settings-section">
          <div className="settings-section-label">
            <IconTextSize size={14} />
            {t.settings.fontSize}
          </div>
          <div className="settings-scale-grid">
            {SCALE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`settings-scale-btn${uiScale === opt.value ? ' active' : ''}`}
                onClick={() => setUiScale(opt.value)}
              >
                <span className="settings-scale-label">{opt.label}</span>
                <span className="settings-scale-desc">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="settings-section">
          <div className="settings-section-label">
            <IconDatabaseImport size={14} />
            {t.settings.backup}
          </div>
          <div className="settings-backup-row">
            <button className="btn btn-ghost settings-backup-btn" onClick={handleExport}>
              <IconDownload size={14} />
              {t.settings.exportData}
            </button>
            <button className="btn btn-ghost settings-backup-btn" onClick={handleImportClick} disabled={importStatus === 'loading'}>
              <IconUpload size={14} />
              {importStatus === 'loading' ? t.settings.importing : t.settings.importData}
            </button>
          </div>
          {importStatus === 'success' && (
            <div className="settings-backup-msg settings-backup-ok">{t.settings.importSuccess}</div>
          )}
          {importStatus === 'error' && (
            <div className="settings-backup-msg settings-backup-err">{importError}</div>
          )}
          <div className="settings-backup-hint">
            {t.settings.backupHint}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
