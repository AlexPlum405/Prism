import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sourceIconPath = path.join(repoRoot, 'docs', 'assets', 'prism-icon-red-panda-app-icon.png');
const appIconPath = path.join(repoRoot, 'src-tauri', 'app-icon.png');
const iconsDir = path.join(repoRoot, 'src-tauri', 'icons');
const outputIcnsPath = path.join(iconsDir, 'icon.icns');
const outputIcoPath = path.join(iconsDir, 'icon.ico');

const genericPngOutputs = [
  ['32x32.png', 32, 'windows-small'],
  ['64x64.png', 64, 'windows-small'],
  ['128x128.png', 128, 'standard'],
  ['128x128@2x.png', 256, 'standard'],
  ['icon.png', 512, 'standard'],
];

const windowsLogoOutputs = [
  ['Square30x30Logo.png', 30, 'windows-small'],
  ['Square44x44Logo.png', 44, 'windows-small'],
  ['StoreLogo.png', 50, 'windows-small'],
  ['Square71x71Logo.png', 71, 'windows-small'],
  ['Square89x89Logo.png', 89, 'windows-small'],
  ['Square107x107Logo.png', 107, 'windows-small'],
  ['Square142x142Logo.png', 142, 'standard'],
  ['Square150x150Logo.png', 150, 'standard'],
  ['Square284x284Logo.png', 284, 'standard'],
  ['Square310x310Logo.png', 310, 'standard'],
];

const icoLayerSizes = [16, 24, 32, 48, 64, 128, 256];

const icnsIconsetEntries = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];

function buildPngCompressedIco(pngLayers) {
  const headerSize = 6;
  const entrySize = 16;
  const directorySize = headerSize + pngLayers.length * entrySize;
  const totalSize = directorySize + pngLayers.reduce((sum, layer) => sum + layer.buffer.length, 0);
  const ico = Buffer.alloc(totalSize);

  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(pngLayers.length, 4);

  let imageOffset = directorySize;

  pngLayers.forEach((layer, index) => {
    const entryOffset = headerSize + index * entrySize;
    const encodedSize = layer.size >= 256 ? 0 : layer.size;

    ico.writeUInt8(encodedSize, entryOffset);
    ico.writeUInt8(encodedSize, entryOffset + 1);
    ico.writeUInt8(0, entryOffset + 2);
    ico.writeUInt8(0, entryOffset + 3);
    ico.writeUInt16LE(1, entryOffset + 4);
    ico.writeUInt16LE(32, entryOffset + 6);
    ico.writeUInt32LE(layer.buffer.length, entryOffset + 8);
    ico.writeUInt32LE(imageOffset, entryOffset + 12);

    layer.buffer.copy(ico, imageOffset);
    imageOffset += layer.buffer.length;
  });

  return ico;
}

function windowsCropRatio(size) {
  if (size <= 24) return 0.94;
  if (size <= 32) return 0.95;
  if (size <= 48) return 0.96;
  if (size <= 64) return 0.98;
  if (size <= 107) return 0.99;
  return 1;
}

async function readSourceMetadata() {
  const metadata = await sharp(sourceIconPath).metadata();

  if (!metadata.width || !metadata.height || metadata.width !== metadata.height) {
    throw new Error(`Brand icon source must be a square image: ${sourceIconPath}`);
  }

  return metadata;
}

