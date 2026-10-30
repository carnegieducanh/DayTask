import { IconX, IconColorPicker } from "@tabler/icons-react";
import { format } from "date-fns";
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
    birthDate, setBirthDate,
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
    <div className="st-panel">
      {/* I — Giao diện */}
      <section className="st-section">
        <div className="st-section-head">
          <span className="st-section-num">I</span>
          <h3 className="st-section-title">{t.settings.groupAppearance}</h3>
        </div>

        <div className="st-row">
          <div className="st-row-text">
            <div className="st-row-label">{t.settings.language}</div>
          </div>
          <div className="st-choices" role="radiogroup" aria-label={t.settings.language}>
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                role="radio"
                aria-checked={language === opt.value}
                className={`st-choice${language === opt.value ? " active" : ""}`}
                onClick={() => setLanguage(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="st-row">
          <div className="st-row-text">
            <div className="st-row-label">{t.settings.accentColor}</div>
            <div className="st-row-desc">{t.settings.accentColorDesc}</div>
          </div>
          <div className="st-swatches">
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`st-swatch${accentColor === opt.value ? " active" : ""}`}
                title={opt.label}
                aria-label={opt.label}
                style={{ background: opt.color }}
                onClick={() => onSwatchClick(opt.value)}
              />
            ))}
            <button
              className={`st-swatch st-swatch--custom${accentColor === "custom" ? " active" : ""}`}
              title={t.settings.custom}
              aria-label={t.settings.custom}
              style={{ background: customAccentColor }}
              onClick={onCustomSwatchClick}
            >
              <IconColorPicker size={11} stroke={2} />
            </button>
          </div>
        </div>

        <div className="st-row">
          <div className="st-row-text">
            <div className="st-row-label">{t.settings.fontSize}</div>
            <div className="st-row-desc">{t.settings.fontSizeDesc}</div>
          </div>
          <div className="st-choices" role="radiogroup" aria-label={t.settings.fontSize}>
            {SCALE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                role="radio"
                aria-checked={uiScale === opt.value}
                className={`st-choice${uiScale === opt.value ? " active" : ""}`}
                onClick={() => setUiScale(opt.value)}
              >
                {opt.label}
                <span className="st-choice-num">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* II — Hệ thống */}
      <section className="st-section">
        <div className="st-section-head">
          <span className="st-section-num">II</span>
          <h3 className="st-section-title">{t.settings.groupSystem}</h3>
        </div>

        <div className="st-row">
          <div className="st-row-text">
            <div className="st-row-label">{t.settings.autostart}</div>
            <div className="st-row-desc">{t.settings.autostartDesc}</div>
          </div>
          <button
            role="switch"
            aria-checked={autostart}
            className={`st-toggle${autostart ? " active" : ""}`}
            onClick={() => setAutostart(!autostart)}
            aria-label={t.settings.autostart}
          />
        </div>
      </section>

      {/* III — Cá nhân: ngày sinh, tab Tầm nhìn dùng để tính tuổi */}
      <section className="st-section">
        <div className="st-section-head">
          <span className="st-section-num">III</span>
          <h3 className="st-section-title">{t.settings.groupPersonal}</h3>
        </div>

        <div className="st-row">
          <div className="st-row-text">
            <div className="st-row-label">{t.settings.birthDate}</div>
            <div className="st-row-desc">{t.settings.birthDateDesc}</div>
          </div>
          <div className="st-date-wrap">
            <input
              type="date"
              className="st-date"
              value={birthDate ?? ""}
              max={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setBirthDate(e.target.value || null)}
              aria-label={t.settings.birthDate}
            />
            {birthDate && (
              <button
                className="st-icon-btn"
                onClick={() => setBirthDate(null)}
                title={t.settings.clearBirthDate}
                aria-label={t.settings.clearBirthDate}
              >
                <IconX size={13} stroke={1.75} />
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
