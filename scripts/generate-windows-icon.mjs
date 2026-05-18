import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sourceIconPath = path.join(repoRoot, 'src-tauri', 'app-icon.png');
const outputIconPath = path.join(repoRoot, 'src-tauri', 'icons', 'icon.ico');
const previewDir = path.join(repoRoot, '.tmp-icons', 'windows-icon-preview');

const iconSizes = [16, 24, 32, 48, 64, 128, 256];

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

await fs.mkdir(path.dirname(outputIconPath), { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const sourceBuffer = await fs.readFile(sourceIconPath);
const pngLayers = [];

for (const size of iconSizes) {
  const buffer = await sharp(sourceBuffer)
    .resize(size, size, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  pngLayers.push({ size, buffer });
  await fs.writeFile(path.join(previewDir, `${size}x${size}.png`), buffer);
}

await fs.writeFile(outputIconPath, buildPngCompressedIco(pngLayers));

console.log(`Generated ${outputIconPath}`);
console.log(`Preview layers: ${previewDir}`);
