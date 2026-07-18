import { loadImageFromFile, loadImageFromDataUrl, resizeImageToDataUrl } from '../../utils/imageUtils';

const MAX_COVER_DIM = 1600;
const COVER_JPEG_QUALITY = 0.92;
// Project card grid has no container max-width (can stretch past 800px CSS on a wide
// monitor with few cards), so this stays well above typical thumbnail display size —
// smaller than MAX_COVER_DIM for real decode/payload savings, but not so small that a
// stretched grid row upscales it (see the 2026-07-10 note this project's memory keeps
// on MAX_COVER_DIM itself, which hit exactly that bug at 640px).
const MAX_COVER_THUMB_DIM = 960;
const COVER_THUMB_JPEG_QUALITY = 0.85;

export function compressCoverImage(file: File): Promise<string> {
  return loadImageFromFile(file).then((img) => resizeImageToDataUrl(img, MAX_COVER_DIM, COVER_JPEG_QUALITY));
}

// Project covers need both sizes: full-res for the detail modal, a lighter thumb for the card grid.
// If the source is already <= the thumb cap, resizing again would just re-encode the same
// pixels at a lower quality (net negative: same/worse detail, sometimes even larger — JPEG
// re-encoding a already-lossy image doesn't shrink monotonically) — reuse `full` as-is instead.
export function compressProjectCover(file: File): Promise<{ full: string; thumb: string }> {
  return loadImageFromFile(file).then((img) => {
    const full = resizeImageToDataUrl(img, MAX_COVER_DIM, COVER_JPEG_QUALITY);
    const thumb = Math.max(img.width, img.height) > MAX_COVER_THUMB_DIM
      ? resizeImageToDataUrl(img, MAX_COVER_THUMB_DIM, COVER_THUMB_JPEG_QUALITY, true)
      : full;
    return { full, thumb };
  });
}

export function resizeCoverThumbFromDataUrl(dataUrl: string): Promise<string> {
  return loadImageFromDataUrl(dataUrl).then((img) =>
    Math.max(img.width, img.height) > MAX_COVER_THUMB_DIM
      ? resizeImageToDataUrl(img, MAX_COVER_THUMB_DIM, COVER_THUMB_JPEG_QUALITY, true)
      : dataUrl
  );
}

export function clampPercent(v: number): number {
  return Math.min(100, Math.max(0, v));
}

export function parseCoverPosition(pos: string | null): { x: number; y: number } {
  const m = pos?.match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  if (!m) return { x: 50, y: 50 };
  return { x: clampPercent(parseFloat(m[1])), y: clampPercent(parseFloat(m[2])) };
}