// Trim whitespace/near-white borders from the source image by detecting
// the bounding box of non-white content, then cropping to a square that
// fully contains that content.
async function getTrimmedSource() {
  const meta = await sharp(sourceIconPath).metadata();
  const w = meta.width;
  const h = meta.height;
  const c = meta.channels;
  const pixels = await sharp(sourceIconPath).raw().toBuffer();

  // Find the bounding box of non-white content.
  // A pixel is "white" if all RGB channels >= 250.
  // Using 250 (instead of 240) to also exclude near-white borders (RGB 251-254)
  // that often appear around icons exported from design tools.
  const whiteThreshold = 250;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * c;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Add a small padding so the icon isn't flush against the edge.
  const padding = Math.round(Math.max(w, h) * 0.02);
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(w - 1, maxX + padding);
  maxY = Math.min(h - 1, maxY + padding);

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;

  // Crop to a centered square that fully contains the content.
  const squareSize = Math.max(contentW, contentH);
  const squareLeft = Math.max(0, Math.floor(minX + (contentW - squareSize) / 2));
  const squareTop = Math.max(0, Math.floor(minY + (contentH - squareSize) / 2));

  console.log(
    `Content bounds: ${contentW}x${contentH} at (${minX},${minY}) -> ` +
    `square crop ${squareSize}x${squareSize} at (${squareLeft},${squareTop})`,
  );

  const trimmed = await sharp(sourceIconPath)
    .extract({
      left: squareLeft,
      top: squareTop,
      width: squareSize,
      height: squareSize,
    })
    .toBuffer();

  // Make near-white pixels transparent so macOS squircle cropping
  // doesn't show a white border around the icon.
  const trimmedMeta = await sharp(trimmed).metadata();
  const tw = trimmedMeta.width;
  const th = trimmedMeta.height;
  const tc = trimmedMeta.channels;
  const trimmedPixels = await sharp(trimmed).raw().toBuffer();

  const rgbaBuffer = Buffer.alloc(tw * th * 4);
  const transparencyThreshold = 248;

  for (let i = 0; i < tw * th; i++) {
    const srcIdx = i * tc;
    const dstIdx = i * 4;
    const r = trimmedPixels[srcIdx];
    const g = trimmedPixels[srcIdx + 1];
    const b = trimmedPixels[srcIdx + 2];

    rgbaBuffer[dstIdx] = r;
    rgbaBuffer[dstIdx + 1] = g;
    rgbaBuffer[dstIdx + 2] = b;
    rgbaBuffer[dstIdx + 3] = (r >= transparencyThreshold && g >= transparencyThreshold && b >= transparencyThreshold) ? 0 : 255;
  }

  const finalBuffer = await sharp(rgbaBuffer, {
    raw: { width: tw, height: th, channels: 4 },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  const finalMeta = await sharp(finalBuffer).metadata();
  console.log(`Trimmed source: ${finalMeta.width}x${finalMeta.height} (near-white pixels made transparent)`);

  return finalBuffer;
}

function centeredCrop(metadata, ratio) {
  const sourceSize = metadata.width;
  const cropSize = Math.round(sourceSize * ratio);
  const left = Math.floor((sourceSize - cropSize) / 2);
  const top = Math.floor((sourceSize - cropSize) / 2);

  return { left, top, width: cropSize, height: cropSize };
}

async function renderStandardIcon(size, trimmedSource) {
  return sharp(trimmedSource)
    .ensureAlpha()
    .resize(size, size, {
      fit: 'cover',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function renderWindowsSmallIcon(size, metadata, trimmedSource) {
  const crop = centeredCrop(metadata, windowsCropRatio(size));

  return sharp(trimmedSource)
    .extract(crop)
    .ensureAlpha()
    .resize(size, size, {
      fit: 'cover',
      kernel: sharp.kernel.lanczos3,
    })
    .linear(1.08, -5)
    .modulate({ brightness: 1.02, saturation: 1.08 })
    .sharpen({ sigma: 0.55, m1: 1.2, m2: 1.1 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function renderIcon(size, mode, metadata, trimmedSource) {
  if (mode === 'windows-small') {
    return renderWindowsSmallIcon(size, metadata, trimmedSource);
  }

  return renderStandardIcon(size, trimmedSource);
}

async function generateIcns(metadata, trimmedSource) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prism-iconset-'));
  const iconsetDir = path.join(tempRoot, 'icon.iconset');

  await fs.mkdir(iconsetDir, { recursive: true });

  for (const [filename, size] of icnsIconsetEntries) {
    const buffer = await renderIcon(size, 'standard', metadata, trimmedSource);
    await fs.writeFile(path.join(iconsetDir, filename), buffer);
  }

  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', outputIcnsPath], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  await fs.rm(tempRoot, { recursive: true, force: true });
}

async function generateIco(metadata, trimmedSource) {
  const pngLayers = [];

  for (const size of icoLayerSizes) {
    const mode = size <= 64 ? 'windows-small' : 'standard';
    const buffer = await renderIcon(size, mode, metadata, trimmedSource);
    pngLayers.push({ size, buffer });
  }

  await fs.writeFile(outputIcoPath, buildPngCompressedIco(pngLayers));
}

async function writePngOutputs(outputs, metadata, trimmedSource) {
  for (const [filename, size, mode] of outputs) {
    const buffer = await renderIcon(size, mode, metadata, trimmedSource);
    await fs.writeFile(path.join(iconsDir, filename), buffer);
  }
}

await fs.mkdir(iconsDir, { recursive: true });

const metadata = await readSourceMetadata();
const trimmedSource = await getTrimmedSource();
const trimmedMetadata = await sharp(trimmedSource).metadata();
// Use trimmed metadata for crop calculations so Windows small icons crop correctly
const effectiveMetadata = trimmedMetadata;
const appIconBuffer = await renderIcon(1024, 'standard', effectiveMetadata, trimmedSource);

await fs.writeFile(appIconPath, appIconBuffer);
await writePngOutputs(genericPngOutputs, effectiveMetadata, trimmedSource);
await writePngOutputs(windowsLogoOutputs, effectiveMetadata, trimmedSource);
await generateIcns(effectiveMetadata, trimmedSource);
await generateIco(effectiveMetadata, trimmedSource);

console.log(`Generated ${appIconPath}`);
console.log(`Generated ${outputIcnsPath}`);
console.log(`Generated ${outputIcoPath}`);
console.log('Windows small icon layers use the same brand source with size-specific clarity tuning.');
