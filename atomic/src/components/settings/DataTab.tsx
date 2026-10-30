import { useRef, useState } from "react";
import { IconCheck, IconX, IconPencil, IconTrash, IconDownload, IconUpload } from "@tabler/icons-react";
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

  function commitNewTag() {
    if (!newTagInput.trim()) return;
    addTag(newTagInput.trim());
    setNewTagInput("");
    setShowNewTagInput(false);
  }

  function cancelNewTag() {
    setShowNewTagInput(false);
    setNewTagInput("");
  }

  function commitRename(id: number) {
    if (renameInput.trim()) updateTag(id, renameInput.trim());
    setRenamingTagId(null);
  }

  return (
    <div className="st-panel">
      {/* I — Thẻ tag */}
      <section className="st-section">
        <div className="st-section-head">
          <span className="st-section-num">I</span>
          <h3 className="st-section-title">{t.tags.tagLabel}</h3>
          {tags.length > 0 && <span className="st-count">{tags.length}</span>}
        </div>

        {tags.length === 0 && !showNewTagInput && <p className="st-hint">{t.tags.noTags}</p>}

        {tags.length > 0 && (
          <ul className="st-tag-grid">
            {tags.map((tag) =>
              renamingTagId === tag.id ? (
                <li key={tag.id} className="st-tag is-editing">
                  <span className="st-dot" style={{ background: tag.color }} />
                  <input
                    className="st-line-input"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    spellCheck={false}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(tag.id);
                      if (e.key === "Escape") setRenamingTagId(null);
                    }}
                    autoFocus
                  />
                  <div className="st-actions is-visible">
                    <button className="st-icon-btn" title={t.tags.save} aria-label={t.tags.save} onClick={() => commitRename(tag.id)}>
                      <IconCheck size={13} stroke={1.75} />
                    </button>
                    <button className="st-icon-btn" title={t.tags.cancel} aria-label={t.tags.cancel} onClick={() => setRenamingTagId(null)}>
                      <IconX size={13} stroke={1.75} />
                    </button>
                  </div>
                </li>
              ) : (
                <li key={tag.id} className="st-tag">
                  <span className="st-dot" style={{ background: tag.color }} />
                  <span className="st-tag-name">{tag.name}</span>
                  <div className="st-actions">
                    <button
                      className="st-icon-btn"
                      title={t.tags.renameTag}
                      aria-label={t.tags.renameTag}
                      onClick={() => {
                        setRenamingTagId(tag.id);
                        setRenameInput(tag.name);
                      }}
                    >
                      <IconPencil size={13} stroke={1.75} />
                    </button>
                    <button
                      className="st-icon-btn danger"
                      title={t.tags.deleteTag}
                      aria-label={t.tags.deleteTag}
                      onClick={() => softDeleteTag(tag.id)}
                    >
                      <IconTrash size={13} stroke={1.75} />
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}

        {showNewTagInput ? (
          <div className="st-new-line">
            <input
              className="st-line-input"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitNewTag();
                if (e.key === "Escape") cancelNewTag();
              }}
              placeholder={t.tags.addPlaceholder}
              autoFocus
            />
            <button className="st-icon-btn" title={t.tags.save} aria-label={t.tags.save} onClick={commitNewTag}>
              <IconCheck size={14} stroke={1.75} />
            </button>
            <button className="st-icon-btn" title={t.tags.cancel} aria-label={t.tags.cancel} onClick={cancelNewTag}>
              <IconX size={14} stroke={1.75} />
            </button>
          </div>
        ) : (
          <button className="st-add" onClick={() => setShowNewTagInput(true)}>
            {t.tags.createNew}
          </button>
        )}
      </section>

      {/* II — Sao lưu & khôi phục */}
      <section className="st-section">
        <div className="st-section-head">
          <span className="st-section-num">II</span>
          <h3 className="st-section-title">{t.settings.backup}</h3>
        </div>

        <div className="st-btn-row">
          <button className="st-btn" onClick={handleExport} disabled={exportStatus === "loading"}>
            <IconDownload size={14} stroke={1.75} />
            {exportStatus === "loading" ? t.settings.exporting : t.settings.exportData}
          </button>
          <button className="st-btn" onClick={handleImportClick} disabled={importStatus === "loading"}>
            <IconUpload size={14} stroke={1.75} />
            {importStatus === "loading" ? t.settings.importing : t.settings.importData}
          </button>
        </div>

        {exportStatus === "success" && <p className="st-note ok">✓ {t.settings.exportSuccess}</p>}
        {exportStatus === "error" && (
          <p className="st-note err">
            {t.settings.exportError}: {exportError}
          </p>
        )}
        {importStatus === "success" && <p className="st-note ok">✓ {t.settings.importSuccess}</p>}
        {importStatus === "error" && <p className="st-note err">{importError}</p>}

        <p className="st-hint">{t.settings.backupHint}</p>
      </section>

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
