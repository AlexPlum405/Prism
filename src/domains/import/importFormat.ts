export type ImportFormat = 'docx' | 'html' | 'markdown' | 'text';

const FORMAT_EXTENSIONS: Record<ImportFormat, readonly string[]> = {
  html: ['html', 'htm', 'xhtml'],
  docx: ['docx'],
  markdown: ['md', 'markdown', 'mdown', 'mkd'],
  text: ['txt', 'text', 'csv', 'tsv', 'log', 'json', 'yaml', 'yml'],
};

function extensionOf(path: string): string {
  const match = /\.([^.\\/]+)$/.exec(path);
  return match?.[1]?.toLowerCase() ?? '';
}

export function detectImportFormat(path: string): ImportFormat | null {
  const extension = extensionOf(path);
  if (!extension) return null;

  for (const [format, extensions] of Object.entries(FORMAT_EXTENSIONS)) {
    if (extensions.includes(extension)) return format as ImportFormat;
  }
  return null;
}

/** 导入对话框的筛选器：能转换的格式排前面，原生 Markdown 排后面 */
export const IMPORT_FILE_FILTERS = [
  { name: '可转换文档（网页 / Word）', extensions: [...FORMAT_EXTENSIONS.html, ...FORMAT_EXTENSIONS.docx] },
  { name: 'Markdown / 纯文本', extensions: [...FORMAT_EXTENSIONS.markdown, ...FORMAT_EXTENSIONS.text] },
];

export function importedDocumentStem(path: string, fallback = '未命名'): string {
  const name = path.split(/[\\/]/).pop() ?? '';
  const index = name.lastIndexOf('.');
  const stem = index > 0 ? name.slice(0, index) : index === 0 ? '' : name;
  return stem.trim() || fallback;
}

const CHARSET_PATTERN = /<meta[^>]+charset\s*=\s*["']?\s*([\w-]+)/i;

/**
 * 网页文件常见 GBK/GB18030 编码，直接按 UTF-8 读会把中文读成乱码。
 * 先按 latin1 扫一遍开头取 meta charset，再按真实编码整体解码。
 */
export function decodeImportText(bytes: Uint8Array): string {
  let label = 'utf-8';
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const declared = CHARSET_PATTERN.exec(head)?.[1] ?? /charset\s*=\s*["']?\s*([\w-]+)/i.exec(head)?.[1];
  if (declared) {
    const normalized = declared.toLowerCase();
    // GB2312/GBK 都交给 gb18030，它是两者超集，覆盖面最大
    label = normalized === 'gb2312' || normalized === 'gbk' ? 'gb18030' : normalized;
  }

  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
