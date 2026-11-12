/**
 * 手写 PNG 拼装：把 html2canvas 的切片光栅按行重排后直接写成 PNG 字节流。
 *
 * 之所以不用 `canvas.toDataURL()`，是因为 WebKit 对单张 canvas 的高度有限制，
 * 长文档必须切成多张 canvas 再缝合。这里自己写 IHDR/IDAT/IEND，逐行 push 扫描线，
 * 内存里不出现完整像素缓冲。
 */
import { Zlib } from 'fflate';
import { t } from '../../i18n/runtime';
import {
  assertExportCanvasWithinLimits,
  MAX_EXPORT_CANVAS_AREA,
  MAX_EXPORT_CANVAS_DIMENSION,
} from '../render/canvasLimits';
import { nextExportFrame as nextFrame } from '../rendering';

export type Html2CanvasRenderer = typeof import('html2canvas')['default'];

export interface PngRenderedImage {
  data: Uint8Array;
  width: number;
  height: number;
}

interface PngCaptureColumn {
  x: number;
  width: number;
  pixelX: number;
  pixelWidth: number;
}

interface PngCaptureRow {
  y: number;
  height: number;
  pixelY: number;
  pixelHeight: number;
}

interface PngCapturedTile {
  column: PngCaptureColumn;
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function writePngUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function getPngCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = PNG_CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type: string, data: Uint8Array<ArrayBufferLike> = new Uint8Array()) {
  if (type.length !== 4) throw new Error(`Invalid PNG chunk type: ${type}`);
  const chunk = new Uint8Array(12 + data.length);
  writePngUint32(chunk, 0, data.length);
  for (let index = 0; index < 4; index += 1) {
    chunk[4 + index] = type.charCodeAt(index);
  }
  chunk.set(data, 8);
  writePngUint32(chunk, 8 + data.length, getPngCrc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

function concatPngChunks(chunks: Uint8Array<ArrayBufferLike>[]) {
  const byteLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(byteLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

class RgbaPngStreamEncoder {
  private readonly chunks: Uint8Array<ArrayBufferLike>[];

  private readonly idatChunks: Uint8Array<ArrayBufferLike>[] = [];

  private readonly zlib: Zlib;

  constructor(width: number, height: number) {
    const ihdr = new Uint8Array(13);
    writePngUint32(ihdr, 0, width);
    writePngUint32(ihdr, 4, height);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    this.chunks = [PNG_SIGNATURE, createPngChunk('IHDR', ihdr)];
    this.zlib = new Zlib({ level: 6 }, (data) => {
      if (data.length > 0) this.idatChunks.push(data);
    });
  }

  pushScanline(scanline: Uint8Array) {
    this.zlib.push(scanline);
  }

  finish() {
    this.zlib.push(new Uint8Array(), true);
    this.idatChunks.forEach((chunk) => {
      this.chunks.push(createPngChunk('IDAT', chunk));
    });
    this.chunks.push(createPngChunk('IEND'));
    return concatPngChunks(this.chunks);
  }
}

function getScaledPngPixelLength(cssLength: number, scale: number) {
  return Math.max(1, Math.ceil(cssLength * scale));
}

function createPngCaptureColumns(width: number, scale: number): PngCaptureColumn[] {
  const maxCssWidth = Math.max(1, Math.floor(MAX_EXPORT_CANVAS_DIMENSION / scale));
  const finalPixelWidth = getScaledPngPixelLength(width, scale);
  const columns: PngCaptureColumn[] = [];
  for (let x = 0; x < width;) {
    const columnWidth = Math.min(maxCssWidth, width - x);
    const nextX = x + columnWidth;
    const pixelX = Math.round(x * scale);
    const pixelEnd = nextX >= width ? finalPixelWidth : Math.round(nextX * scale);
    columns.push({
      x,
      width: columnWidth,
      pixelX,
      pixelWidth: Math.max(1, pixelEnd - pixelX),
    });
    x = nextX;
  }
  return columns;
}

function getMaxPngRowCssHeight(documentWidth: number, documentHeight: number, scale: number) {
  const scaledWidth = getScaledPngPixelLength(documentWidth, scale);
  const maxScaledHeightByArea = Math.max(1, Math.floor(MAX_EXPORT_CANVAS_AREA / scaledWidth));
  const maxScaledHeight = Math.max(1, Math.min(MAX_EXPORT_CANVAS_DIMENSION, maxScaledHeightByArea));
  return Math.max(1, Math.min(documentHeight, Math.floor(maxScaledHeight / scale)));
}

function createPngCaptureRows(width: number, height: number, scale: number): PngCaptureRow[] {
  const maxCssHeight = getMaxPngRowCssHeight(width, height, scale);
  const finalPixelHeight = getScaledPngPixelLength(height, scale);
  const rows: PngCaptureRow[] = [];
  for (let y = 0; y < height;) {
    const rowHeight = Math.min(maxCssHeight, height - y);
    const nextY = y + rowHeight;
    const pixelY = Math.round(y * scale);
    const pixelEnd = nextY >= height ? finalPixelHeight : Math.round(nextY * scale);
    rows.push({
      y,
      height: rowHeight,
      pixelY,
      pixelHeight: Math.max(1, pixelEnd - pixelY),
    });
    y = nextY;
  }
  return rows;
}

async function capturePngTile(
  html2canvas: Html2CanvasRenderer,
  target: HTMLElement,
  options: {
    backgroundColor: string;
    documentWidth: number;
    scale: number;
    column: PngCaptureColumn;
    row: PngCaptureRow;
  },
): Promise<PngCapturedTile> {
  assertExportCanvasWithinLimits(
    options.column.width,
    options.row.height,
    options.scale,
    t('export.label.pngExport'),
  );

  const canvas = await html2canvas(target, {
    backgroundColor: options.backgroundColor,
    scale: options.scale,
    useCORS: true,
    logging: false,
    width: options.column.width,
    height: options.row.height,
    x: options.column.x,
    y: options.row.y,
    windowWidth: options.documentWidth,
    windowHeight: Math.max(1200, Math.ceil(options.row.height)),
    scrollX: 0,
    scrollY: 0,
  });
  canvas.width ||= options.column.pixelWidth;
  canvas.height ||= options.row.pixelHeight;

  const context = canvas.getContext('2d');
  if (!context) throw new Error(t('export.error.sliceFailed', { label: t('export.label.pngExport') }));
  const width = Math.min(options.column.pixelWidth, canvas.width);
  const height = Math.min(options.row.pixelHeight, canvas.height);
  const imageData = context.getImageData(0, 0, width, height);
  return {
    column: options.column,
    data: imageData.data,
    width,
    height,
  };
}

export async function createSlicedRenderedPng(
  html2canvas: Html2CanvasRenderer,
  target: HTMLElement,
  options: {
    backgroundColor: string;
    width: number;
    height: number;
    scale: number;
  },
): Promise<PngRenderedImage> {
  const pixelWidth = getScaledPngPixelLength(options.width, options.scale);
  const pixelHeight = getScaledPngPixelLength(options.height, options.scale);
  const columns = createPngCaptureColumns(options.width, options.scale);
  const rows = createPngCaptureRows(options.width, options.height, options.scale);
  const encoder = new RgbaPngStreamEncoder(pixelWidth, pixelHeight);
  const scanline = new Uint8Array(1 + pixelWidth * 4);

  for (const row of rows) {
    await nextFrame();
    const tiles: PngCapturedTile[] = [];
    for (const column of columns) {
      tiles.push(await capturePngTile(html2canvas, target, {
        backgroundColor: options.backgroundColor,
        documentWidth: options.width,
        scale: options.scale,
        column,
        row,
      }));
    }

    for (let pixelRow = 0; pixelRow < row.pixelHeight; pixelRow += 1) {
      scanline.fill(0);
      for (const tile of tiles) {
        if (pixelRow >= tile.height) continue;
        const copyWidth = Math.min(tile.column.pixelWidth, tile.width);
        const sourceOffset = pixelRow * tile.width * 4;
        scanline.set(
          tile.data.subarray(sourceOffset, sourceOffset + copyWidth * 4),
          1 + tile.column.pixelX * 4,
        );
      }
      encoder.pushScanline(scanline);
      if (pixelRow > 0 && pixelRow % 512 === 0) await nextFrame();
    }
  }

  return {
    data: encoder.finish(),
    width: pixelWidth,
    height: pixelHeight,
  };
}
