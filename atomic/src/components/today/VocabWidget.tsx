import { useState, useEffect, useLayoutEffect, useRef, useCallback, type MouseEvent } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { dbGetVocabWords, getVocabInterval, getVocabIndex, saveVocabIndex } from '../../store/vocabDb';
import { useT } from '../../i18n';
import type { VocabWord } from '../../types';
import './VocabWidget.css';

const EXPAND_MS = 400;
const COLLAPSE_MS = 320;
const OPEN_CLASS = 'vw-content--open';
// Tờ giấy nổi lên (bản head). Bật/tắt bằng JS chứ không dùng `:hover`: bấm ‹ ›
// thay nút dưới con trỏ bằng nút mới (nội dung remount) và Chromium bỏ trạng
// thái hover cho tới lần rê chuột kế tiếp — nội dung còn mở mà nền biến mất.
const LIFTED_CLASS = 'vw--lifted';
// Nhịp cập nhật dòng "N phút nữa đổi từ" (vạch tiến độ thì chạy bằng CSS).
const TICK_MS = 15_000;

/**
 * Từ vựng kiểu "mục từ điển" (editorial).
 * - `head`: góc phải măng-sét tab Hôm nay — lúc nghỉ chỉ có chữ (từ, phiên âm,
 *   nghĩa 1 dòng); rê chuột thì nổi lên tờ giấy, mở đủ nghĩa + nghĩa EN + chân
 *   (thời gian còn lại, nút lùi/tới), đè lên hàng đồng hồ.
 * - `side`: cột trái Day view tab Lịch — hiện đủ mọi thứ, không thu gọn.
 */
type Variant = 'head' | 'side';

/** Phiên âm luôn hiện trong một cặp gạch chéo, bỏ gạch chéo người dùng gõ kèm. */
function formatIpa(ipa: string) {
  const core = ipa.trim().replace(/^\/+|\/+$/g, '').trim();
  return core ? `/${core}/` : '';
}

/**
 * Vạch tiến độ tới lần đổi từ kế tiếp. Remount mỗi chu kỳ (key), độ trễ âm tính
 * một lần lúc mount để vạch đúng vị trí cả khi nội dung remount giữa chu kỳ
 * (danh sách từ đổi trong Cài đặt). Không tính lại theo từng render: đổi
 * animation-delay khi animation đang chạy sẽ làm vạch nhảy.
 */
function CycleBar({ start, end }: { start: number; end: number }) {
  const [delay] = useState(() => start - Date.now());
  return (
    <span
      className="vw-prog-fill"
      style={{ animationDuration: `${end - start}ms`, animationDelay: `${delay}ms` }}
    />
  );
}

