import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { importDocxAsMarkdown } from './docxImport';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const PIC_NS = 'http://schemas.openxmlformats.org/drawingml/2006/picture';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function documentXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}" xmlns:a="${A_NS}" xmlns:wp="${WP_NS}" xmlns:pic="${PIC_NS}">
  <w:body>${body}</w:body>
</w:document>`;
}

function relsXml(entries: Array<{ id: string; target: string; type: 'hyperlink' | 'image' }>): string {
  const base = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const items = entries
    .map((entry) => `<Relationship Id="${entry.id}" Type="${base}/${entry.type}" Target="${entry.target}"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`;
}

const NUMBERING = `<?xml version="1.0" encoding="UTF-8"?>
<w:numbering xmlns:w="${W_NS}">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl>
    <w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

function buildDocx(input: {
  body: string;
  media?: Record<string, Uint8Array>;
  numbering?: string;
  rels?: string;
}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'word/document.xml': encode(documentXml(input.body)),
  };
  if (input.rels) files['word/_rels/document.xml.rels'] = encode(input.rels);
  if (input.numbering) files['word/numbering.xml'] = encode(input.numbering);
  for (const [name, bytes] of Object.entries(input.media ?? {})) {
    files[`word/${name}`] = bytes;
  }
  return zipSync(files);
}

function paragraph(runs: string, padding = ''): string {
  return `<w:p>${padding}<w:r>${runs}</w:r></w:p>`;
}

