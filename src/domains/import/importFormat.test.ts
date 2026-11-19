import { describe, expect, it } from 'vitest';
import {
  IMPORT_FILE_FILTERS,
  decodeImportText,
  detectImportFormat,
  importedDocumentStem,
} from './importFormat';

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('detectImportFormat', () => {
  it('识别可以转换的格式', () => {
    expect(detectImportFormat('/tmp/报告.html')).toBe('html');
    expect(detectImportFormat('/tmp/报告.HTM')).toBe('html');
    expect(detectImportFormat('/tmp/报告.docx')).toBe('docx');
  });

  it('把已是 Markdown 的文件单独分类，避免二次转换', () => {
    expect(detectImportFormat('/tmp/报告.md')).toBe('markdown');
    expect(detectImportFormat('/tmp/报告.markdown')).toBe('markdown');
  });

  it('纯文本按原样导入', () => {
    expect(detectImportFormat('/tmp/日志.txt')).toBe('text');
    expect(detectImportFormat('/tmp/data.csv')).toBe('text');
  });

  it('未知扩展名和没有扩展名都返回 null', () => {
    expect(detectImportFormat('/tmp/报告.pdf')).toBeNull();
    expect(detectImportFormat('/tmp/README')).toBeNull();
    expect(detectImportFormat('')).toBeNull();
  });
});

describe('importedDocumentStem', () => {
  it('去掉扩展名并保留中文与空格', () => {
    expect(importedDocumentStem('/tmp/季度 报告.docx')).toBe('季度 报告');
    expect(importedDocumentStem('/tmp/a.b.html')).toBe('a.b');
  });

  it('没有文件名时退回默认名', () => {
    expect(importedDocumentStem('/tmp/.html')).toBe('未命名');
  });
});

describe('decodeImportText', () => {
  it('按 meta charset 解码非 UTF-8 网页', () => {
    // 「你好」的 GBK 编码
    const gbk = new Uint8Array([0xc4, 0xe3, 0xba, 0xc3]);
    const head = encode('<html><head><meta charset="gbk"></head><body>');
    const bytes = new Uint8Array([...head, ...gbk]);
    expect(decodeImportText(bytes)).toContain('你好');
  });

  it('没有声明时按 UTF-8 解码，并去掉 BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encode('正文')]);
    expect(decodeImportText(bytes)).toBe('正文');
  });
});

describe('IMPORT_FILE_FILTERS', () => {
  it('对话框里同时列出可转换格式和原生格式', () => {
    const extensions = IMPORT_FILE_FILTERS.flatMap((filter) => filter.extensions);

    expect(extensions).toContain('html');
    expect(extensions).toContain('docx');
    expect(extensions).toContain('md');
    expect(extensions).toContain('txt');
  });
});
