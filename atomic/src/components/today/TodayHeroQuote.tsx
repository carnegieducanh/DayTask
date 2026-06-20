import { useEffect, useState } from 'react';
import { IconQuote } from '@tabler/icons-react';
import { dbGetHeroQuote, getHeroModeLS } from '../../store/quotesDb';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import type { Quote } from '../../types';

export function TodayHeroQuote() {
  const [quote, setQuote] = useState<Quote | null | undefined>(undefined);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const t = useT();

  useEffect(() => {
    dbGetHeroQuote(getHeroModeLS()).then(setQuote);
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
