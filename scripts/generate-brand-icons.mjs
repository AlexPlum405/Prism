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

function centeredCrop(metadata, ratio) {
  const sourceSize = metadata.width;
  const cropSize = Math.round(sourceSize * ratio);
  const left = Math.floor((sourceSize - cropSize) / 2);
  const top = Math.floor((sourceSize - cropSize) / 2);

  return { left, top, width: cropSize, height: cropSize };
}

async function renderStandardIcon(size) {
  return sharp(sourceIconPath)
    .resize(size, size, {
      fit: 'cover',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function renderWindowsSmallIcon(size, metadata) {
  const crop = centeredCrop(metadata, windowsCropRatio(size));

  return sharp(sourceIconPath)
    .extract(crop)
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

async function renderIcon(size, mode, metadata) {
  if (mode === 'windows-small') {
    return renderWindowsSmallIcon(size, metadata);
  }

  return renderStandardIcon(size);
}

async function generateIcns(metadata) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prism-iconset-'));
  const iconsetDir = path.join(tempRoot, 'icon.iconset');

  await fs.mkdir(iconsetDir, { recursive: true });

  for (const [filename, size] of icnsIconsetEntries) {
    const buffer = await renderIcon(size, 'standard', metadata);
    await fs.writeFile(path.join(iconsetDir, filename), buffer);
  }

  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', outputIcnsPath], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  await fs.rm(tempRoot, { recursive: true, force: true });
}

async function generateIco(metadata) {
  const pngLayers = [];

  for (const size of icoLayerSizes) {
    const mode = size <= 64 ? 'windows-small' : 'standard';
    const buffer = await renderIcon(size, mode, metadata);
    pngLayers.push({ size, buffer });
  }

  await fs.writeFile(outputIcoPath, buildPngCompressedIco(pngLayers));
}

async function writePngOutputs(outputs, metadata) {
  for (const [filename, size, mode] of outputs) {
    const buffer = await renderIcon(size, mode, metadata);
    await fs.writeFile(path.join(iconsDir, filename), buffer);
  }
}

await fs.mkdir(iconsDir, { recursive: true });

const metadata = await readSourceMetadata();
const appIconBuffer = await renderIcon(1024, 'standard', metadata);

await fs.writeFile(appIconPath, appIconBuffer);
await writePngOutputs(genericPngOutputs, metadata);
await writePngOutputs(windowsLogoOutputs, metadata);
await generateIcns(metadata);
await generateIco(metadata);

console.log(`Generated ${appIconPath}`);
console.log(`Generated ${outputIcnsPath}`);
console.log(`Generated ${outputIcoPath}`);
console.log('Windows small icon layers use the same brand source with size-specific clarity tuning.');
