import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { access, copyFile, mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const defaultAppPath = path.join(
  repoRoot,
  'src-tauri',
  'target',
  'release',
  'bundle',
  'macos',
  'Prism.app',
);

const appPath = path.resolve(process.argv[2] ?? defaultAppPath);
const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
const resourcesDir = path.join(appPath, 'Contents', 'Resources');
const documentIconFile = 'PrismMarkdownSignatureDocument.icns';
const documentIconName = 'PrismMarkdownSignatureDocument';
const markdownUti = 'net.daringfireball.markdown';
const prismMarkdownUti = 'com.prism.editor.markdown';
const markdownUtiAliases = [
  'public.markdown',
  'net.ia.markdown',
  'com.unknown.md',
];
const textIconFile = 'PrismTextDocument.icns';
const textIconName = 'PrismTextDocument';
const prismTextUti = 'com.prism.editor.text';
const textUtiAliases = [
  'public.plain-text',
  'public.text',
  'public.source-code',
  'public.json',
  'public.yaml',
  'public.xml',
  'public.comma-separated-values-text',
  'public.tab-separated-values-text',
  'org.iso.sql',
];
const textExtensions = [
  'txt', 'text', 'sql', 'json', 'jsonc', 'yaml', 'yml', 'toml',
  'xml', 'csv', 'tsv', 'log', 'ini', 'conf', 'env',
];
const sourceIconPath = path.join(repoRoot, 'src-tauri', 'icons', 'document-markdown.icns');
const sourceTextIconPath = path.join(repoRoot, 'src-tauri', 'icons', 'document-text.icns');
const bundledIconPath = path.join(resourcesDir, documentIconFile);
const bundledTextIconPath = path.join(resourcesDir, textIconFile);
const installIdPath = path.join(resourcesDir, 'PrismInstallID');
const macosCodesignIdentity = process.env.PRISM_MACOS_CODESIGN_IDENTITY || '-';

async function ensureInstallId() {
  try {
    await access(installIdPath);
    return;
  } catch {
    await writeFile(installIdPath, `${randomUUID()}\n`, 'utf8');
  }
}

function readPlistJson(plistPath) {
  const json = execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', plistPath], {
    encoding: 'utf8',
  });

  return JSON.parse(json);
}

function hasMarkdownExtension(documentType) {
  const extensions = documentType?.CFBundleTypeExtensions;

  return Array.isArray(extensions)
    && extensions.some((extension) => ['md', 'markdown'].includes(String(extension).toLowerCase()));
}

function hasTextExtension(documentType) {
  const extensions = documentType?.CFBundleTypeExtensions;

  return Array.isArray(extensions)
    && extensions.some((extension) => textExtensions.includes(String(extension).toLowerCase()));
}

function hasMarkdownContentType(documentType) {
  const contentTypes = documentType?.LSItemContentTypes;

  return Array.isArray(contentTypes)
    && contentTypes.some((contentType) => [
      markdownUti,
      prismMarkdownUti,
      ...markdownUtiAliases,
    ].includes(String(contentType).toLowerCase()));
}

