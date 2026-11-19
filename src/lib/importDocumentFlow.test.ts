import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exists, mkdir, readFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { zipSync } from 'fflate';
import { useDocumentStore } from '../domains/document/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import { loadFolderTree } from '../domains/workspace/lib/loadFolderTree';
import { importDocumentFromPath } from './importDocumentFlow';
import { grantImportFileScope } from './fileSystemScope';

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('../domains/workspace/lib/loadFolderTree', () => ({ loadFolderTree: vi.fn() }));

vi.mock('./fileSystemScope', () => ({
  grantImportFileScope: vi.fn(),
  grantMarkdownFileScope: vi.fn(),
  grantWorkspaceDirectoryScope: vi.fn(),
}));

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function docxBytes(): Uint8Array {
  const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const documentXml = `<?xml version="1.0"?><w:document xmlns:w="${w}" xmlns:r="${r}"><w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>导入标题</w:t></w:r></w:p>
    <w:p><w:r><w:drawing><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><a:blip r:embed="rId5"/></a:graphicData></a:graphic></w:drawing></w:r></w:p>
  </w:body></w:document>`;
  const rels = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId5" Type="${r}/image" Target="media/image1.png"/></Relationships>`;

  return zipSync({
    'word/document.xml': encode(documentXml),
    'word/_rels/document.xml.rels': encode(rels),
    'word/media/image1.png': PNG_BYTES,
  });
}

describe('importDocumentFromPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDocumentStore.setState({ currentDocument: null });
    useWorkspaceStore.setState({
      fileTree: [],
      fileTreeMode: 'tree',
      rootPath: '/ws',
      workspaceTreeScope: 'currentLevel',
    });
    (exists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (writeTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (mkdir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('把网页转换成工作区里的 Markdown 文稿', async () => {
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(encode(
      '<html><body><article><h1>季度报告</h1><p>正文</p></article></body></html>',
    ));

    const result = await importDocumentFromPath('/downloads/季度报告.html', {
      documentStore: useDocumentStore.getState(),
      workspaceStore: useWorkspaceStore.getState(),
    });

    expect(result.path).toBe('/ws/季度报告.md');
    expect(result.assetCount).toBe(0);
    expect(writeTextFile).toHaveBeenCalledWith(
      '/ws/季度报告.md',
      expect.stringContaining('# 季度报告'),
      { createNew: true },
    );
    expect(useDocumentStore.getState().currentDocument?.content).toContain('# 季度报告');
  });

  it('把 Word 文稿连同内嵌图片一起导入', async () => {
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(docxBytes());

    const result = await importDocumentFromPath('/downloads/方案.docx', {
      documentStore: useDocumentStore.getState(),
      workspaceStore: useWorkspaceStore.getState(),
    });

    expect(result.assetCount).toBe(1);
    // 回归：导入来源不能走「只允许 Markdown/Text」的打开授权，否则 .docx 会被拒绝
    expect(grantImportFileScope).toHaveBeenCalledWith('/downloads/方案.docx');
    expect(mkdir).toHaveBeenCalledWith('/ws/assets', { recursive: true });
    expect(writeFile).toHaveBeenCalledWith('/ws/assets/image1.png', PNG_BYTES, { createNew: true });
    expect(writeTextFile).toHaveBeenCalledWith(
      '/ws/方案.md',
      expect.stringContaining('![](assets/image1.png)'),
      { createNew: true },
    );
  });

  it('同名文稿已存在时自动加序号，不覆盖原文件', async () => {
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(encode('<html><body><p>内容</p></body></html>'));
    (exists as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => path === '/ws/笔记.md');

    const result = await importDocumentFromPath('/downloads/笔记.html', {
      documentStore: useDocumentStore.getState(),
      workspaceStore: useWorkspaceStore.getState(),
    });

    expect(result.path).toBe('/ws/笔记 (1).md');
  });

  it('Markdown 与纯文本按原文导入，不重新解释', async () => {
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(encode('# 已经是 Markdown\n\n| a | b |\n'));

    const result = await importDocumentFromPath('/downloads/原文.md', {
      documentStore: useDocumentStore.getState(),
      workspaceStore: useWorkspaceStore.getState(),
    });

    expect(writeTextFile).toHaveBeenCalledWith(
      '/ws/原文.md',
      '# 已经是 Markdown\n\n| a | b |\n',
      { createNew: true },
    );
    expect(result.assetCount).toBe(0);
  });

  it('不支持的格式直接报错，不产生任何文件', async () => {
    await expect(importDocumentFromPath('/downloads/合同.pdf', {
      documentStore: useDocumentStore.getState(),
      workspaceStore: useWorkspaceStore.getState(),
    })).rejects.toThrow();

    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('转换结果为空时报错，避免留下空文稿', async () => {
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(encode('<html><body><script>x</script></body></html>'));

    await expect(importDocumentFromPath('/downloads/空白.html', {
      documentStore: useDocumentStore.getState(),
      workspaceStore: useWorkspaceStore.getState(),
    })).rejects.toThrow();

    expect(writeTextFile).not.toHaveBeenCalled();
  });
});
