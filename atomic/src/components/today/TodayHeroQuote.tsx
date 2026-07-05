import { useEffect, useState } from 'react';
import { IconQuote } from '@tabler/icons-react';
import { dbGetHeroQuote, getHeroModeLS } from '../../store/quotesDb';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import type { Quote } from '../../types';

// Module-level cache: TodayView (and thus this component) unmounts/remounts
// on every tab switch. Seeding state from this cache avoids the "flash of
// nothing then pop-in" jank when returning to the Today tab, while the
// background refetch below still keeps it in sync with real changes.
let cachedHeroQuote: Quote | null = null;
let hasCachedHeroQuote = false;

export function TodayHeroQuote() {
  const [quote, setQuote] = useState<Quote | null | undefined>(
    hasCachedHeroQuote ? cachedHeroQuote : undefined
  );
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const t = useT();

  useEffect(() => {
    const localDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    let lastLoadedDate = localDate();

    function loadQuote() {
      dbGetHeroQuote(getHeroModeLS()).then((q) => {
        cachedHeroQuote = q;
        hasCachedHeroQuote = true;
        setQuote(q);
      });
    }

    loadQuote();

    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      const today = localDate();
      if (today !== lastLoadedDate) {
        lastLoadedDate = today;
        loadQuote();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  if (quote === undefined) return null;

  const tooltip = quote
    ? `${quote.text}${quote.author ? ` — ${quote.author}` : ''}`
    : undefined;

  return (
    <button
      className="today-hero-quote"
      onClick={() => setActiveTab('quotes')}
      title={tooltip}
    >
      <span className="today-hero-quote-icon">
        <IconQuote size={13} strokeWidth={2} />
      </span>
      {quote ? (
        <span className="today-hero-quote-body">
          <span className="today-hero-quote-text">{quote.text}</span>
          {quote.author && (
            <span className="today-hero-quote-author"> — {quote.author}</span>
          )}
        </span>
      ) : (
        <span className="today-hero-quote-empty">{t.quotes.todayPlaceholder}</span>
      )}
    </button>
  );
}
