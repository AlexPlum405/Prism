import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const iconsDir = path.join(repoRoot, 'src-tauri', 'icons');
const sourceDocumentIconPath = path.join(iconsDir, 'document-markdown-source.png');
const outputPngPath = path.join(iconsDir, 'document-markdown.png');
const outputIcnsPath = path.join(iconsDir, 'document-markdown.icns');

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

function markdownDocumentSvg() {
  return Buffer.from(`
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="softShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#7A5A33" flood-opacity="0.22"/>
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#5A3D25" flood-opacity="0.12"/>
    </filter>
    <linearGradient id="base" x1="160" y1="112" x2="872" y2="914" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFF7E8"/>
      <stop offset="1" stop-color="#EBD1A7"/>
    </linearGradient>
    <linearGradient id="cover" x1="235" y1="142" x2="780" y2="850" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFF3D8"/>
      <stop offset="0.55" stop-color="#F8E3BA"/>
      <stop offset="1" stop-color="#DFC18E"/>
    </linearGradient>
    <linearGradient id="page" x1="318" y1="168" x2="754" y2="720" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFDF8"/>
      <stop offset="0.68" stop-color="#FFF0CF"/>
      <stop offset="1" stop-color="#EBCB96"/>
    </linearGradient>
    <linearGradient id="fold" x1="674" y1="164" x2="814" y2="310" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFF9E8"/>
      <stop offset="1" stop-color="#DDBB82"/>
    </linearGradient>
    <linearGradient id="seal" x1="594" y1="474" x2="796" y2="716" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#E8843E"/>
      <stop offset="1" stop-color="#A8481F"/>
    </linearGradient>
  </defs>

  <rect x="92" y="78" width="840" height="868" rx="190" fill="url(#base)"/>
  <rect x="122" y="106" width="780" height="808" rx="154" fill="#FFF5E4" opacity="0.62"/>

  <g filter="url(#softShadow)">
    <rect x="204" y="136" width="624" height="720" rx="54" fill="url(#cover)" stroke="#B48752" stroke-width="8"/>
    <rect x="258" y="132" width="520" height="660" rx="36" fill="url(#page)" stroke="#C9A46F" stroke-width="7"/>
    <path d="M660 132H742C761.882 132 778 148.118 778 168V250L660 132Z" fill="url(#fold)"/>
    <path d="M660 132V220C660 238.778 675.222 254 694 254H778" stroke="#C19A65" stroke-width="7" stroke-linejoin="round"/>

    <g fill="#5A351F">
      <rect x="180" y="202" width="120" height="32" rx="16"/>
      <rect x="180" y="314" width="120" height="32" rx="16"/>
      <rect x="180" y="426" width="120" height="32" rx="16"/>
      <rect x="180" y="538" width="120" height="32" rx="16"/>
      <rect x="180" y="650" width="120" height="32" rx="16"/>
    </g>
    <g fill="#DCC394" stroke="#9B6A38" stroke-width="8">
      <circle cx="266" cy="218" r="28"/>
      <circle cx="266" cy="330" r="28"/>
      <circle cx="266" cy="442" r="28"/>
      <circle cx="266" cy="554" r="28"/>
      <circle cx="266" cy="666" r="28"/>
    </g>

    <rect x="382" y="296" width="286" height="26" rx="13" fill="#C5A77A"/>
    <rect x="382" y="376" width="318" height="24" rx="12" fill="#B79768"/>
    <rect x="382" y="454" width="250" height="24" rx="12" fill="#D2B88B"/>
    <rect x="382" y="704" width="180" height="22" rx="11" fill="#D7BF95"/>

    <g>
      <circle cx="642" cy="578" r="116" fill="#C9904F"/>
      <circle cx="642" cy="578" r="100" fill="url(#seal)" stroke="#6C341E" stroke-width="7"/>
      <path d="M578 514L605 450L636 515Z" fill="#C65F2A"/>
      <path d="M706 514L679 450L648 515Z" fill="#C65F2A"/>
      <path d="M595 510L611 474L627 512Z" fill="#FFF0D7"/>
      <path d="M689 510L673 474L657 512Z" fill="#FFF0D7"/>
      <ellipse cx="642" cy="581" rx="66" ry="70" fill="#F7E4C5"/>
      <path d="M567 557C590 538 613 536 633 560C608 570 587 579 566 598C560 584 558 570 567 557Z" fill="#F7E4C5"/>
      <path d="M717 557C694 538 671 536 651 560C676 570 697 579 718 598C724 584 726 570 717 557Z" fill="#F7E4C5"/>
      <circle cx="613" cy="570" r="15" fill="#2E2119"/>
      <circle cx="671" cy="570" r="15" fill="#2E2119"/>
      <circle cx="617" cy="565" r="5" fill="#FFFFFF"/>
      <circle cx="675" cy="565" r="5" fill="#FFFFFF"/>
      <ellipse cx="642" cy="606" rx="17" ry="13" fill="#322016"/>
      <path d="M642 618C632 633 616 638 603 628" stroke="#3A2116" stroke-width="8" stroke-linecap="round"/>
      <path d="M642 618C652 633 668 638 681 628" stroke="#3A2116" stroke-width="8" stroke-linecap="round"/>
    </g>

    <text x="384" y="654" fill="#3D2718" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Arial, sans-serif" font-size="90" font-weight="850" letter-spacing="-4">MD</text>
  </g>
</svg>
  `);
}

