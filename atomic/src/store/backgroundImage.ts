// Background wallpaper: pick → downscale via canvas → re-encode JPEG.
// Same technique as compressCoverImage in components/books/BooksView.tsx,
// just with a much larger max dimension since this fills the whole screen.

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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image load failed"));
      img.onload = () => {
        const scale = Math.min(1, MAX_BG_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no canvas context")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", BG_JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
