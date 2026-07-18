import { useState, useEffect } from 'react';
import type { Book } from '../../types';
import { compressImageToDataUrl } from '../../utils/imageUtils';

export type SortBy = 'date' | 'title' | 'author';

const MAX_COVER_DIM = 500;
const COVER_JPEG_QUALITY = 0.82;

export function compressCoverImage(file: File): Promise<string> {
  return compressImageToDataUrl(file, MAX_COVER_DIM, COVER_JPEG_QUALITY);
}

const coverColorCache = new Map<string, string | null>();

function getAverageCoverColor(dataUrl: string): Promise<string | null> {
  const cached = coverColorCache.get(dataUrl);
  if (cached !== undefined) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => { coverColorCache.set(dataUrl, null); resolve(null); };
    img.onload = () => {
      const size = 8;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { coverColorCache.set(dataUrl, null); resolve(null); return; }
      ctx.drawImage(img, 0, 0, size, size);
      let r = 0, g = 0, b = 0, count = 0;
      try {
        const data = ctx.getImageData(0, 0, size, size).data;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
      } catch {
        coverColorCache.set(dataUrl, null);
        resolve(null);
        return;
      }
      const color = count > 0 ? `${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}` : null;
      coverColorCache.set(dataUrl, color);
      resolve(color);
    };
    img.src = dataUrl;
  });
}

export function useCoverGlow(coverImage: string | null | undefined): React.CSSProperties {
  const [glow, setGlow] = useState<string | null>(null);

  useEffect(() => {
    if (!coverImage) { setGlow(null); return; }
    let cancelled = false;
    getAverageCoverColor(coverImage).then((color) => {
      if (!cancelled) setGlow(color);
    });
    return () => { cancelled = true; };
  }, [coverImage]);

  return glow ? ({ '--book-glow': `rgba(${glow}, 0.4)` } as React.CSSProperties) : {};
}

export function bookSortKey(book: Book): string {
  return book.finished_date ?? book.started_date ?? book.created_at;
}

export function sortBooks(list: Book[], sortBy: SortBy): Book[] {
  const arr = [...list];
  if (sortBy === 'title') arr.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortBy === 'author') arr.sort((a, b) => (a.author ?? '').localeCompare(b.author ?? ''));
  else arr.sort((a, b) => bookSortKey(b).localeCompare(bookSortKey(a)));
  return arr;
}
