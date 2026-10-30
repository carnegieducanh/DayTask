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

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: "general", label: t.settings.generalTab },
    { key: "greeting", label: t.settings.greetingTab },
    { key: "data", label: t.settings.dataTab },
    { key: "vocab", label: t.vocab.tabLabel },
    { key: "background", label: t.settings.backgroundTab },
  ];

  // Custom accent color picker: kept here rather than inside GeneralTab because
  // .st-picker-wrap is position:fixed and must be laid out against the viewport,
  // not the sheet — it stays a sibling of .st-sheet inside the overlay, same as
  // in the original layout.
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
      <div className="st-sheet" role="dialog" aria-label={t.settings.title} onClick={(e) => e.stopPropagation()}>
        <header className="st-head">
          <div className="st-head-main">
            <span className="st-eyebrow">Atomic · {t.settings.version(version)}</span>
            <h2 className="st-title">{t.settings.title}</h2>
          </div>
          <button
            className="st-round-btn"
            onClick={() => setOpenSettingsModal(false)}
            aria-label={t.settings.close}
          >
            <IconX size={14} stroke={1.75} />
          </button>
        </header>

        <nav className="st-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`st-tab${activeTab === tab.key ? " active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="st-body" ref={bodyRef}>
          {activeTab === "general" && (
            <GeneralTab onSwatchClick={handleSwatchClick} onCustomSwatchClick={handleCustomSwatchClick} />
          )}
          {activeTab === "greeting" && <GreetingTab />}
          {activeTab === "data" && <DataTab />}
          {activeTab === "vocab" && <VocabTab />}
          {activeTab === "background" && <BackgroundTab />}
        </div>
      </div>

      {showCustomPicker && accentColor === "custom" && (
        <div className={`st-picker-wrap${pickerClosing ? " closing" : ""}`} onClick={closeColorPicker}>
          <div className="st-picker" onClick={(e) => e.stopPropagation()}>
            <div className="st-picker-head">
              <span className="st-eyebrow">{t.settings.custom}</span>
              <button className="st-round-btn st-round-btn--sm" onClick={closeColorPicker} aria-label={t.settings.close}>
                <IconX size={12} stroke={1.75} />
              </button>
            </div>
            <div className="st-picker-row">
              <input
                type="color"
                className="st-picker-native"
                value={isValidHex(customHexInput) ? customHexInput : customAccentColor}
                onChange={(e) => {
                  setCustomHexInput(e.target.value);
                  setCustomAccentColor(e.target.value);
                }}
              />
              <input
                type="text"
                className="st-picker-hex"
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
                <span className="st-picker-warn" title={t.settings.lowContrastWarning}>
                  <IconAlertTriangle size={14} stroke={1.75} />
                </span>
              )}
              <button
                className="st-btn st-btn--sm"
                disabled={!isValidHex(customHexInput)}
                onClick={() => saveAccentColor(customHexInput)}
              >
                {t.settings.saveColor}
              </button>
            </div>
            {savedAccentColors.length > 0 && (
              <div className="st-picker-saved">
                <span className="st-label">{t.settings.savedColors}</span>
                <div className="st-picker-swatches">
                  {savedAccentColors.map((hex) => (
                    <button
                      key={hex}
                      className={`st-swatch st-swatch--sm${selectedSavedHex === hex ? " active" : ""}`}
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
                {selectedSavedHex !== null && savedAccentColors.includes(selectedSavedHex) && (
                  <button className="st-link st-link--danger" onClick={handleDeleteSavedColor}>
                    <IconTrash size={12} stroke={1.75} />
                    {t.settings.deleteSavedColor}
                  </button>
                )}
              </div>
            )}
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
