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

const MARKMAP_LIGHT_COLORS = MIAOYAN_MARKMAP_COLORS;
const MARKMAP_DARK_COLORS = ['#54C59F', '#E7E9EA', '#F7CC8F', '#8FFCCD', '#ED716C', '#C084FC', '#60A5FA'];

function isDarkMarkmapTheme(contentTheme: ContentTheme) {
  return contentTheme === 'nocturne' || contentTheme === 'slate';
}

export function getMarkmapPalette(contentTheme: ContentTheme) {
  return isDarkMarkmapTheme(contentTheme) ? MARKMAP_DARK_COLORS : MARKMAP_LIGHT_COLORS;
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
