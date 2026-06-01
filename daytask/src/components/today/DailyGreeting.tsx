import { useState, useEffect } from 'react';
import { format } from 'date-fns';

type Period = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

function getPeriod(hour: number): Period {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 13) return 'noon';
  if (hour >= 13 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

const MESSAGES: Record<Period, { fixed: string; random: string[] }> = {
  morning: {
    fixed: 'Buổi sáng tốt lành!',
    random: [
      'Một buổi sáng mới, một cơ hội mới.',
      'Bắt đầu ngày với năng lượng tích cực.',
      'Hít thở sâu và bắt đầu thôi.',
      'Ngày hôm nay thuộc về bạn.',
      'Mỗi buổi sáng là một trang mới.',
    ],
  },
  noon: {
    fixed: 'Buổi trưa vui vẻ!',
    random: [
      'Nhớ nghỉ ngơi một chút nhé.',
      'Giữa ngày rồi, tiếp tục nào!',
      'Hãy nạp năng lượng và tiếp tục.',
      'Một nửa ngày đã qua, làm tốt lắm!',
    ],
  },
  afternoon: {
    fixed: 'Buổi chiều năng động!',
    random: [
      'Chặng cuối của ngày, cố lên!',
      'Tập trung để kết thúc ngày thật tốt.',
      'Bạn đang làm rất tốt đấy.',
      'Vài giờ nữa thôi, tiếp tục nào!',
    ],
  },
  evening: {
    fixed: 'Buổi tối bình yên!',
    random: [
      'Nhìn lại những gì đã hoàn thành hôm nay.',
      'Nghỉ ngơi xứng đáng sau một ngày dài.',
      'Tắt bớt màn hình và thư giãn.',
      'Hôm nay bạn đã cố gắng rất nhiều.',
    ],
  },
  night: {
    fixed: 'Thức khuya rồi đấy!',
    random: [
      'Nhớ nghỉ ngơi đủ giấc nhé.',
      'Cơ thể cần nghỉ ngơi để tái tạo.',
      'Ngày mai sẽ tiếp tục, hãy nghỉ đi.',
      'Giấc ngủ tốt là nền tảng của ngày mới.',
    ],
  },
};

function pickMessage(period: Period): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const sessionKey = `atomic_greeting_session_${period}`;
  const localKey = `atomic_greeting_${today}_${period}`;

  // Same session + same period → show same message (no flicker on tab switch)
  const sessionMsg = sessionStorage.getItem(sessionKey);
  if (sessionMsg) return sessionMsg;

  // First time today in this period → fixed greeting; afterwards → random
  let msg: string;
  if (!localStorage.getItem(localKey)) {
    msg = MESSAGES[period].fixed;
    localStorage.setItem(localKey, '1');
  } else {
    const list = MESSAGES[period].random;
    msg = list[Math.floor(Math.random() * list.length)];
  }

  sessionStorage.setItem(sessionKey, msg);
  return msg;
}

interface Props {
  pendingCount: number;
  isToday: boolean;
}

export default function DailyGreeting({ pendingCount, isToday }: Props) {
  const [visible, setVisible] = useState(false);
  const period = getPeriod(new Date().getHours());
  const [message] = useState(() => pickMessage(period));

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(id);
  }, []);

  const taskText = isToday
    ? pendingCount === 0
      ? 'Không có task nào còn lại hôm nay.'
      : `Bạn có ${pendingCount} việc cần hoàn thành hôm nay.`
    : null;

  return (
    <div className={`daily-greeting${visible ? ' daily-greeting--visible' : ''}`}>
      <div className="daily-greeting-main">{message}</div>
      {taskText && <div className="daily-greeting-sub">{taskText}</div>}
    </div>
  );
}
