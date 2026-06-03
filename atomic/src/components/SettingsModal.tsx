import { useRef, useState } from 'react';
import { IconX, IconDownload, IconUpload, IconTrash, IconCheck, IconPencil, IconChevronRight } from '@tabler/icons-react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';
import type { Language, AccentColor } from '../types';

export default function SettingsModal() {
  const {
    openSettingsModal, setOpenSettingsModal,
    uiScale, setUiScale,
    language, setLanguage,
    accentColor, setAccentColor,
    exportAllData, importAllData,
    autostart, setAutostart,
    tags, addTag, updateTag, softDeleteTag,
  } = useAppStore();
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [renamingTagId, setRenamingTagId] = useState<number | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [tagSectionOpen, setTagSectionOpen] = useState(false);

  const SCALE_OPTIONS: { label: string; value: number; desc: string }[] = [
    { label: t.settings.small,      value: 0.9,  desc: '90%' },
    { label: t.settings.normal,     value: 1.0,  desc: '100%' },
    { label: t.settings.large,      value: 1.1,  desc: '110%' },
    { label: t.settings.extraLarge, value: 1.25, desc: '125%' },
  ];

  const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
    { value: 'vi', label: 'Tiếng Việt' },
    { value: 'en', label: 'English' },
  ];

  const ACCENT_OPTIONS: { value: AccentColor; label: string; color: string }[] = [
    { value: 'blue',   label: t.settings.blue,   color: '#185FA5' },
    { value: 'orange', label: t.settings.orange, color: '#DA7756' },
    { value: 'green',  label: t.settings.green,  color: '#1D9E75' },
    { value: 'purple', label: t.settings.purple, color: '#7F77DD' },
    { value: 'red',    label: t.settings.red,    color: '#E24B4A' },
    { value: 'yellow', label: t.settings.yellow, color: '#EF9F27' },
  ];

  if (!openSettingsModal) return null;

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

        <div className="settings-head">
          <span className="settings-head-title">{t.settings.title}</span>
          <button className="settings-close-btn" onClick={() => setOpenSettingsModal(false)}>
            <IconX size={13} />
          </button>
        </div>

        <div className="settings-body">

          {/* Language */}
          <div className="settings-section">
            <div className="settings-section-label">{t.settings.language}</div>
            <div className="settings-row" style={{ paddingTop: '4px', paddingBottom: '8px' }}>
              <div className="settings-seg-group">
                {LANGUAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`settings-seg-btn${language === opt.value ? ' active' : ''}`}
                    onClick={() => setLanguage(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="settings-divider" />

          {/* Font size */}
          <div className="settings-section">
            <div className="settings-section-label">{t.settings.fontSize}</div>
            <div className="settings-row" style={{ paddingTop: '4px', paddingBottom: '8px' }}>
              <div className="settings-font-group">
                {SCALE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`settings-font-btn${uiScale === opt.value ? ' active' : ''}`}
                    onClick={() => setUiScale(opt.value)}
                  >
                    <span>{opt.label}</span>
                    <span className="settings-font-pct">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="settings-divider" />

          {/* Launch at startup */}
          <div className="settings-section">
            <div className="settings-row">
              <div>
                <div className="settings-row-label">{t.settings.autostart}</div>
                <div className="settings-row-sub">{t.settings.autostartDesc}</div>
              </div>
              <button
                className={`settings-toggle${autostart ? ' active' : ''}`}
                onClick={() => setAutostart(!autostart)}
                aria-label={t.settings.autostart}
              />
            </div>
          </div>

          <div className="settings-divider" />

          {/* Accent color */}
          <div className="settings-section">
            <div className="settings-section-label">{t.settings.accentColor}</div>
            <div className="settings-row" style={{ paddingTop: '6px', paddingBottom: '10px' }}>
              <div className="settings-accent-row">
                {ACCENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`settings-accent-swatch${accentColor === opt.value ? ' active' : ''}`}
                    title={opt.label}
                    style={{ background: opt.color }}
                    onClick={() => setAccentColor(opt.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="settings-divider" />

          {/* Manage tags */}
          <div className="settings-section">
            <button
              className="settings-row settings-tags-row"
              onClick={() => setTagSectionOpen((o) => !o)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="settings-row-label">{t.tags.sectionTitle}</span>
                {tags.length > 0 && (
                  <span className="settings-tag-count">{tags.length}</span>
                )}
              </div>
              <IconChevronRight
                size={14}
                style={{ color: 'var(--text-secondary)', transition: 'transform 0.2s', transform: tagSectionOpen ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
              />
            </button>
            <div className={`settings-tags-dropdown${tagSectionOpen ? ' open' : ''}`}>
              <div className="settings-tags-list">
                {tags.length === 0 && (
                  <div className="settings-tags-empty">{t.tags.noTags}</div>
                )}
                {tags.map((tag) => (
                  <div key={tag.id} className="settings-tag-chip-row">
                    {renamingTagId === tag.id ? (
                      <div className="settings-tag-chip editing">
                        <input
                          className="settings-tag-rename-input"
                          value={renameInput}
                          onChange={(e) => setRenameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (renameInput.trim()) updateTag(tag.id, renameInput.trim());
                              setRenamingTagId(null);
                            }
                            if (e.key === 'Escape') setRenamingTagId(null);
                          }}
                          autoFocus
                          spellCheck={false}
                        />
                        <button className="settings-tag-action-btn" title={t.tags.save}
                          onClick={() => { if (renameInput.trim()) updateTag(tag.id, renameInput.trim()); setRenamingTagId(null); }}>
                          <IconCheck size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="settings-tag-chip">
                        <span className="settings-tag-name">{tag.name}</span>
                        <button className="settings-tag-action-btn" title={t.tags.renameTag}
                          onClick={() => { setRenamingTagId(tag.id); setRenameInput(tag.name); }}>
                          <IconPencil size={12} />
                        </button>
                        <button className="settings-tag-action-btn settings-tag-action-delete" title={t.tags.deleteTag}
                          onClick={() => softDeleteTag(tag.id)}>
                          <IconTrash size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {showNewTagInput ? (
                  <div className="settings-tag-new">
                    <input
                      className="settings-tag-rename-input"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (newTagInput.trim()) { addTag(newTagInput.trim()); setNewTagInput(''); setShowNewTagInput(false); }
                        }
                        if (e.key === 'Escape') { setShowNewTagInput(false); setNewTagInput(''); }
                      }}
                      placeholder={t.tags.addPlaceholder}
                      autoFocus
                      spellCheck={false}
                    />
                    <button
                      className="icon-btn"
                      onClick={() => {
                        if (newTagInput.trim()) { addTag(newTagInput.trim()); setNewTagInput(''); setShowNewTagInput(false); }
                      }}
                    >
                      <IconCheck size={14} />
                    </button>
                    <button className="icon-btn" onClick={() => { setShowNewTagInput(false); setNewTagInput(''); }}>
                      <IconX size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="settings-tag-add-btn"
                    onClick={() => setShowNewTagInput(true)}
                  >
                    {t.tags.createNew}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="settings-divider" />

          {/* Backup & Restore */}
          <div className="settings-section">
            <div className="settings-section-label">{t.settings.backup}</div>
            <div className="settings-action-group">
              <button className="settings-action-btn" onClick={() => exportAllData()}>
                <IconDownload size={14} />
                {t.settings.exportData}
              </button>
              <button className="settings-action-btn" onClick={handleImportClick} disabled={importStatus === 'loading'}>
                <IconUpload size={14} />
                {importStatus === 'loading' ? t.settings.importing : t.settings.importData}
              </button>
            </div>
            <p className="settings-backup-hint">{t.settings.backupHint}</p>
            {importStatus === 'success' && (
              <div className="settings-backup-msg settings-backup-ok" style={{ margin: '0 16px 8px' }}>{t.settings.importSuccess}</div>
            )}
            {importStatus === 'error' && (
              <div className="settings-backup-msg settings-backup-err" style={{ margin: '0 16px 8px' }}>{importError}</div>
            )}
          </div>

        </div>

        <div className="settings-version">Atomic v0.1.9</div>

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
