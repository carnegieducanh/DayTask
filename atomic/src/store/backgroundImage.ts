// Background wallpaper: pick → downscale via canvas → re-encode JPEG.
// Same technique as Books/Projects cover uploads (see ../utils/imageUtils),
// just with a much larger max dimension since this fills the whole screen.

import { compressImageToDataUrl } from "../utils/imageUtils";

export const BG_DIR = "background";
// Fixed filename used before per-upload naming existed — kept only for one-time migration.
export const LEGACY_BG_FILENAME = "background_image.jpg";
const MAX_BG_DIM = 2560;
const BG_JPEG_QUALITY = 0.85;

// Keep the original file's name (sans unsafe chars) so past backgrounds stay
// recognizable on disk. Bytes are always re-encoded as JPEG regardless of the
// original extension — that's cosmetic only, every read path treats the file as JPEG.
export function safeBackgroundFilename(originalName: string): string {
  const trimmed = originalName.trim().replace(/[\\/:*?"<>|]/g, "_");
  return trimmed || "background";
}

export function compressBackgroundImage(file: File): Promise<string> {
  return compressImageToDataUrl(file, MAX_BG_DIM, BG_JPEG_QUALITY);
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
