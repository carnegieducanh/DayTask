import { useRef, useState, useEffect } from "react";
import "./SettingsModal.css";
import { attachSmoothScroll } from "../hooks/useSmoothScroll";
import { useModalClose } from "../hooks/useModalClose";
import tauriConf from "../../src-tauri/tauri.conf.json";
const version = tauriConf.version;
import { IconX, IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { useAppStore } from "../store/appStore";
import { useT } from "../i18n";
import type { AccentColor } from "../types";
import GeneralTab from "./settings/GeneralTab";
import GreetingTab from "./settings/GreetingTab";
import DataTab from "./settings/DataTab";
import VocabTab from "./settings/VocabTab";
import BackgroundTab from "./settings/BackgroundTab";

type ActiveTab = "general" | "greeting" | "data" | "vocab" | "background";

export default function SettingsModal() {
  const {
    openSettingsModal,
    setOpenSettingsModal,
    accentColor,
    setAccentColor,
    customAccentColor,
    setCustomAccentColor,
    savedAccentColors,
    saveAccentColor,
    removeAccentColor,
  } = useAppStore();
  const t = useT();
  const bodyRef = useRef<HTMLDivElement>(null);
  const overlayHandlers = useModalClose(() => setOpenSettingsModal(false));
  useEffect(() => {
    if (!openSettingsModal || !bodyRef.current) return;
    return attachSmoothScroll(bodyRef.current);
  }, [openSettingsModal]);

  const [activeTab, setActiveTab] = useState<ActiveTab>("general");

  // Custom accent color picker: kept here rather than inside GeneralTab because
  // .color-picker-popup-wrap is position:fixed and .modal has backdrop-filter —
  // backdrop-filter establishes a containing block, so nesting the popup inside
  // the modal's tree would clip/reposition it to the modal box instead of the
  // viewport. It has to stay a sibling of .modal, same as in the original layout.
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [pickerClosing, setPickerClosing] = useState(false);
  const [customHexInput, setCustomHexInput] = useState(customAccentColor);
  const [selectedSavedHex, setSelectedSavedHex] = useState<string | null>(null);
  const [undoDeleteColor, setUndoDeleteColor] = useState<string | null>(null);
  const undoColorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function closeColorPicker() {
    setPickerClosing(true);
    setTimeout(() => {
      setShowCustomPicker(false);
      setPickerClosing(false);
    }, 160);
  }

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

  function handleSwatchClick(color: AccentColor) {
    setAccentColor(color);
    if (showCustomPicker) closeColorPicker();
  }

  function handleCustomSwatchClick() {
    setAccentColor("custom");
    setCustomHexInput(customAccentColor);
    if (showCustomPicker) closeColorPicker(); else setShowCustomPicker(true);
  }

  function handleDeleteSavedColor() {
    if (!selectedSavedHex) return;
    if (undoColorTimerRef.current) clearTimeout(undoColorTimerRef.current);
    setUndoDeleteColor(selectedSavedHex);
    removeAccentColor(selectedSavedHex);
    setSelectedSavedHex(null);
    undoColorTimerRef.current = setTimeout(() => setUndoDeleteColor(null), 4000);
  }

  function handleUndoDeleteColor() {
    if (!undoDeleteColor) return;
    if (undoColorTimerRef.current) clearTimeout(undoColorTimerRef.current);
    saveAccentColor(undoDeleteColor);
    setUndoDeleteColor(null);
  }

  useEffect(() => {
    if (!openSettingsModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenSettingsModal(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openSettingsModal, setOpenSettingsModal]);

  if (!openSettingsModal) return null;

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
          <button
            className={`settings-tab-btn${activeTab === "background" ? " active" : ""}`}
            onClick={() => setActiveTab("background")}
          >
            {t.settings.backgroundTab}
          </button>
        </div>

        <div className="settings-body" ref={bodyRef}>
          {activeTab === "general" && (
            <GeneralTab onSwatchClick={handleSwatchClick} onCustomSwatchClick={handleCustomSwatchClick} />
          )}
          {activeTab === "greeting" && <GreetingTab />}
          {activeTab === "data" && <DataTab />}
          {activeTab === "vocab" && <VocabTab />}
          {activeTab === "background" && <BackgroundTab />}
        </div>

        <div className="settings-version">Atomic v{version}</div>
      </div>

      {showCustomPicker && accentColor === "custom" && (
        <div className={`color-picker-popup-wrap${pickerClosing ? " closing" : ""}`} onClick={closeColorPicker}>
          <div className="color-picker-popup" onClick={(e) => e.stopPropagation()}>
            <div className="color-picker-popup-head">
              <span className="color-picker-popup-title">🎨 {t.settings.custom}</span>
              <button className="color-picker-popup-close" onClick={closeColorPicker}>
                <IconX size={13} />
              </button>
            </div>
            <div className="color-picker-popup-body">
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
                  disabled={!isValidHex(customHexInput)}
                  onClick={() => saveAccentColor(customHexInput)}
                >
                  {t.settings.saveColor}
                </button>
              </div>
              {savedAccentColors.length > 0 && (
                <>
                  <div className="settings-saved-colors-row">
                    <span className="settings-saved-label">{t.settings.savedColors}</span>
                    <div className="settings-saved-colors">
                      {savedAccentColors.map((hex) => (
                        <button
                          key={hex}
                          className={`settings-saved-swatch${selectedSavedHex === hex ? " selected" : ""}`}
                          title={hex}
                          style={{ background: hex }}
                          onClick={() => {
                            setCustomHexInput(hex);
                            setCustomAccentColor(hex);
                            setSelectedSavedHex(prev => prev === hex ? null : hex);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {selectedSavedHex !== null && savedAccentColors.includes(selectedSavedHex) && (
                    <div className="settings-saved-delete-row">
                      <button
                        className="settings-saved-delete-btn"
                        onClick={handleDeleteSavedColor}
                      >
                        <IconTrash size={12} />
                        {t.settings.deleteSavedColor}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {undoDeleteColor && (
        <div className="delete-toast" role="status" onClick={(e) => e.stopPropagation()}>
          <span className="delete-toast-msg">{t.toast.deleted(undoDeleteColor)}</span>
          <button className="delete-toast-undo" onClick={handleUndoDeleteColor}>
            {t.toast.undo}
          </button>
        </div>
      )}
    </div>
  );
}
