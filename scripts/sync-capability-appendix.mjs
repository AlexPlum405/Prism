#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAPABILITIES_DOC = join(ROOT, 'docs', 'prism-capabilities.md');
const START = '<!-- CAPABILITIES:APPENDIX:START -->';
const END = '<!-- CAPABILITIES:APPENDIX:END -->';

function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

function extractCommandIds() {
  const source = read('src/domains/commands/types.ts');
  const block = source.match(/export type CommandId =([\s\S]*?);/);
  if (!block) throw new Error('未找到 CommandId 类型定义');
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function extractArrayStrings(source, constName) {
  const pattern = new RegExp(`export const ${constName} = \\[([\\s\\S]*?)\\] as const;`);
  const block = source.match(pattern);
  if (!block) throw new Error(`未找到 ${constName}`);
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function extractFileExtensions() {
  const source = read('src/domains/workspace/services/fileAssociation.ts');
  return {
    markdown: extractArrayStrings(source, 'MARKDOWN_DOCUMENT_EXTENSIONS'),
    text: extractArrayStrings(source, 'TEXT_DOCUMENT_EXTENSIONS'),
  };
}

function extractImportExtensions() {
  const source = read('src/domains/import/importFormat.ts');
  const block = source.match(/const FORMAT_EXTENSIONS[^{]*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('未找到 FORMAT_EXTENSIONS');

  const extensions = {};
  for (const match of block[1].matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
    extensions[match[1]] = [...match[2].matchAll(/'([^']+)'/g)].map((item) => item[1]);
  }
  return extensions;
}

function extractExportFormats() {
  const source = read('src/domains/export/types.ts');
  const block = source.match(/export type ExportFormat =([\s\S]*?);/);
  if (!block) throw new Error('未找到 ExportFormat 类型定义');
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function extractTopLevelSettingsKeys(source) {
  const block = source.match(/export const DEFAULT_SETTINGS[^{]*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('未找到 DEFAULT_SETTINGS');
  return block[1]
    .split('\n')
    .filter((line) => /^ {2}[a-zA-Z][a-zA-Z0-9]*:/.test(line))
    .map((line) => line.trim().split(':')[0]);
}

function extractNestedSettingsKeys(block, parentKey) {
  const lines = block.split('\n');
  const start = lines.findIndex((line) => line.trim() === `${parentKey}: {`);
  if (start === -1) return [];
  const keys = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^ {2}\},?$/.test(line)) break;
    if (/^ {4}[a-zA-Z][a-zA-Z0-9]*:/.test(line)) {
      keys.push(line.trim().split(':')[0]);
    }
  }
  return [...new Set(keys)];
}

function extractSettingsKeys() {
  const source = read('src/domains/settings/types.ts');
  const block = source.match(/export const DEFAULT_SETTINGS[^{]*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('未找到 DEFAULT_SETTINGS');
  return {
    top: extractTopLevelSettingsKeys(source),
    exportDefaults: extractNestedSettingsKeys(block[1], 'exportDefaults'),
  };
}

function wrapList(items) {
  if (items.length === 0) return '（无）';
  return items.map((item) => `\`${item}\``).join('、');
}

function buildAppendix() {
  const commands = extractCommandIds();
  const extensions = extractFileExtensions();
  const formats = extractExportFormats();
  const importExtensions = extractImportExtensions();
  const settings = extractSettingsKeys();

  return [
    START,
    '> 本节由 `npm run capabilities:sync` 从代码生成，**不要手改**。`npm run capabilities:check` 会校验是否过期。',
    '',
    `### A. 命令（${commands.length}）`,
    '',
    '```text',
    commands.join(', '),
    '```',
    '',
    `### B. 设置项（${settings.top.length} 个顶层键 + ${settings.exportDefaults.length} 个导出键）`,
    '',
    `顶层：${wrapList(settings.top)}`,
    '',
    `导出：${wrapList(settings.exportDefaults)}`,
    '',
    '### C. 文件与导出格式',
    '',
    `Markdown 扩展名：${wrapList(extensions.markdown)}`,
    '',
    `Text 扩展名：${wrapList(extensions.text)}`,
    '',
    `导出格式：${wrapList(formats)}`,
    '',
    `导入 → Markdown（网页）：${wrapList(importExtensions.html ?? [])}`,
    '',
    `导入 → Markdown（Word）：${wrapList(importExtensions.docx ?? [])}`,
    '',
    `可直接导入（原文保留）：${wrapList([...(importExtensions.markdown ?? []), ...(importExtensions.text ?? [])])}`,
    '',
    END,
  ].join('\n');
}

function main() {
  const doc = readFileSync(CAPABILITIES_DOC, 'utf8');
  const startIndex = doc.indexOf(START);
  const endIndex = doc.indexOf(END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error('能力清单缺少自动附录标记');
  }

  const next = `${doc.slice(0, startIndex)}${buildAppendix()}${doc.slice(endIndex + END.length)}`;
  const checkOnly = process.argv.includes('--check');

  if (next === doc) {
    console.log('能力清单附录已是最新。');
    return;
  }

  if (checkOnly) {
    console.error('能力清单附录已过期，请运行 `npm run capabilities:sync`。');
    process.exit(1);
  }

  writeFileSync(CAPABILITIES_DOC, next);
  console.log('已更新能力清单附录。');
}

main();
