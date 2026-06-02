import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync, unlinkSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'src-tauri', 'icons');

const SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(50,50)">
    <ellipse rx="42" ry="15" fill="none" stroke="#DA7756" stroke-width="4.5" stroke-linecap="round"/>
    <ellipse rx="42" ry="15" fill="none" stroke="#DA7756" stroke-width="4.5" stroke-linecap="round" transform="rotate(60)"/>
    <ellipse rx="42" ry="15" fill="none" stroke="#DA7756" stroke-width="4.5" stroke-linecap="round" transform="rotate(-60)"/>
    <circle r="8" fill="#DA7756"/>
    <circle cx="-42" cy="0" r="5.5" fill="#DA7756"/>
    <circle cx="42" cy="0" r="5.5" fill="#DA7756"/>
  </g>
</svg>`;

const svgBuffer = Buffer.from(SVG);

// Xóa toàn bộ file cũ trong icons/
const oldFiles = readdirSync(iconsDir);
for (const f of oldFiles) {
  unlinkSync(join(iconsDir, f));
  console.log(`Deleted: ${f}`);
}

// Các kích thước PNG cần tạo
const sizes = [
  { size: 16,  name: '16x16.png' },
  { size: 32,  name: '32x32.png' },
  { size: 64,  name: '64x64.png' },
  { size: 128, name: '128x128.png' },
  { size: 256, name: '128x128@2x.png' }, // macOS retina dùng 256px
  { size: 256, name: 'icon.png' },
  { size: 512, name: '512x512.png' },
];

// Tạo PNG cho mỗi kích thước
for (const { size, name } of sizes) {
  const outPath = join(iconsDir, name);
  await sharp(svgBuffer, { density: Math.ceil(size * 3.5) })
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`Created: ${name} (${size}x${size})`);
}

// Tạo icon.ico từ các size: 16, 32, 64, 128, 256
const icoSizes = [16, 32, 64, 128, 256];
const pngBuffers = await Promise.all(
  icoSizes.map(size =>
    sharp(svgBuffer, { density: Math.ceil(size * 3.5) })
      .resize(size, size)
      .png()
      .toBuffer()
  )
);

const icoBuffer = await pngToIco(pngBuffers);
writeFileSync(join(iconsDir, 'icon.ico'), icoBuffer);
console.log('Created: icon.ico (16, 32, 64, 128, 256)');

console.log('\nDone! All icons generated in src-tauri/icons/');
