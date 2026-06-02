import { IconDownload, IconX, IconRefresh } from '@tabler/icons-react';
import { useT } from '../i18n';

interface Props {
  version: string;
  downloading: boolean;
  progress: number | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

export default function UpdateDialog({ version, downloading, progress, onConfirm, onDismiss }: Props) {
  const t = useT();

  return (
    <div className="update-overlay">
      <div className="update-dialog">
        <div className="update-dialog-header">
          <IconRefresh size={18} />
          <span>{t.update.title}</span>
          {!downloading && (
            <button className="update-close-btn" onClick={onDismiss}>
              <IconX size={14} />
            </button>
          )}
        </div>

        <p className="update-version">{t.update.version(version)}</p>

        {downloading ? (
          <div className="update-progress-wrap">
            <div className="update-progress-bar">
              <div
                className="update-progress-fill"
                style={{ width: progress !== null ? `${Math.round(progress)}%` : '15%', transition: progress !== null ? 'width 0.3s' : 'none' }}
              />
            </div>
            <span className="update-progress-label">
              {progress !== null ? `${Math.round(progress)}%` : t.update.preparing}
            </span>
          </div>
        ) : (
          <div className="update-dialog-actions">
            <button className="update-btn-skip" onClick={onDismiss}>{t.update.later}</button>
            <button className="update-btn-confirm" onClick={onConfirm}>
              <IconDownload size={14} />
              {t.update.install}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
