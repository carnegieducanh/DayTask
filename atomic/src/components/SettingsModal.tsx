import { IconX, IconTextSize } from '@tabler/icons-react';
import { useAppStore } from '../store/appStore';

const SCALE_OPTIONS: { label: string; value: number; desc: string }[] = [
  { label: 'Nhỏ',       value: 0.9,  desc: '90%' },
  { label: 'Bình thường', value: 1.0, desc: '100%' },
  { label: 'Lớn',       value: 1.1,  desc: '110%' },
  { label: 'Rất lớn',   value: 1.25, desc: '125%' },
];

export default function SettingsModal() {
  const { openSettingsModal, setOpenSettingsModal, uiScale, setUiScale } = useAppStore();

  if (!openSettingsModal) return null;

  return (
    <div className="modal-overlay" onClick={() => setOpenSettingsModal(false)}>
      <div className="modal modal-settings" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Cài đặt</span>
          <button className="icon-btn" style={{ border: 'none' }} onClick={() => setOpenSettingsModal(false)}>
            <IconX size={16} />
          </button>
        </div>

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
      </div>
    </div>
  );
}