describe('importDocxAsMarkdown', () => {
  it('把 Word 标题样式还原成 Markdown 标题', () => {
    const body = [
      paragraph('<w:t>季度报告</w:t>', '<w:pPr><w:pStyle w:val="Title"/></w:pPr>'),
      paragraph('<w:t>一、收入</w:t>', '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>'),
      paragraph('<w:t>小节</w:t>', '<w:pPr><w:pStyle w:val="Heading3"/></w:pPr>'),
      paragraph('<w:t>正文段落</w:t>'),
    ].join('');

    const result = importDocxAsMarkdown(buildDocx({ body }));

    expect(result.markdown).toBe('# 季度报告\n\n## 一、收入\n\n### 小节\n\n正文段落');
  });

  it('保留加粗、斜体和删除线', () => {
    const body = `<w:p>
      <w:r><w:t>收入同比</w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>增长 12%</w:t></w:r>
      <w:r><w:rPr><w:i/></w:rPr><w:t>含汇率</w:t></w:r>
      <w:r><w:rPr><w:strike/></w:rPr><w:t>已废弃</w:t></w:r>
    </w:p>`;

    const result = importDocxAsMarkdown(buildDocx({ body }));

    expect(result.markdown).toContain('收入同比**增长 12%**');
    expect(result.markdown).toContain('*含汇率*');
    expect(result.markdown).toContain('~~已废弃~~');
  });

  it('加粗标记不会把首尾空格包进去', () => {
    const body = '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve"> 重点 </w:t></w:r></w:p>';

    const result = importDocxAsMarkdown(buildDocx({ body }));

    expect(result.markdown).toBe('**重点**');
  });

  it('还原项目符号与编号列表，并保留嵌套层级', () => {
    const bullet = (level: number, text: string) => paragraph(
      `<w:t>${text}</w:t>`,
      `<w:pPr><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="1"/></w:numPr></w:pPr>`,
    );
    const ordered = (text: string) => paragraph(
      `<w:t>${text}</w:t>`,
      '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr>',
    );

    const result = importDocxAsMarkdown(buildDocx({
      body: `${bullet(0, '华东')}${bullet(1, '上海')}${bullet(0, '华南')}${ordered('第一步')}${ordered('第二步')}`,
      numbering: NUMBERING,
    }));

    expect(result.markdown).toBe([
      '- 华东',
      '  - 上海',
      '- 华南',
      '',
      '1. 第一步',
      '2. 第二步',
    ].join('\n'));
  });

  it('把表格还原成管道表格，并转义竖线', () => {
    const cell = (text: string) => `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
    const body = `<w:tbl>
      <w:tr>${cell('名称')}${cell('数量')}</w:tr>
      <w:tr>${cell('苹果')}${cell('3')}</w:tr>
      <w:tr>${cell('梨|桃')}${cell('2')}</w:tr>
    </w:tbl>`;

    const result = importDocxAsMarkdown(buildDocx({ body }));

    expect(result.markdown).toContain('| 名称 | 数量 |');
    expect(result.markdown).toContain('| --- | --- |');
    expect(result.markdown).toContain('| 苹果 | 3 |');
    expect(result.markdown).toContain('| 梨\\|桃 | 2 |');
  });

  it('把超链接还原成 Markdown 链接', () => {
    const body = `<w:p><w:hyperlink r:id="rId9"><w:r><w:t>官网</w:t></w:r></w:hyperlink></w:p>`;

    const result = importDocxAsMarkdown(buildDocx({
      body,
      rels: relsXml([{ id: 'rId9', target: 'https://example.com', type: 'hyperlink' }]),
    }));

    expect(result.markdown).toBe('[官网](https://example.com)');
  });

  it('把内嵌图片导出为资源文件', () => {
    const body = `<w:p><w:r><w:drawing><wp:inline>
      <wp:docPr id="1" name="图片 1" descr="架构图"/>
      <a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill></pic:pic></a:graphicData></a:graphic>
    </wp:inline></w:drawing></w:r></w:p>`;

    const result = importDocxAsMarkdown(buildDocx({
      body,
      media: { 'media/image1.png': PNG_BYTES },
      rels: relsXml([{ id: 'rId5', target: 'media/image1.png', type: 'image' }]),
    }));

    expect(result.markdown).toBe('![架构图](assets/image1.png)');
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].fileName).toBe('image1.png');
    expect(Array.from(result.assets[0].bytes)).toEqual(Array.from(PNG_BYTES));
  });

  it('同一张图片重复出现只落一份资源', () => {
    const drawing = `<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

    const result = importDocxAsMarkdown(buildDocx({
      body: `${drawing}${drawing}`,
      media: { 'media/image1.png': PNG_BYTES },
      rels: relsXml([{ id: 'rId5', target: 'media/image1.png', type: 'image' }]),
    }));

    expect(result.assets).toHaveLength(1);
    expect(result.markdown.match(/!\[\]\(assets\/image1\.png\)/g)).toHaveLength(2);
  });

  it('文件名带空格时改成连字符，避免链接断掉', () => {
    const body = `<w:p><w:r><w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

    const result = importDocxAsMarkdown(buildDocx({
      body,
      media: { 'media/image 1.png': PNG_BYTES },
      rels: relsXml([{ id: 'rId5', target: 'media/image 1.png', type: 'image' }]),
    }));

    expect(result.assets[0].fileName).toBe('image-1.png');
    expect(result.markdown).toContain('assets/image-1.png');
  });

  it('转义正文里的 Markdown 记号', () => {
    const body = '<w:p><w:r><w:t>文件名 *重要* 与 a_b</w:t></w:r></w:p>';

    const result = importDocxAsMarkdown(buildDocx({ body }));

    expect(result.markdown).toBe('文件名 \\*重要\\* 与 a\\_b');
  });

  it('连续空段落被压成单个空行', () => {
    const body = `${paragraph('<w:t>上</w:t>')}<w:p/>${paragraph('<w:t></w:t>')}${paragraph('<w:t>下</w:t>')}`;

    const result = importDocxAsMarkdown(buildDocx({ body }));

    expect(result.markdown).toBe('上\n\n下');
  });

  it('不是有效的 Word 文件时明确报错', () => {
    expect(() => importDocxAsMarkdown(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });

  it('缺少正文时返回空结果并给出提示', () => {
    const files = {
      '[Content_Types].xml': encode('<?xml version="1.0"?><Types/>'),
    };
    const result = importDocxAsMarkdown(zipSync(files));

    expect(result.markdown).toBe('');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
