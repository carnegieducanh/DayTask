import { useRef, useState } from "react";
import { IconCheck, IconX, IconPencil, IconTrash, IconChevronRight, IconDownload, IconUpload } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";

export default function DataTab() {
  const { tags, addTag, updateTag, softDeleteTag, exportAllData, importAllData } = useAppStore();
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importError, setImportError] = useState("");
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [exportError, setExportError] = useState("");

  const [newTagInput, setNewTagInput] = useState("");
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [renamingTagId, setRenamingTagId] = useState<number | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [tagSectionOpen, setTagSectionOpen] = useState(false);

  function handleImportClick() {
    setImportStatus("idle");
    setImportError("");
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const ok = window.confirm(t.settings.importConfirm);
    if (!ok) return;
    setImportStatus("loading");
    try {
      await importAllData(file);
      setImportStatus("success");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t.settings.unknownError);
      setImportStatus("error");
    }
  }

  async function handleExport() {
    setExportStatus("loading");
    setExportError("");
    try {
      await exportAllData();
      setExportStatus("success");
      setTimeout(() => setExportStatus("idle"), 4000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t.settings.unknownError);
      setExportStatus("error");
    }
  }

  return (
    <div className="settings-tab-panel">
      <div className="settings-section">
        <button className="settings-row settings-tags-row" onClick={() => setTagSectionOpen((o) => !o)}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="settings-row-label">{t.tags.sectionTitle}</span>
            {tags.length > 0 && <span className="settings-tag-count">{tags.length}</span>}
          </div>
          <IconChevronRight
            size={14}
            style={{
              color: "var(--text-secondary)",
              transition: "transform 0.2s",
              transform: tagSectionOpen ? "rotate(90deg)" : "rotate(0deg)",
              flexShrink: 0,
            }}
          />
        </button>
        <div className={`settings-tags-dropdown${tagSectionOpen ? " open" : ""}`}>
          <div className="settings-tags-list">
            {tags.length === 0 && <div className="settings-tags-empty">{t.tags.noTags}</div>}
            {tags.map((tag) => (
              <div key={tag.id} className="settings-tag-chip-row">
                {renamingTagId === tag.id ? (
                  <div className="settings-tag-chip editing">
                    <input
                      className="settings-tag-rename-input"
                      value={renameInput}
                      onChange={(e) => setRenameInput(e.target.value)}
                      spellCheck={false}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (renameInput.trim()) updateTag(tag.id, renameInput.trim());
                          setRenamingTagId(null);
                        }
                        if (e.key === "Escape") setRenamingTagId(null);
                      }}
                      autoFocus
                    />
                    <button
                      className="settings-tag-action-btn"
                      title={t.tags.save}
                      onClick={() => {
                        if (renameInput.trim()) updateTag(tag.id, renameInput.trim());
                        setRenamingTagId(null);
                      }}
                    >
                      <IconCheck size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="settings-tag-chip">
                    <span className="settings-tag-name">{tag.name}</span>
                    <button
                      className="settings-tag-action-btn"
                      title={t.tags.renameTag}
                      onClick={() => {
                        setRenamingTagId(tag.id);
                        setRenameInput(tag.name);
                      }}
                    >
                      <IconPencil size={12} />
                    </button>
                    <button
                      className="settings-tag-action-btn settings-tag-action-delete"
                      title={t.tags.deleteTag}
                      onClick={() => softDeleteTag(tag.id)}
                    >
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
                  spellCheck={false}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (newTagInput.trim()) {
                        addTag(newTagInput.trim());
                        setNewTagInput("");
                        setShowNewTagInput(false);
                      }
                    }
                    if (e.key === "Escape") {
                      setShowNewTagInput(false);
                      setNewTagInput("");
                    }
                  }}
                  placeholder={t.tags.addPlaceholder}
                  autoFocus
                />
                <button
                  className="icon-btn"
                  onClick={() => {
                    if (newTagInput.trim()) {
                      addTag(newTagInput.trim());
                      setNewTagInput("");
                      setShowNewTagInput(false);
                    }
                  }}
                >
                  <IconCheck size={14} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => {
                    setShowNewTagInput(false);
                    setNewTagInput("");
                  }}
                >
                  <IconX size={14} />
                </button>
              </div>
            ) : (
              <button className="settings-tag-add-btn" onClick={() => setShowNewTagInput(true)}>
                {t.tags.createNew}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="settings-divider" />

      <div className="settings-section">
        <div className="settings-section-label">{t.settings.backup}</div>
        <div className="settings-action-group">
          <button className="settings-action-btn" onClick={handleExport} disabled={exportStatus === "loading"}>
            <IconDownload size={14} />
            {exportStatus === "loading" ? t.settings.exporting : t.settings.exportData}
          </button>
          <button
            className="settings-action-btn"
            onClick={handleImportClick}
            disabled={importStatus === "loading"}
          >
            <IconUpload size={14} />
            {importStatus === "loading" ? t.settings.importing : t.settings.importData}
          </button>
        </div>
        <p className="settings-backup-hint">{t.settings.backupHint}</p>
        {exportStatus === "success" && (
          <div className="settings-backup-msg settings-backup-ok" style={{ margin: "0 16px 8px" }}>
            {t.settings.exportSuccess}
          </div>
        )}
        {exportStatus === "error" && (
          <div className="settings-backup-msg settings-backup-err" style={{ margin: "0 16px 8px" }}>
            {t.settings.exportError}: {exportError}
          </div>
        )}
        {importStatus === "success" && (
          <div className="settings-backup-msg settings-backup-ok" style={{ margin: "0 16px 8px" }}>
            {t.settings.importSuccess}
          </div>
        )}
        {importStatus === "error" && (
          <div className="settings-backup-msg settings-backup-err" style={{ margin: "0 16px 8px" }}>
            {importError}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}
