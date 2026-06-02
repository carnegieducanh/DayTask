import { useRef, useState } from 'react';
import { IconX, IconTextSize, IconDownload, IconUpload, IconDatabaseImport } from '@tabler/icons-react';
import { useAppStore } from '../store/appStore';

const SCALE_OPTIONS: { label: string; value: number; desc: string }[] = [
  { label: 'Nhỏ',       value: 0.9,  desc: '90%' },
  { label: 'Bình thường', value: 1.0, desc: '100%' },
  { label: 'Lớn',       value: 1.1,  desc: '110%' },
  { label: 'Rất lớn',   value: 1.25, desc: '125%' },
];

export default function SettingsModal() {
  const { openSettingsModal, setOpenSettingsModal, uiScale, setUiScale, exportAllData, importAllData } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState('');

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

    const ok = window.confirm(
      'Nhập dữ liệu sẽ XÓA toàn bộ dữ liệu hiện tại và thay bằng file backup.\n\nBạn có chắc muốn tiếp tục?'
    );
    if (!ok) return;

    setImportStatus('loading');
    try {
      await importAllData(file);
      setImportStatus('success');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Lỗi không xác định');
      setImportStatus('error');
    }
  }

  return (
    <div className="modal-overlay" onClick={() => setOpenSettingsModal(false)}>
      <div className="modal modal-settings" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Cài đặt</span>
          <button className="icon-btn" style={{ border: 'none' }} onClick={() => setOpenSettingsModal(false)}>
            <IconX size={16} />
          </button>
        </div>

        {/* Cỡ chữ */}
        <div className="settings-section">
          <div className="settings-section-label">
            <IconTextSize size={14} />
            Cỡ chữ
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

        {/* Sao lưu & Khôi phục */}
        <div className="settings-section">
          <div className="settings-section-label">
            <IconDatabaseImport size={14} />
            Sao lưu &amp; Khôi phục
          </div>
          <div className="settings-backup-row">
            <button className="btn btn-ghost settings-backup-btn" onClick={handleExport}>
              <IconDownload size={14} />
              Xuất toàn bộ dữ liệu
            </button>
            <button className="btn btn-ghost settings-backup-btn" onClick={handleImportClick} disabled={importStatus === 'loading'}>
              <IconUpload size={14} />
              {importStatus === 'loading' ? 'Đang nhập...' : 'Nhập từ file backup'}
            </button>
          </div>
          {importStatus === 'success' && (
            <div className="settings-backup-msg settings-backup-ok">Nhập dữ liệu thành công!</div>
          )}
          {importStatus === 'error' && (
            <div className="settings-backup-msg settings-backup-err">{importError}</div>
          )}
          <div className="settings-backup-hint">
            File backup bao gồm tất cả tasks, mục tiêu, checklist và màu sắc danh mục.
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
