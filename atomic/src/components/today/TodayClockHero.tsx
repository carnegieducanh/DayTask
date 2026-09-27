import { useEffect, useState } from "react";
import { useT } from "../../i18n";

// Always shows the real current time/date — independent of selectedDate.
export default function TodayClockHero() {
  const t = useT();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Tick exactly on minute boundaries instead of polling every second.
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const d = new Date();
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, 60_000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 20);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return (
    <div className="today-clock-hero">
      <div className="today-clock-date">
        {t.today.heroDate(t.journal.dowFull[now.getDay()], now.getDate(), now.getMonth() + 1)}
      </div>
      <div className="today-clock-time">
        {hh}
        <span className="today-clock-colon">:</span>
        {mm}
      </div>
    </div>
  );
}
