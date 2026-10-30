import { useRef, useState } from "react";
import { IconPhoto, IconFolderOpen, IconTrash } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { isTauri } from "../../store/mockDb";
import { useT } from "../../i18n";

export default function BackgroundTab() {
  const {
    backgroundEnabled,
    backgroundOpacity,
    backgroundImageUrl,
    setBackgroundImage,
    removeBackgroundImage,
    setBackgroundOpacity,
    setBackgroundEnabled,
    uiTransparency,
    setUiTransparency,
    openBackgroundImageFolder,
  } = useAppStore();
  const t = useT();
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const [bgUploading, setBgUploading] = useState(false);

  function handleBgChooseClick() {
    bgFileInputRef.current?.click();
  }

  async function handleBgFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBgUploading(true);
    try {
      await setBackgroundImage(file);
      setBackgroundEnabled(true);
    } finally {
      setBgUploading(false);
    }
  }

  const pct = (v: number) => ({ "--pct": `${v}%` }) as React.CSSProperties;

  return (
    <div className="st-panel">
      {!isTauri() ? (
        <p className="st-empty">{t.settings.backgroundUnavailable}</p>
      ) : (
        <>
          {/* I — Ảnh nền */}
          <section className="st-section">
            <div className="st-section-head">
              <span className="st-section-num">I</span>
              <h3 className="st-section-title">{t.settings.backgroundImage}</h3>
            </div>

            <div className="st-row">
              <div className="st-row-text">
                <div className="st-row-label">{t.settings.backgroundEnable}</div>
                <div className="st-row-desc">{t.settings.backgroundEnableDesc}</div>
              </div>
              <button
                role="switch"
                aria-checked={backgroundEnabled}
                className={`st-toggle${backgroundEnabled ? " active" : ""}`}
                onClick={() => setBackgroundEnabled(!backgroundEnabled)}
                disabled={!backgroundImageUrl}
                aria-label={t.settings.backgroundEnable}
              />
            </div>

            <div className="st-bg">
              {backgroundImageUrl && <img src={backgroundImageUrl} alt="" className="st-bg-preview" />}
              <div className="st-bg-actions">
                <button className="st-btn" onClick={handleBgChooseClick} disabled={bgUploading}>
                  <IconPhoto size={14} stroke={1.75} />
                  {bgUploading ? t.settings.backgroundUploading : t.settings.backgroundChoose}
                </button>
                {backgroundImageUrl && (
                  <button className="st-btn" onClick={openBackgroundImageFolder}>
                    <IconFolderOpen size={14} stroke={1.75} />
                    {t.settings.backgroundOpenFolder}
                  </button>
                )}
                {backgroundImageUrl && (
                  <button className="st-btn danger" onClick={removeBackgroundImage}>
                    <IconTrash size={14} stroke={1.75} />
                    {t.settings.backgroundRemove}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* II — Hiển thị (chỉ khi đã có ảnh) */}
          {backgroundImageUrl && (
            <section className="st-section">
              <div className="st-section-head">
                <span className="st-section-num">II</span>
                <h3 className="st-section-title">{t.settings.backgroundDisplay}</h3>
              </div>

              <div className="st-row">
                <div className="st-row-text">
                  <div className="st-row-label">{t.settings.backgroundOpacity}</div>
                </div>
                <div className="st-range-wrap">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={backgroundOpacity}
                    className="st-range"
                    style={pct(backgroundOpacity)}
                    onChange={(e) => setBackgroundOpacity(Number(e.target.value))}
                    aria-label={t.settings.backgroundOpacity}
                  />
                  <span className="st-range-val">{backgroundOpacity}%</span>
                </div>
              </div>

              <div className="st-row">
                <div className="st-row-text">
                  <div className="st-row-label">{t.settings.backgroundUiTransparency}</div>
                  <div className="st-row-desc">{t.settings.backgroundUiTransparencyDesc}</div>
                </div>
                <div className="st-range-wrap">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={uiTransparency}
                    className="st-range"
                    style={pct(uiTransparency)}
                    onChange={(e) => setUiTransparency(Number(e.target.value))}
                    aria-label={t.settings.backgroundUiTransparency}
                  />
                  <span className="st-range-val">{uiTransparency}%</span>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <input
        ref={bgFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleBgFileChange}
      />
    </div>
  );
}
