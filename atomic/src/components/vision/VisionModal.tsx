import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NewVision, Vision } from '../../types';
import { useT } from '../../i18n';
import { useModalClose } from '../../hooks/useModalClose';
import ResizableTextarea from '../ResizableTextarea';
import { ageOn, birthdayAt, todayISO } from './visionUtils';

interface VisionModalProps {
  initial?: Vision;
  birthDate: string | null;
  onSave: (data: NewVision) => Promise<void>;
  onClose: () => void;
}

export default function VisionModal({ initial, birthDate, onSave, onClose }: VisionModalProps) {
  const t = useT();
  const overlayHandlers = useModalClose(onClose);

  // Sửa cột mốc: điền lại tuổi nếu hạn đúng bằng sinh nhật năm đó (tức trước đây đã đặt theo tuổi)
  const initialAge = (() => {
    if (!initial || !birthDate) return '';
    const age = ageOn(birthDate, initial.target_date);
    return birthdayAt(birthDate, age) === initial.target_date ? String(age) : '';
  })();

  const [age, setAge] = useState(initialAge);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? '');
  const [startDate, setStartDate] = useState(initial?.start_date ?? todayISO());
  const [motto, setMotto] = useState(initial?.motto ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleAge(value: string) {
    const prevAuto = age ? t.vision.autoTitle(Number(age)) : '';
    setAge(value);
    const n = parseInt(value, 10);
    if (!birthDate || Number.isNaN(n) || n <= 0 || n > 130) return;
    setTargetDate(birthdayAt(birthDate, n));
    if (!title.trim() || title === prevAuto) setTitle(t.vision.autoTitle(n));
  }

  const valid = !!title.trim() && !!targetDate && !!startDate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    await onSave({ title: title.trim(), target_date: targetDate, start_date: startDate, motto: motto.trim() || null });
    setSaving(false);
  }

  return createPortal(
    <div className="modal-overlay" {...overlayHandlers}>
      <div className="modal vision-modal">
        <div className="modal-title">{initial ? t.vision.visionModalEdit : t.vision.visionModalAdd}</div>
        <form onSubmit={handleSubmit}>
          {birthDate ? (
            <div className="form-group">
              <label className="form-label" htmlFor="vision-age">{t.vision.byAgeLabel}</label>
              <div className="vision-age-row">
                <input
                  id="vision-age"
                  className="form-input vision-age-input"
                  type="number"
                  min={1}
                  max={130}
                  value={age}
                  onChange={(e) => handleAge(e.target.value)}
                  autoFocus={!initial}
                />
                <span className="vision-form-hint">{t.vision.byAgeHint}</span>
              </div>
            </div>
          ) : (
            <p className="vision-form-note">{t.vision.noBirthDateHint}</p>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="vision-title">{t.vision.visionTitleLabel}</label>
            <input
              id="vision-title"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.vision.visionTitlePlaceholder}
              spellCheck={false}
              autoFocus={!!initial || !birthDate}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="vision-target">{t.vision.targetDateLabel}</label>
              <input id="vision-target" className="form-input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="vision-start">{t.vision.startDateLabel}</label>
              <input id="vision-start" className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="vision-motto">{t.vision.mottoLabel}</label>
            <ResizableTextarea
              id="vision-motto"
              className="form-input vision-motto-input"
              value={motto}
              onChange={(e) => setMotto(e.target.value)}
              placeholder={t.vision.mottoPlaceholder}
              rows={2}
              spellCheck={false}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t.vision.cancel}</button>
            <button type="submit" className="btn btn-primary" disabled={!valid || saving}>{t.vision.save}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