async function writePlistJson(plistPath, plist) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'prism-plist-'));
  const tempJsonPath = path.join(tempRoot, 'Info.json');

  try {
    await writeFile(tempJsonPath, JSON.stringify(plist, null, 2));
    execFileSync('/usr/bin/plutil', ['-convert', 'xml1', '-o', plistPath, tempJsonPath], {
      stdio: 'inherit',
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function repairMacosCodeSignature(targetAppPath) {
  if (os.platform() !== 'darwin') return;

  execFileSync('/usr/bin/codesign', [
    '--force',
    '--deep',
    '--sign',
    macosCodesignIdentity,
    targetAppPath,
  ], {
    stdio: 'inherit',
  });
}

function ensureMarkdownDocumentType(info) {
  if (!Array.isArray(info.CFBundleDocumentTypes)) {
    info.CFBundleDocumentTypes = [];
  }

  const markdownTypes = info.CFBundleDocumentTypes.filter((documentType) => (
    documentType?.CFBundleTypeName === 'Markdown Document'
    || documentType?.CFBundleTypeName === 'Markdown'
    || hasMarkdownExtension(documentType)
    || hasMarkdownContentType(documentType)
  ));

  if (markdownTypes.length === 0) {
    throw new Error(`No Markdown document type found in ${infoPlistPath}`);
  }

  const nonMarkdownTypes = info.CFBundleDocumentTypes.filter((documentType) => !markdownTypes.includes(documentType));
  const prismMarkdownDocumentType = {
    CFBundleTypeExtensions: ['md', 'markdown'],
    CFBundleIconName: documentIconName,
    CFBundleTypeIconFile: documentIconName,
    CFBundleTypeName: 'Prism Markdown Document',
    CFBundleTypeRole: 'Editor',
    LSItemContentTypes: [prismMarkdownUti],
    LSHandlerRank: 'Owner',
  };
  const markdownCompatibilityDocumentType = {
    CFBundleIconName: documentIconName,
    CFBundleTypeIconFile: documentIconName,
    CFBundleTypeName: 'Markdown Document',
    CFBundleTypeRole: 'Editor',
    LSHandlerRank: 'Owner',
    LSItemContentTypes: [
      markdownUti,
      ...markdownUtiAliases,
    ],
  };

  info.CFBundleDocumentTypes = [
    prismMarkdownDocumentType,
    markdownCompatibilityDocumentType,
    ...nonMarkdownTypes,
  ];
}

function ensureMarkdownCompatibilityUtiDeclarations(info) {
  const declaration = {
    UTTypeConformsTo: ['public.text'],
    UTTypeDescription: 'Markdown',
    UTTypeIconFile: documentIconName,
    UTTypeIdentifier: markdownUti,
    UTTypeTagSpecification: {
      'public.filename-extension': ['md', 'markdown'],
      'public.mime-type': ['text/markdown'],
    },
  };

  if (!Array.isArray(info.UTImportedTypeDeclarations)) {
    info.UTImportedTypeDeclarations = [];
  }

  const existingImportedIndex = info.UTImportedTypeDeclarations.findIndex(
    (candidate) => candidate?.UTTypeIdentifier === markdownUti,
  );

  if (existingImportedIndex >= 0) {
    info.UTImportedTypeDeclarations[existingImportedIndex] = declaration;
  } else {
    info.UTImportedTypeDeclarations.push(declaration);
  }

  if (Array.isArray(info.UTExportedTypeDeclarations)) {
    info.UTExportedTypeDeclarations = info.UTExportedTypeDeclarations.filter(
      (candidate) => candidate?.UTTypeIdentifier !== markdownUti,
    );
  }
  info.UTImportedTypeDeclarations = info.UTImportedTypeDeclarations.filter((candidate, index, declarations) => (
    candidate?.UTTypeIdentifier !== markdownUti
    || declarations.findIndex((entry) => entry?.UTTypeIdentifier === markdownUti) === index
  ));
}

function ensurePrismMarkdownUtiDeclaration(info) {
  const declaration = {
    UTTypeConformsTo: ['public.text'],
    UTTypeDescription: 'Prism Markdown Document',
    UTTypeIconFile: documentIconName,
    UTTypeIdentifier: prismMarkdownUti,
    UTTypeTagSpecification: {
      'public.filename-extension': ['md', 'markdown'],
      'public.mime-type': ['text/markdown'],
    },
  };

  if (!Array.isArray(info.UTExportedTypeDeclarations)) {
    info.UTExportedTypeDeclarations = [];
  }

  const existingIndex = info.UTExportedTypeDeclarations.findIndex(
    (candidate) => candidate?.UTTypeIdentifier === prismMarkdownUti,
  );

  if (existingIndex >= 0) {
    info.UTExportedTypeDeclarations[existingIndex] = declaration;
  } else {
    info.UTExportedTypeDeclarations.push(declaration);
  }
}

function ensureMarkdownAliasUtiDeclarations(info) {
  if (!Array.isArray(info.UTImportedTypeDeclarations)) {
    info.UTImportedTypeDeclarations = [];
  }

  for (const alias of markdownUtiAliases) {
    const declaration = {
      UTTypeConformsTo: [markdownUti, 'public.text'],
      UTTypeDescription: 'Markdown',
      UTTypeIconFile: documentIconName,
      UTTypeIdentifier: alias,
      UTTypeTagSpecification: {
        'public.filename-extension': ['md', 'markdown'],
        'public.mime-type': ['text/markdown'],
      },
    };
    const existingIndex = info.UTImportedTypeDeclarations.findIndex(
      (candidate) => candidate?.UTTypeIdentifier === alias,
    );

    if (existingIndex >= 0) {
      info.UTImportedTypeDeclarations[existingIndex] = declaration;
    } else {
      info.UTImportedTypeDeclarations.push(declaration);
    }
  }
}

async function ensureReadableFile(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} does not exist: ${filePath}`);
  }
}

function ensureTextDocumentType(info) {
  if (!Array.isArray(info.CFBundleDocumentTypes)) {
    info.CFBundleDocumentTypes = [];
  }

  const textTypes = info.CFBundleDocumentTypes.filter((documentType) => (
    documentType?.CFBundleTypeName === 'Text Document'
    || documentType?.CFBundleTypeName === 'Prism Text Document'
    || (hasTextExtension(documentType) && !hasMarkdownExtension(documentType))
  ));

  const nonTextTypes = info.CFBundleDocumentTypes.filter((documentType) => !textTypes.includes(documentType));

  const prismTextDocumentType = {
    CFBundleTypeExtensions: textExtensions,
    CFBundleIconName: textIconName,
    CFBundleTypeIconFile: textIconName,
    CFBundleTypeName: 'Prism Text Document',
    CFBundleTypeRole: 'Editor',
    LSItemContentTypes: [
      prismTextUti,
      ...textUtiAliases,
    ],
    LSHandlerRank: 'Default',
  };

  info.CFBundleDocumentTypes = [...nonTextTypes, prismTextDocumentType];
}

function ensurePrismTextUtiDeclaration(info) {
  const declaration = {
    UTTypeConformsTo: ['public.text'],
    UTTypeDescription: 'Prism Text Document',
    UTTypeIconFile: textIconName,
    UTTypeIdentifier: prismTextUti,
    UTTypeTagSpecification: {
      'public.filename-extension': textExtensions,
      'public.mime-type': ['text/plain'],
    },
  };

  if (!Array.isArray(info.UTExportedTypeDeclarations)) {
    info.UTExportedTypeDeclarations = [];
  }

  const existingIndex = info.UTExportedTypeDeclarations.findIndex(
    (candidate) => candidate?.UTTypeIdentifier === prismTextUti,
  );

  if (existingIndex >= 0) {
    info.UTExportedTypeDeclarations[existingIndex] = declaration;
  } else {
    info.UTExportedTypeDeclarations.push(declaration);
  }
}

await ensureReadableFile(infoPlistPath, 'Info.plist');
await ensureReadableFile(sourceIconPath, 'Markdown document icon');
await ensureReadableFile(sourceTextIconPath, 'Text document icon');
await ensureInstallId();

await copyFile(sourceIconPath, bundledIconPath);
await copyFile(sourceTextIconPath, bundledTextIconPath);

const info = readPlistJson(infoPlistPath);
ensureMarkdownDocumentType(info);
ensurePrismMarkdownUtiDeclaration(info);
ensureMarkdownCompatibilityUtiDeclarations(info);
ensureMarkdownAliasUtiDeclarations(info);
ensureTextDocumentType(info);
ensurePrismTextUtiDeclaration(info);
await writePlistJson(infoPlistPath, info);
repairMacosCodeSignature(appPath);

console.log(`Copied ${documentIconFile} to ${bundledIconPath}`);
console.log(`Copied ${textIconFile} to ${bundledTextIconPath}`);
console.log(`Patched Markdown and Text document icons in ${infoPlistPath}`);
console.log(`Re-signed ${appPath} with ${macosCodesignIdentity === '-' ? 'ad-hoc identity' : macosCodesignIdentity}`);
