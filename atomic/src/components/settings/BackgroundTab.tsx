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

  return (
    <div className="settings-tab-panel">
      {!isTauri() ? (
        <p className="settings-backup-hint" style={{ padding: "10px 16px" }}>
          {t.settings.backgroundUnavailable}
        </p>
      ) : (
        <>
          <div className="settings-section">
            <div className="settings-row">
              <div>
                <div className="settings-row-label">{t.settings.backgroundEnable}</div>
                <div className="settings-row-sub">{t.settings.backgroundEnableDesc}</div>
              </div>
              <button
                className={`settings-toggle${backgroundEnabled ? " active" : ""}`}
                onClick={() => setBackgroundEnabled(!backgroundEnabled)}
                disabled={!backgroundImageUrl}
                aria-label={t.settings.backgroundEnable}
              />
            </div>
          </div>

          <div className="settings-divider" />

          <div className="settings-section">
            <div className="settings-section-label">{t.settings.backgroundImage}</div>

            <div className="settings-bg-preview-row">
              {backgroundImageUrl && (
                <img src={backgroundImageUrl} alt="" className="settings-bg-preview" />
              )}
              <div className="settings-action-group">
                <button className="settings-action-btn" onClick={handleBgChooseClick} disabled={bgUploading}>
                  <IconPhoto size={14} />
                  {bgUploading ? t.settings.backgroundUploading : t.settings.backgroundChoose}
                </button>
                {backgroundImageUrl && (
                  <button className="settings-action-btn" onClick={openBackgroundImageFolder}>
                    <IconFolderOpen size={14} />
                    {t.settings.backgroundOpenFolder}
                  </button>
                )}
                {backgroundImageUrl && (
                  <button className="settings-action-btn" onClick={removeBackgroundImage}>
                    <IconTrash size={14} />
                    {t.settings.backgroundRemove}
                  </button>
                )}
              </div>
            </div>
          </div>

          {backgroundImageUrl && (
            <>
              <div className="settings-divider" />
              <div className="settings-section">
                <div className="settings-section-label">{t.settings.backgroundOpacity}</div>
                <div className="vocab-interval-row">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={backgroundOpacity}
                    className="vocab-interval-slider"
                    onChange={(e) => setBackgroundOpacity(Number(e.target.value))}
                  />
                  <span className="vocab-interval-label">{backgroundOpacity}%</span>
                </div>
              </div>

              <div className="settings-divider" />
              <div className="settings-section">
                <div className="settings-section-label">{t.settings.backgroundUiTransparency}</div>
                <div className="settings-row-sub" style={{ padding: "0 16px 6px" }}>
                  {t.settings.backgroundUiTransparencyDesc}
                </div>
                <div className="vocab-interval-row">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={uiTransparency}
                    className="vocab-interval-slider"
                    onChange={(e) => setUiTransparency(Number(e.target.value))}
                  />
                  <span className="vocab-interval-label">{uiTransparency}%</span>
                </div>
              </div>
            </>
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
