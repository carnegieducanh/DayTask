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

  return (
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
