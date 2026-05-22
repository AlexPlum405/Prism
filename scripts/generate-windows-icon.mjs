import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sourceIconPath = path.join(repoRoot, 'docs', 'assets', 'prism-icon-flood-preview.png');
const appIconPath = path.join(repoRoot, 'src-tauri', 'app-icon.png');
const docFusionIconPath = path.join(repoRoot, 'docs', 'assets', 'prism-icon-fusion-app-icon.png');
const pngOutputDir = path.join(repoRoot, 'src-tauri', 'icons');
const outputIconPath = path.join(repoRoot, 'src-tauri', 'icons', 'icon.ico');
const previewDir = path.join(repoRoot, '.tmp-icons', 'windows-icon-preview');

const iconSizes = [16, 24, 32, 48, 64, 128, 256];
const pngOutputs = [
  ['32x32.png', 32],
  ['64x64.png', 64],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
  ['icon.png', 512],
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

function scaleForSize(size) {
  if (size <= 48) {
    return 1;
  }

  if (size <= 64) {
    return 1.04;
  }

  return 1.1;
}

function roundedMaskSvg(size, radius) {
  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>
  `);
}

function backgroundSvg(size, radius) {
  const strokeWidth = Math.max(1, Math.round(size * 0.012));

  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#cbd2d5"/>
          <stop offset="0.48" stop-color="#e3e7e8"/>
          <stop offset="1" stop-color="#c7d0d4"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="url(#bg)"/>
      <rect x="${strokeWidth / 2}" y="${strokeWidth / 2}" width="${size - strokeWidth}" height="${size - strokeWidth}" rx="${Math.max(0, radius - strokeWidth / 2)}" ry="${Math.max(0, radius - strokeWidth / 2)}" fill="none" stroke="rgba(255,255,255,0.42)" stroke-width="${strokeWidth}"/>
    </svg>
  `);
}

async function renderFusionIcon(sourceBuffer, size) {
  const scale = scaleForSize(size);
  const radius = Math.round(size * 0.1875);
  const overlaySize = Math.ceil(size * scale);
  const cropLeft = Math.floor((overlaySize - size) / 2);
  const cropTop = Math.floor((overlaySize - size) / 2);

  const foreground = await sharp(sourceBuffer)
    .resize(overlaySize, overlaySize, {
      fit: 'cover',
      kernel: sharp.kernel.lanczos3,
    })
    .linear(1.14, -18)
    .modulate({ brightness: 1.01, saturation: 1.08 })
    .extract({ left: cropLeft, top: cropTop, width: size, height: size })
    .png()
    .toBuffer();

  return sharp(backgroundSvg(size, radius))
    .composite([
      { input: foreground, left: 0, top: 0 },
      { input: roundedMaskSvg(size, radius), left: 0, top: 0, blend: 'dest-in' },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

await fs.mkdir(path.dirname(outputIconPath), { recursive: true });
await fs.mkdir(path.dirname(appIconPath), { recursive: true });
await fs.mkdir(path.dirname(docFusionIconPath), { recursive: true });
await fs.mkdir(pngOutputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const sourceBuffer = await fs.readFile(sourceIconPath);
const pngLayers = [];

for (const size of iconSizes) {
  const buffer = await renderFusionIcon(sourceBuffer, size);

  pngLayers.push({ size, buffer });
  await fs.writeFile(path.join(previewDir, `${size}x${size}.png`), buffer);
}

for (const [filename, size] of pngOutputs) {
  const buffer = await renderFusionIcon(sourceBuffer, size);
  await fs.writeFile(path.join(pngOutputDir, filename), buffer);
}

const appIconBuffer = await renderFusionIcon(sourceBuffer, 1024);
await fs.writeFile(appIconPath, appIconBuffer);
await fs.writeFile(docFusionIconPath, appIconBuffer);
await fs.writeFile(outputIconPath, buildPngCompressedIco(pngLayers));

console.log(`Generated ${outputIconPath}`);
console.log(`Generated ${appIconPath}`);
console.log(`Preview layers: ${previewDir}`);
