import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import { loadGreetings } from '../../store/greetingsStore';
import type { Period } from '../../store/greetingsStore';

function getPeriod(hour: number): Period {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 13) return 'noon';
  if (hour >= 13 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

interface Props {
  pendingCount: number;
  isToday: boolean;
}

export default function DailyGreeting({ pendingCount, isToday }: Props) {
  const t = useT();
  const language = useAppStore((s) => s.language);
  const [visible, setVisible] = useState(false);
  const period = getPeriod(new Date().getHours());

  const message = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const sessionKey = `atomic_greeting_session_${language}_${period}`;
    const localKey = `atomic_greeting_${today}_${period}`;

    const sessionMsg = sessionStorage.getItem(sessionKey);
    if (sessionMsg) return sessionMsg;

    const store = loadGreetings();
    const items = store[period] ?? [];
    const fixedItem = items.find(item => item.isFixed);
    const randomItems = items.filter(item => !item.isFixed);
    const lang = language as 'vi' | 'en';

    let msg: string;
    if (!localStorage.getItem(localKey)) {
      msg = fixedItem?.[lang] ?? randomItems[0]?.[lang] ?? '';
      localStorage.setItem(localKey, '1');
    } else {
      const list = randomItems.map(g => g[lang]).filter(Boolean);
      if (list.length === 0) {
        msg = fixedItem?.[lang] ?? '';
      } else {
        const queueKey = `atomic_greeting_queue_${language}_${period}`;
        let queue: number[] = JSON.parse(localStorage.getItem(queueKey) || '[]');
        if (queue.length === 0 || queue.some((i) => i >= list.length)) {
          queue = Array.from({ length: list.length }, (_, i) => i);
          for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
          }
        }
        const idx = queue.shift()!;
        localStorage.setItem(queueKey, JSON.stringify(queue));
        msg = list[idx];
      }
    }

    sessionStorage.setItem(sessionKey, msg);
    return msg;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, period]);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(id);
  }, []);

  const taskText = pendingCount === 0
    ? t.greeting.noTasks
    : isToday
      ? t.greeting.hasTasks(pendingCount)
      : null;

  return (
    <div className={`daily-greeting${visible ? ' daily-greeting--visible' : ''}`}>
      <div className="daily-greeting-main">{message}</div>
      {taskText && <div className="daily-greeting-sub">{taskText}</div>}
    </div>
  );
}
