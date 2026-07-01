import { useRef, useState, useEffect } from "react";
import { attachSmoothScroll } from "../hooks/useSmoothScroll";
import { useModalClose } from "../hooks/useModalClose";
import tauriConf from "../../src-tauri/tauri.conf.json";
const version = tauriConf.version;
import {
  IconX,
  IconDownload,
  IconUpload,
  IconTrash,
  IconCheck,
  IconPencil,
  IconChevronRight,
  IconPalette,
  IconAlertTriangle,
  IconBookmark,
} from "@tabler/icons-react";
import { useAppStore } from "../store/appStore";
import { useT } from "../i18n";
import { loadGreetings, saveGreetings, resetGreetings } from "../store/greetingsStore";
import type { Period, GreetingItem, GreetingsStore } from "../store/greetingsStore";
import {
  dbGetVocabWords,
  dbBulkAddVocabWords,
  dbDeleteVocabWord,
  dbUpdateVocabWord,
  dbClearAllVocabWords,
  getVocabInterval,
  saveVocabInterval,
} from "../store/vocabDb";
import type { Language, AccentColor, VocabWord } from "../types";

type ActiveTab = "general" | "greeting" | "data" | "vocab";

export default function SettingsModal() {
  const {
    openSettingsModal,
    setOpenSettingsModal,
    uiScale,
    setUiScale,
    language,
    setLanguage,
    accentColor,
    setAccentColor,
    customAccentColor,
    setCustomAccentColor,
    savedAccentColors,
    saveAccentColor,
    exportAllData,
    importAllData,
    autostart,
    setAutostart,
    tags,
    addTag,
    updateTag,
    softDeleteTag,
  } = useAppStore();
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const overlayHandlers = useModalClose(() => setOpenSettingsModal(false));
  useEffect(() => {
    if (!openSettingsModal || !bodyRef.current) return;
    return attachSmoothScroll(bodyRef.current);
  }, [openSettingsModal]);

  const [activeTab, setActiveTab] = useState<ActiveTab>("general");
  const [importStatus, setImportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importError, setImportError] = useState("");
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [exportError, setExportError] = useState("");

  // Tags state
  const [newTagInput, setNewTagInput] = useState("");
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [renamingTagId, setRenamingTagId] = useState<number | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [tagSectionOpen, setTagSectionOpen] = useState(false);

  // Greeting state
  const [greetingsStore, setGreetingsStore] = useState<GreetingsStore>(() => loadGreetings());
  const [openPeriod, setOpenPeriod] = useState<Period | null>(null);
  const [addingPeriod, setAddingPeriod] = useState<Period | null>(null);
  const [newVI, setNewVI] = useState("");
  const [newEN, setNewEN] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVI, setEditVI] = useState("");
  const [editEN, setEditEN] = useState("");
  const [pendingDeleteGreeting, setPendingDeleteGreeting] = useState<{
    period: Period;
    item: GreetingItem;
    index: number;
  } | null>(null);
  const deleteGTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showResetToast, setShowResetToast] = useState(false);
  const resetToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Custom accent color picker state
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customHexInput, setCustomHexInput] = useState(customAccentColor);

  // Vocab state
  const [vocabWords, setVocabWords] = useState<VocabWord[]>([]);
  const [vocabInterval, setVocabIntervalState] = useState(getVocabInterval);
  const [vocabPasteSuccess, setVocabPasteSuccess] = useState(0);
  const pasteSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pasteZoneRef = useRef<HTMLTextAreaElement>(null);
  const [pendingDeleteVocab, setPendingDeleteVocab] = useState<VocabWord | null>(null);
  const deleteVTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingVocabId, setEditingVocabId] = useState<number | null>(null);
  const [editVocabFields, setEditVocabFields] = useState({ word: "", ipa: "", meaning: "", meaning_en: "" });
  const [confirmClearVocab, setConfirmClearVocab] = useState(false);

  const SCALE_OPTIONS: { label: string; value: number; desc: string }[] = [
    { label: t.settings.small, value: 0.9, desc: "90%" },
    { label: t.settings.normal, value: 1.0, desc: "100%" },
    { label: t.settings.large, value: 1.1, desc: "110%" },
    { label: t.settings.extraLarge, value: 1.25, desc: "125%" },
  ];

  const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
    { value: "vi", label: "Tiếng Việt" },
    { value: "en", label: "English" },
  ];

  const ACCENT_OPTIONS: { value: AccentColor; label: string; color: string }[] = [
    { value: "blue", label: t.settings.blue, color: "#185FA5" },
    { value: "orange", label: t.settings.orange, color: "#DA7756" },
    { value: "green", label: t.settings.green, color: "#1D9E75" },
    { value: "purple", label: t.settings.purple, color: "#7F77DD" },
    { value: "red", label: t.settings.red, color: "#E24B4A" },
    { value: "yellow", label: t.settings.yellow, color: "#EF9F27" },
  ];

  function isValidHex(v: string) {
    return /^#[0-9a-fA-F]{6}$/.test(v);
  }

  function hasLowContrast(hex: string): boolean {
    if (!isValidHex(hex)) return false;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    // Warn if contrast against white < 3:1 (color too bright to be visible on light bg)
    return (1.05 / (L + 0.05)) < 3;
  }

  const PERIODS: { key: Period; label: string }[] = [
    { key: "morning", label: t.settings.greetingMorning },
    { key: "noon", label: t.settings.greetingNoon },
    { key: "afternoon", label: t.settings.greetingAfternoon },
    { key: "evening", label: t.settings.greetingEvening },
    { key: "night", label: t.settings.greetingNight },
  ];

  useEffect(() => {
    if (!openSettingsModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenSettingsModal(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openSettingsModal, setOpenSettingsModal]);

  useEffect(() => {
    if (deleteGTimerRef.current) clearTimeout(deleteGTimerRef.current);
    if (!pendingDeleteGreeting) return;
    deleteGTimerRef.current = setTimeout(() => setPendingDeleteGreeting(null), 4000);
    return () => {
      if (deleteGTimerRef.current) clearTimeout(deleteGTimerRef.current);
    };
  }, [pendingDeleteGreeting]);

  useEffect(() => {
    if (resetToastTimerRef.current) clearTimeout(resetToastTimerRef.current);
    if (!showResetToast) return;
    resetToastTimerRef.current = setTimeout(() => setShowResetToast(false), 3000);
    return () => {
      if (resetToastTimerRef.current) clearTimeout(resetToastTimerRef.current);
    };
  }, [showResetToast]);

  useEffect(() => {
    if (deleteVTimerRef.current) clearTimeout(deleteVTimerRef.current);
    if (!pendingDeleteVocab) return;
    deleteVTimerRef.current = setTimeout(async () => {
      await dbDeleteVocabWord(pendingDeleteVocab.id);
      setPendingDeleteVocab(null);
    }, 4000);
    return () => { if (deleteVTimerRef.current) clearTimeout(deleteVTimerRef.current); };
  }, [pendingDeleteVocab]);

  useEffect(() => {
    if (activeTab !== "vocab") return;
    dbGetVocabWords().then(setVocabWords);
  }, [activeTab]);

  if (!openSettingsModal) return null;

  // ── Vocab ──
  function handleIntervalChange(minutes: number) {
    setVocabIntervalState(minutes);
    saveVocabInterval(minutes);
  }

  function handleDeleteVocabWord(id: number) {
    const word = vocabWords.find((w) => w.id === id);
    if (!word) return;
    if (deleteVTimerRef.current) clearTimeout(deleteVTimerRef.current);
    setVocabWords((prev) => prev.filter((w) => w.id !== id));
    setPendingDeleteVocab(word);
  }

  function handleUndoDeleteVocab() {
    if (!pendingDeleteVocab) return;
    if (deleteVTimerRef.current) clearTimeout(deleteVTimerRef.current);
    setVocabWords((prev) => {
      const idx = prev.findIndex((w) => w.position != null && w.position > (pendingDeleteVocab.position ?? -1));
      const arr = [...prev];
      arr.splice(idx === -1 ? arr.length : idx, 0, pendingDeleteVocab);
      return arr;
    });
    setPendingDeleteVocab(null);
  }

  function handleEditVocabStart(w: VocabWord) {
    setEditingVocabId(w.id);
    setEditVocabFields({ word: w.word, ipa: w.ipa ?? "", meaning: w.meaning, meaning_en: w.meaning_en ?? "" });
  }

  async function handleEditVocabSave() {
    if (!editingVocabId) return;
    await dbUpdateVocabWord(editingVocabId, editVocabFields);
    setVocabWords((prev) => prev.map((w) =>
      w.id === editingVocabId ? { ...w, ...editVocabFields } : w
    ));
    setEditingVocabId(null);
  }

  async function handleClearAllVocab() {
    await dbClearAllVocabWords();
    setVocabWords([]);
    setConfirmClearVocab(false);
  }

  async function handleVocabPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const rows = text
      .trim()
      .split("\n")
      .map((line) => {
        const parts = line.split("\t");
        return {
          word: parts[0]?.trim() ?? "",
          ipa: parts[1]?.trim() ?? "",
          meaning: parts[2]?.trim() ?? "",
          meaning_en: parts[3]?.trim() ?? "",
        };
      })
      .filter((r) => r.word && r.meaning);
    if (rows.length === 0) return;
    await dbBulkAddVocabWords(rows);
    const updated = await dbGetVocabWords();
    setVocabWords(updated);
    setVocabPasteSuccess(rows.length);
    if (pasteSuccessTimerRef.current) clearTimeout(pasteSuccessTimerRef.current);
    pasteSuccessTimerRef.current = setTimeout(() => setVocabPasteSuccess(0), 2500);
    if (pasteZoneRef.current) pasteZoneRef.current.value = "";
  }

  // ── Import/Export ──
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

  // ── Greeting: Add ──
  function handleAddGreeting(period: Period) {
    if (!newVI.trim() && !newEN.trim()) {
      cancelAdd();
      return;
    }
    const updated = { ...greetingsStore };
    updated[period] = [...updated[period], { id: Date.now().toString(), vi: newVI.trim(), en: newEN.trim() }];
    setGreetingsStore(updated);
    saveGreetings(updated);
    setNewVI("");
    setNewEN("");
    setAddingPeriod(null);
  }

  function cancelAdd() {
    setAddingPeriod(null);
    setNewVI("");
    setNewEN("");
  }

  function startAdding(period: Period) {
    cancelEdit();
    setAddingPeriod(period);
    setOpenPeriod(period);
    setNewVI("");
    setNewEN("");
  }

  // ── Greeting: Edit ──
  function handleStartEdit(g: GreetingItem) {
    cancelAdd();
    setEditingId(g.id);
    setEditVI(g.vi);
    setEditEN(g.en);
  }

  function handleSaveEdit(period: Period) {
    if (!editingId) return;
    const updated = { ...greetingsStore };
    updated[period] = updated[period].map((g) =>
      g.id === editingId ? { ...g, vi: editVI.trim(), en: editEN.trim() } : g,
    );
    setGreetingsStore(updated);
    saveGreetings(updated);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditVI("");
    setEditEN("");
  }

  // ── Greeting: Delete ──
  function handleDeleteGreeting(period: Period, g: GreetingItem) {
    if (deleteGTimerRef.current) clearTimeout(deleteGTimerRef.current);
    const index = greetingsStore[period].findIndex((item) => item.id === g.id);
    const updated = { ...greetingsStore };
    updated[period] = updated[period].filter((item) => item.id !== g.id);
    setGreetingsStore(updated);
    saveGreetings(updated);
    setPendingDeleteGreeting({ period, item: g, index });
  }

  function handleUndoDeleteGreeting() {
    if (!pendingDeleteGreeting) return;
    if (deleteGTimerRef.current) clearTimeout(deleteGTimerRef.current);
    const { period, item, index } = pendingDeleteGreeting;
    const updated = { ...greetingsStore };
    const arr = [...updated[period]];
    arr.splice(Math.min(index, arr.length), 0, item);
    updated[period] = arr;
    setGreetingsStore(updated);
    saveGreetings(updated);
    setPendingDeleteGreeting(null);
  }

  // ── Greeting: Reset ──
  function handleReset() {
    const defaults = resetGreetings();
    setGreetingsStore(defaults);
    setEditingId(null);
    setAddingPeriod(null);
    setShowResetToast(true);
  }

  return (
    <div className="modal-overlay" {...overlayHandlers}>
      <div className="modal modal-settings" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <span className="settings-head-title">{t.settings.title}</span>
          <button className="settings-close-btn" onClick={() => setOpenSettingsModal(false)}>
            <IconX size={13} />
          </button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab-btn${activeTab === "general" ? " active" : ""}`}
            onClick={() => setActiveTab("general")}
          >
            {t.settings.generalTab}
          </button>
          <button
            className={`settings-tab-btn${activeTab === "greeting" ? " active" : ""}`}
            onClick={() => setActiveTab("greeting")}
          >
            {t.settings.greetingTab}
          </button>
          <button
            className={`settings-tab-btn${activeTab === "data" ? " active" : ""}`}
            onClick={() => setActiveTab("data")}
          >
            {t.settings.dataTab}
          </button>
          <button
            className={`settings-tab-btn${activeTab === "vocab" ? " active" : ""}`}
            onClick={() => setActiveTab("vocab")}
          >
            {t.vocab.tabLabel}
          </button>
        </div>

        <div className="settings-body" ref={bodyRef}>
          {/* ── Tab: Chung ── */}
          {activeTab === "general" && (
            <div className="settings-tab-panel">
              <div className="settings-general-grid">

                {/* Row 1 left: Language */}
                <div className="settings-general-col settings-general-col--left">
                  <div className="settings-section">
                    <div className="settings-section-label">{t.settings.language}</div>
                    <div className="settings-row" style={{ paddingTop: "4px", paddingBottom: "10px" }}>
                      <div className="settings-seg-group">
                        {LANGUAGE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            className={`settings-seg-btn${language === opt.value ? " active" : ""}`}
                            onClick={() => setLanguage(opt.value)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 1 right: Accent Color swatches */}
                <div className="settings-general-col">
                  <div className="settings-section">
                    <div className="settings-section-label">{t.settings.accentColor}</div>
                    <div className="settings-row" style={{ paddingTop: "6px", paddingBottom: "12px" }}>
                      <div className="settings-accent-row">
                        {ACCENT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            className={`settings-accent-swatch${accentColor === opt.value ? " active" : ""}`}
                            title={opt.label}
                            style={{ background: opt.color }}
                            onClick={() => { setAccentColor(opt.value); setShowCustomPicker(false); }}
                          />
                        ))}
                        <button
                          className={`settings-accent-swatch settings-accent-swatch--custom${accentColor === "custom" ? " active" : ""}`}
                          title={t.settings.custom}
                          style={{ background: customAccentColor }}
                          onClick={() => {
                            setAccentColor("custom");
                            setCustomHexInput(customAccentColor);
                            setShowCustomPicker((v) => !v);
                          }}
                        >
                          <IconPalette size={12} color="rgba(255,255,255,0.85)" stroke={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: Custom color picker — spans both columns */}
                {showCustomPicker && accentColor === "custom" && (
                  <div className="settings-custom-picker-section">
                    <div className="settings-divider" style={{ margin: "0 0 10px" }} />
                    <div className="settings-custom-picker">
                      <input
                        type="color"
                        className="settings-color-native"
                        value={isValidHex(customHexInput) ? customHexInput : customAccentColor}
                        onChange={(e) => {
                          setCustomHexInput(e.target.value);
                          setCustomAccentColor(e.target.value);
                        }}
                      />
                      <input
                        type="text"
                        className="settings-hex-input"
                        value={customHexInput}
                        placeholder="#000000"
                        maxLength={7}
                        spellCheck={false}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomHexInput(val);
                          if (isValidHex(val)) setCustomAccentColor(val);
                        }}
                        onBlur={() => {
                          if (!isValidHex(customHexInput)) setCustomHexInput(customAccentColor);
                        }}
                      />
                      {hasLowContrast(customHexInput) && (
                        <span className="settings-contrast-warn" title={t.settings.lowContrastWarning}>
                          <IconAlertTriangle size={14} />
                        </span>
                      )}
                      <button
                        className="settings-save-color-btn"
                        title={t.settings.saveColor}
                        disabled={!isValidHex(customHexInput)}
                        onClick={() => saveAccentColor(customHexInput)}
                      >
                        <IconBookmark size={14} />
                      </button>
                      {savedAccentColors.length > 0 && (
                        <div className="settings-saved-colors">
                          {savedAccentColors.map((hex) => (
                            <button
                              key={hex}
                              className="settings-saved-swatch"
                              title={hex}
                              style={{ background: hex }}
                              onClick={() => {
                                setCustomHexInput(hex);
                                setCustomAccentColor(hex);
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Row 3 left: Font Size */}
                <div className="settings-general-col settings-general-col--left">
                  <div className="settings-divider" />
                  <div className="settings-section">
                    <div className="settings-section-label">{t.settings.fontSize}</div>
                    <div className="settings-row" style={{ paddingTop: "4px", paddingBottom: "10px" }}>
                      <div className="settings-font-group">
                        {SCALE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            className={`settings-font-btn${uiScale === opt.value ? " active" : ""}`}
                            onClick={() => setUiScale(opt.value)}
                          >
                            <span>{opt.label}</span>
                            <span className="settings-font-pct">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 3 right: Autostart */}
                <div className="settings-general-col">
                  <div className="settings-divider" />
                  <div className="settings-section">
                    <div className="settings-row">
                      <div>
                        <div className="settings-row-label">{t.settings.autostart}</div>
                        <div className="settings-row-sub">{t.settings.autostartDesc}</div>
                      </div>
                      <button
                        className={`settings-toggle${autostart ? " active" : ""}`}
                        onClick={() => setAutostart(!autostart)}
                        aria-label={t.settings.autostart}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── Tab: Lời chào ── */}
          {activeTab === "greeting" && (
            <div className="settings-tab-panel">
              <div className="settings-greeting-toolbar">
                <button className="settings-greeting-reset-btn" onClick={handleReset}>
                  {t.settings.greetingReset}
                </button>
              </div>

              {PERIODS.map(({ key, label }) => {
                const items = greetingsStore[key] ?? [];
                const isOpen = openPeriod === key;
                return (
                  <div key={key} className="settings-section">
                    <button
                      className="settings-row settings-tags-row"
                      onClick={() => setOpenPeriod(isOpen ? null : key)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="settings-row-label" style={{ minWidth: "4.5rem" }}>
                          {label}
                        </span>
                        <span className="settings-tag-count">{items.length}</span>
                      </div>
                      <IconChevronRight
                        size={14}
                        style={{
                          color: "var(--text-secondary)",
                          transition: "transform 0.2s",
                          transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                          flexShrink: 0,
                        }}
                      />
                    </button>

                    <div className={`settings-tags-dropdown${isOpen ? " open" : ""}`}>
                      <div className="settings-tags-list">
                        {items.map((g) =>
                          editingId === g.id ? (
                            <div key={g.id} className="settings-greeting-row settings-greeting-row--editing">
                              {g.isFixed && (
                                <span className="settings-greeting-fixed-dot" title={t.settings.greetingFixedHint} />
                              )}
                              <input
                                className="settings-greeting-input"
                                value={editVI}
                                onChange={(e) => setEditVI(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit(key);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                spellCheck={false}
                                autoFocus
                              />
                              <input
                                className="settings-greeting-input"
                                value={editEN}
                                onChange={(e) => setEditEN(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit(key);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                spellCheck={false}
                              />
                              <button className="icon-btn" onClick={() => handleSaveEdit(key)}>
                                <IconCheck size={14} />
                              </button>
                              <button className="icon-btn" onClick={cancelEdit}>
                                <IconX size={14} />
                              </button>
                            </div>
                          ) : (
                            <div key={g.id} className="settings-greeting-row">
                              {g.isFixed && (
                                <span className="settings-greeting-fixed-dot" title={t.settings.greetingFixedHint} />
                              )}
                              <span className="settings-greeting-vi">{g.vi || "—"}</span>
                              <span className="settings-greeting-sep">·</span>
                              <span className="settings-greeting-en">{g.en || "—"}</span>
                              <button
                                className="settings-tag-action-btn"
                                title={t.tags.renameTag}
                                onClick={() => handleStartEdit(g)}
                              >
                                <IconPencil size={12} />
                              </button>
                              <button
                                className="settings-tag-action-btn settings-tag-action-delete"
                                title={t.tags.deleteTag}
                                onClick={() => handleDeleteGreeting(key, g)}
                              >
                                <IconTrash size={12} />
                              </button>
                            </div>
                          ),
                        )}

                        {addingPeriod === key ? (
                          <div className="settings-greeting-add-row">
                            <input
                              className="settings-greeting-input"
                              placeholder={t.settings.greetingPlaceholderVI}
                              value={newVI}
                              onChange={(e) => setNewVI(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddGreeting(key);
                                if (e.key === "Escape") cancelAdd();
                              }}
                              spellCheck={false}
                              autoFocus
                            />
                            <input
                              className="settings-greeting-input"
                              placeholder={t.settings.greetingPlaceholderEN}
                              value={newEN}
                              onChange={(e) => setNewEN(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddGreeting(key);
                                if (e.key === "Escape") cancelAdd();
                              }}
                              spellCheck={false}
                            />
                            <button className="icon-btn" onClick={() => handleAddGreeting(key)}>
                              <IconCheck size={14} />
                            </button>
                            <button className="icon-btn" onClick={cancelAdd}>
                              <IconX size={14} />
                            </button>
                          </div>
                        ) : (
                          <button className="settings-tag-add-btn" onClick={() => startAdding(key)}>
                            {t.settings.greetingAdd}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Tab: Dữ liệu ── */}
          {activeTab === "data" && (
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
            </div>
          )}

          {/* ── Tab: Từ vựng ── */}
          {activeTab === "vocab" && (
            <div className="settings-tab-panel">
              <div className="settings-section">
                <div className="settings-section-label">{t.vocab.intervalLabel}</div>
                <div className="vocab-interval-row">
                  <input
                    type="range"
                    min={1}
                    max={60}
                    step={1}
                    value={vocabInterval}
                    className="vocab-interval-slider"
                    onChange={(e) => handleIntervalChange(Number(e.target.value))}
                  />
                  <span className="vocab-interval-label">{t.vocab.intervalUnit(vocabInterval)}</span>
                </div>
              </div>

              <div className="settings-divider" />

              <div className="settings-section">
                <div className="settings-section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {t.vocab.wordCol}
                  {vocabWords.length > 0 && (
                    <span className="settings-tag-count">{vocabWords.length}</span>
                  )}
                  {vocabWords.length > 0 && (
                    <span style={{ marginLeft: "auto" }}>
                      {confirmClearVocab ? (
                        <>
                          <button
                            className="vocab-clear-btn vocab-clear-btn--confirm"
                            onClick={handleClearAllVocab}
                          >
                            {t.vocab.clearAllConfirm}
                          </button>
                          <button
                            className="vocab-clear-btn"
                            onClick={() => setConfirmClearVocab(false)}
                            style={{ marginLeft: 4 }}
                          >
                            {t.toast.undo}
                          </button>
                        </>
                      ) : (
                        <button
                          className="vocab-clear-btn"
                          onClick={() => setConfirmClearVocab(true)}
                        >
                          {t.vocab.clearAll}
                        </button>
                      )}
                    </span>
                  )}
                </div>
                <div className="vocab-table-wrap">
                  {vocabWords.length === 0 ? (
                    <div className="vocab-table-empty">{t.vocab.noWords}</div>
                  ) : (
                    <table className="vocab-table">
                      <thead>
                        <tr>
                          <th>{t.vocab.wordCol}</th>
                          <th>{t.vocab.ipaCol}</th>
                          <th>{t.vocab.meaningCol}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {vocabWords.map((w) =>
                          editingVocabId === w.id ? (
                            <tr key={w.id}>
                              <td>
                                <input
                                  className="vocab-table-edit-input"
                                  value={editVocabFields.word}
                                  onChange={(e) => setEditVocabFields((f) => ({ ...f, word: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleEditVocabSave(); if (e.key === "Escape") setEditingVocabId(null); }}
                                  autoFocus
                                />
                              </td>
                              <td>
                                <input
                                  className="vocab-table-edit-input"
                                  value={editVocabFields.ipa}
                                  onChange={(e) => setEditVocabFields((f) => ({ ...f, ipa: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleEditVocabSave(); if (e.key === "Escape") setEditingVocabId(null); }}
                                />
                              </td>
                              <td>
                                <input
                                  className="vocab-table-edit-input"
                                  value={editVocabFields.meaning}
                                  onChange={(e) => setEditVocabFields((f) => ({ ...f, meaning: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleEditVocabSave(); if (e.key === "Escape") setEditingVocabId(null); }}
                                />
                              </td>
                              <td>
                                <div className="vocab-table-actions">
                                  <button
                                    className="settings-tag-action-btn"
                                    title={t.vocab.saveWord}
                                    onClick={handleEditVocabSave}
                                  >
                                    <IconCheck size={12} />
                                  </button>
                                  <button
                                    className="settings-tag-action-btn"
                                    title={t.vocab.cancelEdit}
                                    onClick={() => setEditingVocabId(null)}
                                  >
                                    <IconX size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                          <tr key={w.id}>
                            <td style={{ fontWeight: 500 }}>{w.word}</td>
                            <td style={{ color: "var(--text-secondary)", fontFamily: "monospace", fontSize: "0.78rem" }}>
                              {w.ipa || "—"}
                            </td>
                            <td>{w.meaning}</td>
                            <td>
                              <div className="vocab-table-actions">
                                <button
                                  className="settings-tag-action-btn"
                                  title={t.vocab.editWord}
                                  onClick={() => handleEditVocabStart(w)}
                                >
                                  <IconPencil size={12} />
                                </button>
                                <button
                                  className="settings-tag-action-btn settings-tag-action-delete"
                                  title={t.vocab.deleteWord}
                                  onClick={() => handleDeleteVocabWord(w.id)}
                                >
                                  <IconTrash size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                <textarea
                  ref={pasteZoneRef}
                  className="vocab-paste-zone"
                  placeholder={t.vocab.pasteZonePlaceholder}
                  onPaste={handleVocabPaste}
                  rows={2}
                  spellCheck={false}
                />
                {vocabPasteSuccess > 0 && (
                  <div className="vocab-paste-success">{t.vocab.pasteSuccess(vocabPasteSuccess)}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="settings-version">Atomic v{version}</div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      {showResetToast && (
        <div className="delete-toast" role="status" onClick={(e) => e.stopPropagation()}>
          <span className="delete-toast-msg">{t.settings.greetingReset} ✓</span>
        </div>
      )}

      {pendingDeleteGreeting && (
        <div className="delete-toast" role="status" onClick={(e) => e.stopPropagation()}>
          <span className="delete-toast-msg">
            {t.toast.deleted(pendingDeleteGreeting.item.vi || pendingDeleteGreeting.item.en || "—")}
          </span>
          <button className="delete-toast-undo" onClick={handleUndoDeleteGreeting}>
            {t.toast.undo}
          </button>
        </div>
      )}

      {pendingDeleteVocab && (
        <div className="delete-toast" role="status" onClick={(e) => e.stopPropagation()}>
          <span className="delete-toast-msg">{t.toast.deleted(pendingDeleteVocab.word)}</span>
          <button className="delete-toast-undo" onClick={handleUndoDeleteVocab}>
            {t.toast.undo}
          </button>
        </div>
      )}
    </div>
  );
}
