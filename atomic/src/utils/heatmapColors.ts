import type { AccentColor, Theme } from '../types';

export function getHeatmapColors(
  accentColor: AccentColor,
  theme: Theme,
  zeroColor = 'var(--bg-secondary)'
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
    default: // blue
      return [zeroColor, '#B5D4F4', '#378ADD', theme === 'dark' ? '#7ab0e0' : '#125680', '#0a3d5e'];
  }
}
