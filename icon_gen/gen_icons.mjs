import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { promises as fs } from 'fs';
import path from 'path';

const SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(50,50)">
    <ellipse rx="38" ry="14" fill="none" stroke="#DA7756" stroke-width="3.2"/>
    <ellipse rx="38" ry="14" fill="none" stroke="#DA7756" stroke-width="3.2" transform="rotate(60)"/>
    <ellipse rx="38" ry="14" fill="none" stroke="#DA7756" stroke-width="3.2" transform="rotate(120)"/>
    <circle r="6.5" fill="#DA7756"/>
    <circle cx="38" cy="0" r="5" fill="#DA7756"/>
    <circle cx="-19" cy="32.9" r="5" fill="#DA7756" transform="rotate(60) translate(38,0) rotate(-60)"/>
    <circle cx="-19" cy="-32.9" r="5" fill="#DA7756" transform="rotate(120) translate(38,0) rotate(-120)"/>
  </g>
</svg>`;

const OUT_DIR = path.resolve('../atomic/src-tauri/icons');
const SIZES = [16, 32, 64, 128, 256, 512];

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const pngPaths = [];

  for (const size of SIZES) {
    const outPath = path.join(OUT_DIR, `icon_${size}x${size}.png`);
    await sharp(Buffer.from(SVG))
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`✓ ${outPath}`);
    pngPaths.push(outPath);
  }

  const bufs = await Promise.all(pngPaths.map(p => fs.readFile(p)));
  const ico = await pngToIco(bufs);
  const icoPath = path.join(OUT_DIR, 'icon.ico');
  await fs.writeFile(icoPath, ico);
  console.log(`✓ ${icoPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
