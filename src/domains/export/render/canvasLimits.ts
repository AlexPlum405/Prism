import { t } from '../../i18n/runtime';

export const MAX_EXPORT_CANVAS_DIMENSION = 16_000;
export const MAX_EXPORT_CANVAS_AREA = 64_000_000;

export function assertExportCanvasWithinLimits(width: number, height: number, scale: number, label: string) {
  const scaledWidth = Math.ceil(width * scale);
  const scaledHeight = Math.ceil(height * scale);
  const area = scaledWidth * scaledHeight;
  if (
    scaledWidth > MAX_EXPORT_CANVAS_DIMENSION
    || scaledHeight > MAX_EXPORT_CANVAS_DIMENSION
    || area > MAX_EXPORT_CANVAS_AREA
  ) {
    throw new Error(
      t('export.error.canvasLimit', { label, width: scaledWidth, height: scaledHeight, scale }),
    );
  }
}

export function isExportCanvasWithinLimits(width: number, height: number, scale: number) {
  const scaledWidth = Math.ceil(width * scale);
  const scaledHeight = Math.ceil(height * scale);
  const area = scaledWidth * scaledHeight;
  return scaledWidth <= MAX_EXPORT_CANVAS_DIMENSION
    && scaledHeight <= MAX_EXPORT_CANVAS_DIMENSION
    && area <= MAX_EXPORT_CANVAS_AREA;
}

export function getSafeExportCanvasScale(width: number, height: number, requestedScale: number) {
  const normalizedScale = Math.max(1, Math.floor(requestedScale));
  for (let scale = normalizedScale; scale >= 1; scale -= 1) {
    if (isExportCanvasWithinLimits(width, height, scale)) return scale;
  }
  return null;
}
