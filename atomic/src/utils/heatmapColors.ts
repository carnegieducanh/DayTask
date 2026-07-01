import type { AccentColor, Theme } from '../types';

function blendHex(hex: string, target: number, weight: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r * weight + target * (1 - weight));
  const ng = Math.round(g * weight + target * (1 - weight));
  const nb = Math.round(b * weight + target * (1 - weight));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function customPalette(hex: string, zeroColor: string): string[] {
  return [
    zeroColor,
    blendHex(hex, 255, 0.25),
    blendHex(hex, 255, 0.58),
    hex,
    blendHex(hex, 0, 0.72),
  ];
}

export function getHeatmapColors(
  accentColor: AccentColor,
  theme: Theme,
  zeroColor = 'var(--bg-secondary)',
  customHex?: string
): string[] {
  switch (accentColor) {
    case 'orange':
      return [zeroColor, '#F5C4AE', '#E89A7A', '#DA7756', '#B85A38'];
    case 'green':
      return [zeroColor, '#B7EBD8', '#52C49A', '#1D9E75', '#0D6B4E'];
    case 'purple':
      return [zeroColor, '#D8D6F7', '#A9A4EA', '#7F77DD', '#4F48AF'];
    case 'red':
      return [zeroColor, '#FACACA', '#F07878', '#E24B4A', '#AA2020'];
    case 'yellow':
      return [zeroColor, '#FCE6B3', '#F4C464', '#EF9F27', '#B87218'];
    case 'custom':
      return customPalette(customHex && /^#[0-9a-fA-F]{6}$/.test(customHex) ? customHex : '#185FA5', zeroColor);
    default:
      return [zeroColor, '#B5D4F4', '#378ADD', theme === 'dark' ? '#7ab0e0' : '#125680', '#0a3d5e'];
  }
}
