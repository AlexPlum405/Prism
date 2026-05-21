import { t } from '../../i18n';

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
