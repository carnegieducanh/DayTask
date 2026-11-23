// Xuất logo navbar 32px "đã hinting" → public/atom-icon-32.png
//
// Vì sao: ở màn 100%, logo navbar chỉ có 32×32 điểm ảnh. Thu nhỏ thẳng ảnh 512
// (trình duyệt hay Lanczos đều như nhau) làm vát 3D quanh chữ thành viền xám và
// khe giữa "A" và "\" (~1,4px) bị lấp → chữ trông nhòe. Script này tách chữ khỏi
// viên gạch ở bản 1024, thu nhỏ riêng, làm cứng mép chữ (coverage → smoothstep),
// xói mòn nhẹ để mở khe A|\, rồi ghép lại. Hình học giữ nguyên.
// Màn ≥2x vẫn dùng atom-icon.png (512) qua srcSet — ở 64px vát 3D còn đẹp.
//
// Chạy từ thư mục atomic/:  node src-tauri/icons/_source/make-navbar-logo-32.cjs
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, 'peach-tile-tilt-master.png'); // 1024, fill 1.0
const OUT = path.join(__dirname, '..', '..', '..', 'public', 'atom-icon-32.png');
const SIZE = 32;
const ERODE = 6;            // px ở bản 1024 (~0,19px ở 32px mỗi bên) — mở khe A|\
const EDGE = [0.2, 0.7];    // smoothstep cho coverage chữ: thấp hơn = chữ đậm hơn
const INK = [22, 20, 19];   // màu chữ phẳng (vát 3D không thấy được ở 32px)

const smooth = (lo, hi, v) => { const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo))); return t * t * (3 - 2 * t); };

function boxBlur(arr, W, H, r) {
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = y * W; let s = 0;
    for (let x = -r; x <= r; x++) s += arr[row + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[row + x] = s / (2 * r + 1);
      s += arr[row + Math.min(W - 1, x + r + 1)] - arr[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = s / (2 * r + 1);
      s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  return out;
}

function minFilter(arr, W, H, r) {
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let m = 1;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < W) m = Math.min(m, arr[y * W + xx]); }
    tmp[y * W + x] = m;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let m = 1;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < H) m = Math.min(m, tmp[yy * W + x]); }
    out[y * W + x] = m;
  }
  return out;
}

(async () => {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;

  // 1) Mask chữ: điểm tối + đặc, chỉ trong vùng giữa (tránh cạnh bóng của viên gạch)
  let L = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (data[i * 4 + 3] < 200 || x < W * 0.2 || x > W * 0.95 || y < H * 0.2 || y > H * 0.85) continue;
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    L[i] = 1 - smooth(55, 95, lum);
  }

  // 2) Viên gạch không chữ: lấp vùng chữ bằng normalized convolution từ màu đào xung quanh
  const near = boxBlur(L, W, H, 10);
  const keep = new Float32Array(N);
  for (let i = 0; i < N; i++) keep[i] = near[i] > 0.02 ? 0 : data[i * 4 + 3] / 255;
  const blur3 = (a) => { let b = a; for (let k = 0; k < 3; k++) b = boxBlur(b, W, H, 45); return b; };
  const kb = blur3(keep);
  const fill = [0, 1, 2].map((c) => {
    const ch = new Float32Array(N);
    for (let i = 0; i < N; i++) ch[i] = data[i * 4 + c] * keep[i];
    return blur3(ch);
  });
  const base = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const useFill = near[i] > 0.02 && kb[i] > 1e-3;
    for (let c = 0; c < 3; c++) base[i * 4 + c] = useFill ? Math.round(fill[c][i] / kb[i]) : data[i * 4 + c];
    base[i * 4 + 3] = data[i * 4 + 3];
  }

  // 3) Coverage chữ ở 32px (trung bình ô), làm cứng mép, ghép lên viên gạch thu nhỏ
  L = minFilter(L, W, H, ERODE);
  const cov = new Float32Array(SIZE * SIZE), s = W / SIZE;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const y0 = Math.floor(y * s), y1 = Math.floor((y + 1) * s), x0 = Math.floor(x * s), x1 = Math.floor((x + 1) * s);
    let acc = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) acc += L[yy * W + xx];
    cov[y * SIZE + x] = acc / ((y1 - y0) * (x1 - x0));
  }
  const small = await sharp(base, { raw: { width: W, height: H, channels: 4 } })
    .resize(SIZE, SIZE, { kernel: 'lanczos3' }).raw().toBuffer();
  const out = Buffer.alloc(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const c = smooth(EDGE[0], EDGE[1], cov[i]);
    for (let k = 0; k < 3; k++) out[i * 4 + k] = Math.round(small[i * 4 + k] * (1 - c) + INK[k] * c);
    out[i * 4 + 3] = small[i * 4 + 3];
  }
  await sharp(out, { raw: { width: SIZE, height: SIZE, channels: 4 } }).png({ compressionLevel: 9 }).toFile(OUT);
  console.log('→', path.relative(process.cwd(), OUT));
})().catch((e) => { console.error(e); process.exit(1); });
