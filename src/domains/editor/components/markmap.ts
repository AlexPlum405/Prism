import type { ContentTheme } from '../../settings/types';

const MIAOYAN_MARKMAP_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#FFA07A',
  '#20B2AA',
  '#87CEEB',
  '#DEB887',
  '#FF69B4',
  '#32CD32',
];

const MARKMAP_PALETTES: Record<string, string[]> = {
  miaoyan: MIAOYAN_MARKMAP_COLORS,
  inkstone: ['#9A3412', '#214E9A', '#2F6F4E', '#8A5A16', '#7047A8', '#6F5E46'],
  slate: ['#246A73', '#2356B8', '#B45309', '#7A4E0B', '#4C5F68', '#667680'],
  mono: ['#6D28D9', '#047857', '#B91C1C', '#0F766E', '#9A3412', '#525A52'],
  nocturne: ['#D6A84F', '#6CB6D9', '#C45A84', '#8FBF73', '#C8B28D', '#A89D8A'],
  carbon: ['#7DD3FC', '#A78BFA', '#A3E635', '#F472B6', '#EDEDED', '#777777'],
};

export function getMarkmapPalette(contentTheme: ContentTheme) {
  return MARKMAP_PALETTES[contentTheme] ?? MIAOYAN_MARKMAP_COLORS;
}

export function getMarkmapOptions(contentTheme: ContentTheme) {
  const palette = getMarkmapPalette(contentTheme);
  const compact = contentTheme === 'miaoyan';

  return {
    autoFit: true,
    color: (node: { state?: { depth?: number } }) => {
      const depth = Math.max(0, node.state?.depth ?? 0);
      return palette[depth % palette.length] ?? palette[0];
    },
    duration: contentTheme === 'miaoyan' ? 300 : 0,
    embedGlobalCSS: true,
    fitRatio: compact ? 0.92 : 0.95,
    initialExpandLevel: 6,
    lineWidth: (node: { state?: { depth?: number } }) => (
      compact
        ? Math.max(4 - 2 * (node.state?.depth ?? 0), 1.5)
        : ((node.state?.depth ?? 0) <= 0 ? 0 : 1.5)
    ),
    maxInitialScale: 1,
    maxWidth: compact ? 220 : 280,
    nodeMinHeight: compact ? 20 : 24,
    paddingX: compact ? 16 : 8,
    paddingY: compact ? 16 : 8,
    pan: !compact,
    scrollForPan: !compact,
    spacingHorizontal: compact ? 20 : 80,
    spacingVertical: compact ? 20 : 8,
    toggleRecursively: false,
    zoom: true,
  };
}
