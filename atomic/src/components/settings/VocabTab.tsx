import { useState, useRef, useEffect } from "react";
import { IconCheck, IconX, IconPencil, IconTrash } from "@tabler/icons-react";
import { useT } from "../../i18n";
import {
  dbGetVocabWords,
  dbBulkAddVocabWords,
  dbDeleteVocabWord,
  dbUpdateVocabWord,
  dbClearAllVocabWords,
  getVocabInterval,
  saveVocabInterval,
} from "../../store/vocabDb";
import type { VocabWord } from "../../types";

export default function VocabTab() {
  const t = useT();

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

  useEffect(() => {
    dbGetVocabWords().then(setVocabWords);
  }, []);

  useEffect(() => {
    if (deleteVTimerRef.current) clearTimeout(deleteVTimerRef.current);
    if (!pendingDeleteVocab) return;
    deleteVTimerRef.current = setTimeout(async () => {
      await dbDeleteVocabWord(pendingDeleteVocab.id);
      setPendingDeleteVocab(null);
    }, 4000);
    return () => { if (deleteVTimerRef.current) clearTimeout(deleteVTimerRef.current); };
  }, [pendingDeleteVocab]);

  function handleIntervalChange(minutes: number) {
    setVocabIntervalState(minutes);
    saveVocabInterval(minutes);
  }

  function handleDeleteVocabWord(id: number) {
    const word = vocabWords.find((w) => w.id === id);
    if (!word) return;
    if (deleteVTimerRef.current) clearTimeout(deleteVTimerRef.current);
    if (pendingDeleteVocab) dbDeleteVocabWord(pendingDeleteVocab.id);
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

  const editKeys = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleEditVocabSave();
    if (e.key === "Escape") setEditingVocabId(null);
  };

  return (
    <div className="st-panel">
      {/* I — Thời gian đổi từ */}
      <section className="st-section">
        <div className="st-section-head">
          <span className="st-section-num">I</span>
          <h3 className="st-section-title">{t.vocab.intervalLabel}</h3>
        </div>
        <div className="st-row">
          <div className="st-row-text">
            <div className="st-row-desc">{t.vocab.intervalDesc}</div>
          </div>
          <div className="st-range-wrap">
            <input
              type="range"
              min={1}
              max={60}
              step={1}
              value={vocabInterval}
              className="st-range"
              style={{ "--pct": `${((vocabInterval - 1) / 59) * 100}%` } as React.CSSProperties}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              aria-label={t.vocab.intervalLabel}
            />
            <span className="st-range-val">{t.vocab.intervalUnit(vocabInterval)}</span>
          </div>
        </div>
      </section>

      {/* II — Danh sách từ */}
      <section className="st-section">
        <div className="st-section-head">
          <span className="st-section-num">II</span>
          <h3 className="st-section-title">{t.vocab.listTitle}</h3>
          {vocabWords.length > 0 && <span className="st-count">{vocabWords.length}</span>}
          {vocabWords.length > 0 && (
            <span className="st-section-aside">
              {confirmClearVocab ? (
                <>
                  <button className="st-link st-link--danger is-on" onClick={handleClearAllVocab}>
                    {t.vocab.clearAllConfirm}
                  </button>
                  <button className="st-link" onClick={() => setConfirmClearVocab(false)}>
                    {t.toast.undo}
                  </button>
                </>
              ) : (
                <button className="st-link st-link--danger" onClick={() => setConfirmClearVocab(true)}>
                  {t.vocab.clearAll}
                </button>
              )}
            </span>
          )}
        </div>

        <textarea
          ref={pasteZoneRef}
          className="st-paste"
          placeholder={t.vocab.pasteZonePlaceholder}
          onPaste={handleVocabPaste}
          rows={2}
          spellCheck={false}
        />
        {vocabPasteSuccess > 0 && <p className="st-note ok">✓ {t.vocab.pasteSuccess(vocabPasteSuccess)}</p>}

        {vocabWords.length === 0 ? (
          <p className="st-empty">{t.vocab.noWords}</p>
        ) : (
          <table className="st-table">
            <thead>
              <tr>
                <th>{t.vocab.wordCol}</th>
                <th>{t.vocab.ipaCol}</th>
                <th>{t.vocab.meaningCol}</th>
                <th aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {vocabWords.map((w) =>
                editingVocabId === w.id ? (
                  <tr key={w.id} className="is-editing">
                    <td>
                      <input
                        className="st-line-input"
                        value={editVocabFields.word}
                        onChange={(e) => setEditVocabFields((f) => ({ ...f, word: e.target.value }))}
                        onKeyDown={editKeys}
                        autoFocus
                      />
                    </td>
                    <td>
                      <input
                        className="st-line-input st-line-input--ipa"
                        value={editVocabFields.ipa}
                        onChange={(e) => setEditVocabFields((f) => ({ ...f, ipa: e.target.value }))}
                        onKeyDown={editKeys}
                      />
                    </td>
                    <td>
                      <input
                        className="st-line-input"
                        value={editVocabFields.meaning}
                        onChange={(e) => setEditVocabFields((f) => ({ ...f, meaning: e.target.value }))}
                        onKeyDown={editKeys}
                      />
                    </td>
                    <td>
                      <div className="st-actions is-visible">
                        <button className="st-icon-btn" title={t.vocab.saveWord} aria-label={t.vocab.saveWord} onClick={handleEditVocabSave}>
                          <IconCheck size={13} stroke={1.75} />
                        </button>
                        <button className="st-icon-btn" title={t.vocab.cancelEdit} aria-label={t.vocab.cancelEdit} onClick={() => setEditingVocabId(null)}>
                          <IconX size={13} stroke={1.75} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={w.id}>
                    <td className="st-table-word">{w.word}</td>
                    <td className="st-table-ipa">{w.ipa || "—"}</td>
                    <td className="st-table-meaning">{w.meaning}</td>
                    <td>
                      <div className="st-actions">
                        <button className="st-icon-btn" title={t.vocab.editWord} aria-label={t.vocab.editWord} onClick={() => handleEditVocabStart(w)}>
                          <IconPencil size={13} stroke={1.75} />
                        </button>
                        <button
                          className="st-icon-btn danger"
                          title={t.vocab.deleteWord}
                          aria-label={t.vocab.deleteWord}
                          onClick={() => handleDeleteVocabWord(w.id)}
                        >
                          <IconTrash size={13} stroke={1.75} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </section>

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
