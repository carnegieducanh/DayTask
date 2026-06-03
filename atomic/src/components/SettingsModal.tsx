import { useRef, useState } from 'react';
import { IconX, IconTextSize, IconDownload, IconUpload, IconDatabaseImport, IconLanguage, IconPower, IconTag, IconTrash, IconCheck, IconPencil, IconChevronDown } from '@tabler/icons-react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';
import type { Language } from '../types';

export default function SettingsModal() {
  const { openSettingsModal, setOpenSettingsModal, uiScale, setUiScale, language, setLanguage, exportAllData, importAllData, autostart, setAutostart, tags, addTag, updateTag, softDeleteTag } = useAppStore();
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

        {/* Autostart */}
        <div className="settings-section">
          <div className="settings-autostart-row">
            <div>
              <div className="settings-section-label" style={{ marginBottom: 0 }}>
                <IconPower size={14} />
                {t.settings.autostart}
              </div>
              <div className="settings-autostart-desc">{t.settings.autostartDesc}</div>
            </div>
            <button
              className={`settings-toggle${autostart ? ' active' : ''}`}
              onClick={() => setAutostart(!autostart)}
              aria-label={t.settings.autostart}
            />
          </div>
        </div>

        {/* Tags management */}
        <div className="settings-section">
          <button
            className="settings-section-label settings-section-toggle"
            onClick={() => setTagSectionOpen((o) => !o)}
          >
            <IconTag size={14} />
            {t.tags.sectionTitle}
            {tags.length > 0 && (
              <span className="settings-tag-count">{tags.length}</span>
            )}
            <IconChevronDown
              size={14}
              style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: tagSectionOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
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
