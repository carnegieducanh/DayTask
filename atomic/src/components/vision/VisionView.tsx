import { useEffect, useRef, useState } from 'react';
import './vision.css';
import { IconPlus, IconTelescope } from '@tabler/icons-react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import type { AimItem, AimStatus, NewVision, NewVisionAim, Vision, VisionAim, VisionAimLog } from '../../types';
import {
  dbGetVisions, dbAddVision, dbUpdateVision, dbDeleteVision, dbMarkVisionReviewed,
  dbGetAllAims, dbAddAim, dbUpdateAim, dbDeleteAim, dbSetAimStatus, dbSetAimItems,
  dbGetAllAimLogs, dbAddAimLog, dbDeleteAimLog, seedVisionDevData,
} from '../../store/visionDb';
import HorizonRail from './HorizonRail';
import VisionCharter from './VisionCharter';
import VisionModal from './VisionModal';
import AimModal from './AimModal';
import { hasProgress, logsOf, todayISO } from './visionUtils';

const SELECTED_KEY = 'visionSelectedId';

type PendingDelete = { kind: 'vision' | 'aim'; id: number; title: string };

function readSelected(): number | null {
  try {
    const v = localStorage.getItem(SELECTED_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

// Mặc định mở cột mốc sắp tới gần nhất; nếu tất cả đã qua hạn thì mở cái vừa qua.
function defaultVision(visions: Vision[], today: string): Vision | undefined {
  return visions.find((v) => v.target_date >= today) ?? visions[visions.length - 1];
}

async function commitDelete(p: PendingDelete) {
  if (p.kind === 'vision') await dbDeleteVision(p.id);
  else await dbDeleteAim(p.id);
}

export default function VisionView() {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const birthDate = useAppStore((s) => s.birthDate);
  const categoryColors = useAppStore((s) => s.categoryColors);

  const [visions, setVisions] = useState<Vision[]>([]);
  const [aims, setAims] = useState<VisionAim[]>([]);
  const [logs, setLogs] = useState<VisionAimLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(readSelected);
  const [openAimId, setOpenAimId] = useState<number | null>(null);
  const [justStampedId, setJustStampedId] = useState<number | null>(null);
  const [visionModal, setVisionModal] = useState<{ initial?: Vision } | null>(null);
  const [aimModal, setAimModal] = useState<{ initial?: VisionAim } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingRef = useRef<PendingDelete | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(stageRef);

  const today = todayISO();

  async function reload() {
    const [v, a, l] = await Promise.all([dbGetVisions(), dbGetAllAims(), dbGetAllAimLogs()]);
    setVisions(v);
    setAims(a);
    setLogs(l);
    setLoaded(true);
  }

  useEffect(() => {
    seedVisionDevData().then(reload);
    // Rời tab khi đang chờ hoàn tác: xóa luôn, đừng để mất lệnh xóa
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current) commitDelete(pendingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleVisions = visions.filter((v) => !(pendingDelete?.kind === 'vision' && pendingDelete.id === v.id));
  const visibleAims = aims.filter((a) => !(pendingDelete?.kind === 'aim' && pendingDelete.id === a.id));
  const selected = visibleVisions.find((v) => v.id === selectedId) ?? defaultVision(visibleVisions, today);
  const selectedAims = selected ? visibleAims.filter((a) => a.vision_id === selected.id) : [];

  function select(id: number) {
    setSelectedId(id);
    setOpenAimId(null);
    try {
      localStorage.setItem(SELECTED_KEY, String(id));
    } catch {
      // bỏ qua nếu storage bị chặn
    }
  }

  // ── Xóa có hoàn tác 4 giây ──

  function scheduleDelete(p: PendingDelete) {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pendingRef.current) commitDelete(pendingRef.current);
    pendingRef.current = p;
    setPendingDelete(p);
    timerRef.current = setTimeout(async () => {
      await commitDelete(p);
      pendingRef.current = null;
      setPendingDelete(null);
      reload();
    }, 4000);
  }

  function undoDelete() {
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;
    setPendingDelete(null);
  }

  // ── Cột mốc ──

  async function saveVision(data: NewVision) {
    if (visionModal?.initial) {
      await dbUpdateVision(visionModal.initial.id, data);
    } else {
      const id = await dbAddVision(data);
      select(id);
    }
    setVisionModal(null);
    await reload();
  }

  async function markReviewed(v: Vision) {
    await dbMarkVisionReviewed(v.id, today);
    setVisions((prev) => prev.map((x) => (x.id === v.id ? { ...x, reviewed_at: today } : x)));
  }

  // ── Mục tiêu ──

  async function saveAim(data: NewVisionAim) {
    if (aimModal?.initial) await dbUpdateAim(aimModal.initial.id, data);
    else await dbAddAim(data);
    setAimModal(null);
    await reload();
  }

  async function setStatus(aim: VisionAim, status: AimStatus) {
    const achievedDate = status === 'achieved' ? today : null;
    await dbSetAimStatus(aim.id, status, achievedDate);
    setAims((prev) => prev.map((a) => (a.id === aim.id ? { ...a, status, achieved_date: achievedDate } : a)));
    setJustStampedId(status === 'achieved' ? aim.id : null);
  }

  // Ghi tiến độ đầu tiên cho mục tiêu "Chưa bắt đầu" thì tự chuyển sang "Đang theo đuổi"
  async function bumpIfStarted(aim: VisionAim, nextItems: AimItem[], nextLogs: VisionAimLog[]) {
    if (aim.status !== 'not_started' || !hasProgress({ ...aim, items: nextItems }, nextLogs)) return;
    await setStatus(aim, 'in_progress');
  }

  async function addLog(aim: VisionAim, date: string, value: number, note: string | null) {
    await dbAddAimLog(aim.id, date, value, note);
    const nextLogs = await dbGetAllAimLogs();
    setLogs(nextLogs);
    await bumpIfStarted(aim, aim.items, logsOf(aim.id, nextLogs));
  }

  async function deleteLog(id: number) {
    await dbDeleteAimLog(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  async function setItems(aim: VisionAim, items: AimItem[]) {
    setAims((prev) => prev.map((a) => (a.id === aim.id ? { ...a, items } : a)));
    await dbSetAimItems(aim.id, items);
    await bumpIfStarted(aim, items, logsOf(aim.id, logs));
  }

  return (
    <div className="vision-wrap">
      <HorizonRail
        visions={visibleVisions}
        aims={visibleAims}
        selectedId={selected?.id ?? null}
        today={today}
        birthDate={birthDate}
        lang={lang}
        onSelect={select}
        onAdd={() => setVisionModal({})}
      />

      <div className="vision-stage" ref={stageRef}>
        {loaded && selected && (
          <VisionCharter
            key={selected.id}
            vision={selected}
            aims={selectedAims}
            logs={logs}
            lang={lang}
            today={today}
            categoryColors={categoryColors}
            openAimId={openAimId}
            justStampedId={justStampedId}
            onToggleAim={(id) => setOpenAimId((prev) => (prev === id ? null : id))}
            onEditVision={() => setVisionModal({ initial: selected })}
            onDeleteVision={() => scheduleDelete({ kind: 'vision', id: selected.id, title: selected.title })}
            onMarkReviewed={() => markReviewed(selected)}
            onAddAim={() => setAimModal({})}
            onEditAim={(aim) => setAimModal({ initial: aim })}
            onDeleteAim={(aim) => scheduleDelete({ kind: 'aim', id: aim.id, title: aim.title })}
            onSetStatus={setStatus}
            onAddLog={addLog}
            onDeleteLog={deleteLog}
            onSetItems={setItems}
          />
        )}
        {loaded && !selected && (
          <div className="vision-paper vision-empty-paper">
            <div className="vision-paper-inner">
              <div className="vc-empty">
                <IconTelescope size={32} stroke={1.3} />
                <h4>{t.vision.emptyTitle}</h4>
                <p>{t.vision.emptyDesc}</p>
                <button type="button" className="btn btn-primary vc-empty-btn" onClick={() => setVisionModal({})}>
                  <IconPlus size={15} />
                  {t.vision.addFirstVision}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {pendingDelete && (
        <div className="delete-toast" role="status">
          <span className="delete-toast-msg">{t.vision.deleted(pendingDelete.title)}</span>
          <button className="delete-toast-undo" onClick={undoDelete}>{t.vision.undo}</button>
        </div>
      )}

      {visionModal && (
        <VisionModal
          initial={visionModal.initial}
          birthDate={birthDate}
          onSave={saveVision}
          onClose={() => setVisionModal(null)}
        />
      )}
      {aimModal && selected && (
        <AimModal
          vision={selected}
          initial={aimModal.initial}
          categoryColors={categoryColors}
          onSave={saveAim}
          onClose={() => setAimModal(null)}
        />
      )}
    </div>
  );
}
