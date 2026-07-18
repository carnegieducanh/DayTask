import { useState, useRef, useEffect } from "react";
import { IconCheck, IconX, IconPencil, IconTrash, IconChevronRight } from "@tabler/icons-react";
import { useT } from "../../i18n";
import { loadGreetings, saveGreetings, resetGreetings } from "../../store/greetingsStore";
import type { Period, GreetingItem, GreetingsStore } from "../../store/greetingsStore";

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
