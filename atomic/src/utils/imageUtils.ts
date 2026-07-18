// Shared canvas-based image helpers: pick a file → decode → downscale → re-encode JPEG.
// Used by Projects/Books cover uploads and the background wallpaper picker, each with
// their own max dimension + JPEG quality tuned for how large that image renders.

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

// Unsharp mask: blur a copy (native canvas filter, cheap), then add back amount * (original -
// blurred) per channel. Mutates `canvas` in place.
function applyUnsharpMask(canvas: HTMLCanvasElement, radius: number, amount: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  const original = ctx.getImageData(0, 0, width, height);

  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = width;
  blurCanvas.height = height;
  const blurCtx = blurCanvas.getContext('2d');
  if (!blurCtx) return;
  blurCtx.filter = `blur(${radius}px)`;
  blurCtx.drawImage(canvas, 0, 0);
  const blurred = blurCtx.getImageData(0, 0, width, height);

  const out = ctx.createImageData(width, height);
  const o = original.data, b = blurred.data, d = out.data;
  for (let i = 0; i < o.length; i += 4) {
    d[i] = clamp255(o[i] + amount * (o[i] - b[i]));
    d[i + 1] = clamp255(o[i + 1] + amount * (o[i + 1] - b[i + 1]));
    d[i + 2] = clamp255(o[i + 2] + amount * (o[i + 2] - b[i + 2]));
    d[i + 3] = o[i + 3];
  }
  ctx.putImageData(out, 0, 0);
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image load failed'));
      img.onload = () => resolve(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('image load failed'));
    img.onload = () => resolve(img);
    img.src = dataUrl;
  });
}

export function resizeImageToDataUrl(img: HTMLImageElement, maxDim: number, quality: number, sharpen = false): string {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas context');
  ctx.drawImage(img, 0, 0, w, h);
  if (sharpen) applyUnsharpMask(canvas, 0.7, 0.55);
  return canvas.toDataURL('image/jpeg', quality);
}

// Convenience wrapper for the common "pick a file, downscale it, get a JPEG data URL" case.
export function compressImageToDataUrl(file: File, maxDim: number, quality: number): Promise<string> {
  return loadImageFromFile(file).then((img) => resizeImageToDataUrl(img, maxDim, quality));
}

export function formatISODate(iso: string): string {
  const [y, m, d] = iso.split(/[- ]/);
  return `${d}/${m}/${y}`;
}
