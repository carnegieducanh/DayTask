import { useState, useRef, useEffect } from "react";
import { IconCheck, IconX, IconPencil, IconTrash, IconChevronRight } from "@tabler/icons-react";
import { useT } from "../../i18n";
import { loadGreetings, saveGreetings, resetGreetings } from "../../store/greetingsStore";
import type { Period, GreetingItem, GreetingsStore } from "../../store/greetingsStore";

const ROMAN = ["I", "II", "III", "IV", "V"];

export default function GreetingTab() {
  const t = useT();

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

  const PERIODS: { key: Period; label: string }[] = [
    { key: "morning", label: t.settings.greetingMorning },
    { key: "noon", label: t.settings.greetingNoon },
    { key: "afternoon", label: t.settings.greetingAfternoon },
    { key: "evening", label: t.settings.greetingEvening },
    { key: "night", label: t.settings.greetingNight },
  ];

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
    <div className="st-panel">
      <div className="st-lead">
        <p className="st-hint">{t.settings.greetingIntro}</p>
        <button className="st-link" onClick={handleReset}>
          {t.settings.greetingReset}
        </button>
      </div>

      <ol className="st-folds">
        {PERIODS.map(({ key, label }, i) => {
          const items = greetingsStore[key] ?? [];
          const isOpen = openPeriod === key;
          return (
            <li key={key} className={`st-fold${isOpen ? " open" : ""}`}>
              <button
                className="st-fold-head"
                aria-expanded={isOpen}
                onClick={() => setOpenPeriod(isOpen ? null : key)}
              >
                <span className="st-fold-num">{ROMAN[i]}</span>
                <span className="st-fold-label">{label}</span>
                <span className="st-count">{items.length}</span>
                <IconChevronRight className="st-fold-chev" size={14} stroke={1.75} />
              </button>

              <div className="st-fold-body">
                <div className="st-fold-inner">
                  {items.length === 0 && addingPeriod !== key && (
                    <p className="st-hint">{t.settings.greetingNoCustom}</p>
                  )}
                  {items.map((g) =>
                    editingId === g.id ? (
                      <div key={g.id} className="st-greet is-editing">
                        <input
                          className="st-line-input"
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
                          className="st-line-input st-line-input--alt"
                          value={editEN}
                          onChange={(e) => setEditEN(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(key);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          spellCheck={false}
                        />
                        <div className="st-actions is-visible">
                          <button className="st-icon-btn" aria-label={t.tags.save} onClick={() => handleSaveEdit(key)}>
                            <IconCheck size={13} stroke={1.75} />
                          </button>
                          <button className="st-icon-btn" aria-label={t.tags.cancel} onClick={cancelEdit}>
                            <IconX size={13} stroke={1.75} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={g.id} className="st-greet">
                        <span className="st-greet-vi">
                          {g.isFixed && (
                            <span className="st-fixed-mark" title={t.settings.greetingFixedHint} />
                          )}
                          {g.vi || "—"}
                        </span>
                        <span className="st-greet-en">{g.en || "—"}</span>
                        <div className="st-actions">
                          <button
                            className="st-icon-btn"
                            title={t.tags.renameTag}
                            aria-label={t.tags.renameTag}
                            onClick={() => handleStartEdit(g)}
                          >
                            <IconPencil size={13} stroke={1.75} />
                          </button>
                          <button
                            className="st-icon-btn danger"
                            title={t.tags.deleteTag}
                            aria-label={t.tags.deleteTag}
                            onClick={() => handleDeleteGreeting(key, g)}
                          >
                            <IconTrash size={13} stroke={1.75} />
                          </button>
                        </div>
                      </div>
                    ),
                  )}

                  {addingPeriod === key ? (
                    <div className="st-greet is-editing">
                      <input
                        className="st-line-input"
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
                        className="st-line-input st-line-input--alt"
                        placeholder={t.settings.greetingPlaceholderEN}
                        value={newEN}
                        onChange={(e) => setNewEN(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddGreeting(key);
                          if (e.key === "Escape") cancelAdd();
                        }}
                        spellCheck={false}
                      />
                      <div className="st-actions is-visible">
                        <button className="st-icon-btn" aria-label={t.tags.save} onClick={() => handleAddGreeting(key)}>
                          <IconCheck size={13} stroke={1.75} />
                        </button>
                        <button className="st-icon-btn" aria-label={t.tags.cancel} onClick={cancelAdd}>
                          <IconX size={13} stroke={1.75} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="st-add" onClick={() => startAdding(key)}>
                      {t.settings.greetingAdd}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

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
    </div>
  );
}