function compactMarkdownDocumentSvg(size) {
  const label = size <= 16 ? 'M' : 'MD';
  const fontSize = size <= 16 ? 270 : 245;

  return Buffer.from(`
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="rim" x1="124" y1="104" x2="898" y2="922" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFF5E2"/>
      <stop offset="1" stop-color="#D6AC72"/>
    </linearGradient>
    <linearGradient id="seal" x1="272" y1="166" x2="764" y2="652" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#E98A43"/>
      <stop offset="1" stop-color="#93411F"/>
    </linearGradient>
  </defs>

  <rect x="92" y="82" width="840" height="860" rx="184" fill="url(#rim)"/>
  <rect x="184" y="166" width="656" height="690" rx="130" fill="#FFF1D2"/>
  <circle cx="512" cy="392" r="214" fill="#C89152"/>
  <circle cx="512" cy="392" r="184" fill="url(#seal)"/>
  <path d="M388 286L440 164L500 286Z" fill="#C45F2A"/>
  <path d="M636 286L584 164L524 286Z" fill="#C45F2A"/>
  <path d="M421 278L448 216L478 284Z" fill="#FFF0D4"/>
  <path d="M603 278L576 216L546 284Z" fill="#FFF0D4"/>
  <ellipse cx="512" cy="405" rx="112" ry="120" fill="#F8E5C7"/>
  <path d="M370 360C414 319 457 321 497 365C448 379 408 401 371 435C354 406 352 380 370 360Z" fill="#F8E5C7"/>
  <path d="M654 360C610 319 567 321 527 365C576 379 616 401 653 435C670 406 672 380 654 360Z" fill="#F8E5C7"/>
  <circle cx="456" cy="382" r="28" fill="#2D2119"/>
  <circle cx="568" cy="382" r="28" fill="#2D2119"/>
  <circle cx="465" cy="371" r="9" fill="#FFFFFF"/>
  <circle cx="577" cy="371" r="9" fill="#FFFFFF"/>
  <ellipse cx="512" cy="446" rx="34" ry="25" fill="#322016"/>
  <path d="M512 470C492 502 461 510 438 489" stroke="#3A2116" stroke-width="18" stroke-linecap="round"/>
  <path d="M512 470C532 502 563 510 586 489" stroke="#3A2116" stroke-width="18" stroke-linecap="round"/>
  <text x="512" y="770" text-anchor="middle" dominant-baseline="middle" fill="#3A2416" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Arial, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="-12">${label}</text>
</svg>
  `);
}

async function renderDocumentIcon(size) {
  return sharp(sourceDocumentIconPath)
    .ensureAlpha()
    .resize(size, size, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function assertTransparentSourceCorners() {
  const metadata = await sharp(sourceDocumentIconPath).metadata();

  if (!metadata.hasAlpha) {
    throw new Error(`${sourceDocumentIconPath} must include an alpha channel so rounded document icon corners stay transparent.`);
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const channels = metadata.channels ?? 0;
  const pixels = await sharp(sourceDocumentIconPath).raw().toBuffer();
  const samplePoints = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  for (const [x, y] of samplePoints) {
    const alpha = pixels[(y * width + x) * channels + channels - 1];

    if (alpha !== 0) {
      throw new Error(`${sourceDocumentIconPath} must have transparent rounded corners; corner ${x},${y} has alpha ${alpha}.`);
    }
  }
}

async function generateIcns() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prism-document-iconset-'));
  const iconsetDir = path.join(tempRoot, 'document-markdown.iconset');

  await fs.mkdir(iconsetDir, { recursive: true });

  for (const [filename, size] of icnsIconsetEntries) {
    await fs.writeFile(path.join(iconsetDir, filename), await renderDocumentIcon(size));
  }

  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', outputIcnsPath], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  await fs.rm(tempRoot, { recursive: true, force: true });
}

await fs.mkdir(iconsDir, { recursive: true });
await assertTransparentSourceCorners();

await fs.writeFile(outputPngPath, await renderDocumentIcon(1024));

if (process.platform === 'darwin') {
  await generateIcns();
} else {
  try {
    await fs.access(outputIcnsPath);
    console.log(`Keeping existing ${outputIcnsPath}; iconutil is only available on macOS.`);
  } catch {
    throw new Error(`Cannot generate ${outputIcnsPath} outside macOS because iconutil is unavailable.`);
  }
}

console.log(`Generated ${outputPngPath}`);
console.log(`Generated ${outputIcnsPath}`);