export default function VocabWidget({ variant }: { variant: Variant }) {
  const t = useT();
  const [current, setCurrent] = useState<VocabWord | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [contentKey, setContentKey] = useState(0);
  const [intervalMinutes, setIntervalMinutes] = useState(getVocabInterval);
  const [loaded, setLoaded] = useState(false);
  // Chu kỳ hiện tại: lúc bắt đầu → lúc tự đổi từ. Bấm lùi/tới cũng bắt đầu chu kỳ mới.
  const [cycle, setCycle] = useState({ start: 0, end: 0 });
  const [now, setNow] = useState(() => Date.now());
  const wordsRef = useRef<VocabWord[]>([]);
  const indexRef = useRef(0);
  const intervalMsRef = useRef(intervalMinutes * 60_000);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const isHoveringRef = useRef(false);
  const unliftTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(unliftTimerRef.current), []);

  const loadWords = useCallback(async () => {
    const ws = await dbGetVocabWords();
    wordsRef.current = ws;
    if (ws.length === 0) {
      setCurrent(null);
      setLoaded(false);
      return;
    }
    const idx = getVocabIndex() % ws.length;
    indexRef.current = idx;
    setCurrent(ws[idx]);
    setWordCount(ws.length);
    setContentKey((k) => k + 1);
    setLoaded(true);
  }, []);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  useEffect(() => {
    const onSettingsChange = () => setIntervalMinutes(getVocabInterval());
    const onWordsChange = () => loadWords();
    window.addEventListener('vocabSettingsChanged', onSettingsChange);
    window.addEventListener('vocabWordsChanged', onWordsChange);
    return () => {
      window.removeEventListener('vocabSettingsChanged', onSettingsChange);
      window.removeEventListener('vocabWordsChanged', onWordsChange);
    };
  }, [loadWords]);

  const restartCycle = useCallback(() => {
    const start = Date.now();
    setNow(start);
    setCycle({ start, end: start + intervalMsRef.current });
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      const words = wordsRef.current;
      if (words.length === 0) return;
      const next = (indexRef.current + dir + words.length) % words.length;
      indexRef.current = next;
      saveVocabIndex(next);
      setCurrent(words[next]);
      setContentKey((k) => k + 1);
      restartCycle();
    },
    [restartCycle],
  );

  // Bắt đầu chu kỳ khi có từ, và bắt đầu lại khi đổi khoảng thời gian trong Cài đặt.
  useEffect(() => {
    intervalMsRef.current = intervalMinutes * 60_000;
    if (loaded) restartCycle();
  }, [intervalMinutes, loaded, restartCycle]);

  // Tự đổi từ khi hết chu kỳ.
  useEffect(() => {
    if (!loaded || cycle.end === 0) return;
    const id = setTimeout(() => step(1), Math.max(0, cycle.end - Date.now()));
    return () => clearTimeout(id);
  }, [loaded, cycle.end, step]);

  useEffect(() => {
    if (!loaded) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [loaded]);

  const handleClick = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    step(1);
  }, [step]);

  const handlePrev = (e: MouseEvent) => {
    e.stopPropagation();
    step(-1);
  };

  const handleNext = (e: MouseEvent) => {
    e.stopPropagation();
    step(1);
  };

  // Mở/thu bằng tay (không dựa vào CSS `:hover` + timing re-render của React —
  // cách đó từng bị đua: việc bỏ nowrap của nghĩa và đổi max-height rơi vào
  // cùng một lần tính style, trình duyệt không còn gì để nội suy nên nhảy cái
  // một thay vì trượt). Ở đây mọi bước ép đồng bộ theo thứ tự: thêm class mở
  // (nghĩa xuống dòng, chân hiện), đo chiều cao thật cần, ghim khung ở chiều
  // cao hiện tại, ép reflow để chiều cao ghim thành một khung hình "trước" thật,
  // rồi mới đặt transition + chiều cao đích — luôn có 2 khung hình riêng để
  // trình duyệt chuyển giữa chúng.
  const expand = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const collapsedPx = el.offsetHeight;
    el.classList.add(OPEN_CLASS);
    const fullPx = el.scrollHeight;
    if (fullPx <= collapsedPx) {
      el.classList.remove(OPEN_CLASS);
      return;
    }
    el.style.transition = 'none';
    el.style.maxHeight = `${collapsedPx}px`;
    void el.offsetHeight; // ép reflow — chốt chiều cao ghim thành một khung hình thật
    // rAF kép: một rAF có thể chạy trước khi khung hình ghim kịp vẽ (cửa sổ rộng,
    // nhiều blur) → ghim và bắt đầu transition bị gộp làm một, ra cú nhảy.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `max-height ${EXPAND_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`;
        el.style.maxHeight = `${fullPx}px`;
      });
    });
  }, []);

  const collapse = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const currentPx = el.offsetHeight;
    el.style.transition = 'none';
    el.style.maxHeight = `${currentPx}px`; // ghim đúng chỗ đang dừng (kể cả khi đang mở dở)
    void el.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = `max-height ${COLLAPSE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`;
        el.style.maxHeight = '';
        el.classList.remove(OPEN_CLASS);
      });
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    window.clearTimeout(unliftTimerRef.current);
    rootRef.current?.classList.add(LIFTED_CLASS);
    expand();
  }, [expand]);

  // Gỡ tờ giấy sau khi thu xong — gỡ ngay thì chữ đang thu dở nằm trên nền
  // trong suốt, đè lên hàng đồng hồ.
  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    collapse();
    window.clearTimeout(unliftTimerRef.current);
    unliftTimerRef.current = window.setTimeout(() => {
      rootRef.current?.classList.remove(LIFTED_CLASS);
    }, COLLAPSE_MS);
  }, [collapse]);

  // Từ đổi khi chuột đang nằm trên khung (hết chu kỳ, hoặc bấm ‹ ›) — nội dung
  // vừa remount (key mới) chưa có class/inline style, nên mở lại ngay (nhảy
  // chiều cao ở đây không sao, nó đi cùng hiệu ứng trượt vào của từ mới).
  useLayoutEffect(() => {
    if (!isHoveringRef.current) return;
    const el = contentRef.current;
    if (!el) return;
    el.classList.add(OPEN_CLASS);
    const collapsedPx = parseFloat(getComputedStyle(el).maxHeight) || 0;
    const fullPx = el.scrollHeight;
    if (fullPx > collapsedPx) {
      el.style.transition = 'none';
      el.style.maxHeight = `${fullPx}px`;
    } else {
      el.classList.remove(OPEN_CLASS);
    }
  }, [current]);

  if (!current) return null;

  const isHead = variant === 'head';
  const ipa = formatIpa(current.ipa);
  const minsLeft = Math.max(1, Math.ceil((cycle.end - now) / 60_000));
  const single = wordCount < 2;

  return (
    <div
      ref={rootRef}
      className={`vw vw--${variant}`}
      onClick={handleClick}
      onMouseEnter={isHead ? handleMouseEnter : undefined}
      onMouseLeave={isHead ? handleMouseLeave : undefined}
      title={t.vocab.clickHint}
    >
      <div className="vw-top">
        <span className="vw-label">{t.vocab.widgetHeader}</span>
      </div>

      <div className="vw-content" key={contentKey} ref={contentRef}>
        <div className="vw-word-row">
          <span className="vw-word">{current.word}</span>
          {ipa && <span className="vw-ipa">{ipa}</span>}
        </div>
        <p className="vw-meaning">{current.meaning}</p>
        {current.meaning_en && <p className="vw-en">{current.meaning_en}</p>}
        <div className="vw-foot">
          <span className="vw-timer">
            <span className="vw-prog" aria-hidden="true">
              {cycle.end > 0 && <CycleBar key={cycle.end} start={cycle.start} end={cycle.end} />}
            </span>
            {/* Cột Day view chỉ 216px: câu ngắn, tooltip giữ câu đầy đủ */}
            <span className="vw-timer-text" title={isHead ? undefined : t.vocab.nextIn(minsLeft)}>
              {isHead ? t.vocab.nextIn(minsLeft) : t.vocab.nextInShort(minsLeft)}
            </span>
          </span>
          <button
            type="button"
            className="vw-nav"
            onClick={handlePrev}
            disabled={single}
            title={t.vocab.prevWord}
            aria-label={t.vocab.prevWord}
          >
            <IconChevronLeft size="0.85rem" stroke={2} />
          </button>
          <button
            type="button"
            className="vw-nav"
            onClick={handleNext}
            disabled={single}
            title={t.vocab.nextWord}
            aria-label={t.vocab.nextWord}
          >
            <IconChevronRight size="0.85rem" stroke={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
