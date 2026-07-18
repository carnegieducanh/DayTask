import { useAppStore } from "../../store/appStore";
import { useT } from "../../i18n";
import type { Language, AccentColor } from "../../types";

interface GeneralTabProps {
  onSwatchClick: (color: AccentColor) => void;
  onCustomSwatchClick: () => void;
}

export default function GeneralTab({ onSwatchClick, onCustomSwatchClick }: GeneralTabProps) {
  const {
    uiScale, setUiScale,
    language, setLanguage,
    accentColor,
    customAccentColor,
    autostart, setAutostart,
  } = useAppStore();
  const t = useT();

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

  return (
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

        {/* Row 1 right: Accent Color swatches + custom picker */}
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
                    onClick={() => onSwatchClick(opt.value)}
                  />
                ))}
                <button
                  className={`settings-accent-swatch settings-accent-swatch--custom${accentColor === "custom" ? " active" : ""}`}
                  title={t.settings.custom}
                  style={{ background: customAccentColor }}
                  onClick={onCustomSwatchClick}
                >
                  🎨
                </button>
              </div>
            </div>
          </div>
        </div>

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
  );
}
