import { describe, expect, it } from 'vitest';
import { importHtmlAsMarkdown } from './htmlImport';

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_BASE64 = btoa(String.fromCharCode(...PNG_BYTES));

function page(body: string): string {
  return `<!doctype html><html><head><title>页面标题</title><style>p{}</style></head><body>${body}</body></html>`;
}

describe('importHtmlAsMarkdown', () => {
  it('保留正文结构，丢掉脚本、样式和导航', () => {
    const result = importHtmlAsMarkdown(page(`
      <nav>站点导航</nav>
      <article>
        <h1>季度报告</h1>
        <p>收入同比<strong>增长 12%</strong></p>
        <ul><li>华东</li><li>华南</li></ul>
      </article>
      <footer>版权所有</footer>
      <script>alert(1)</script>
    `));

    expect(result.markdown).toContain('# 季度报告');
    expect(result.markdown).toContain('**增长 12%**');
    expect(result.markdown).toMatch(/^- 华东$/m);
    expect(result.markdown).toMatch(/^- 华南$/m);
    expect(result.markdown).not.toContain('站点导航');
    expect(result.markdown).not.toContain('版权所有');
    expect(result.markdown).not.toContain('alert(1)');
  });

  it('优先取 article 主体，没有时退回 body', () => {
    const withArticle = importHtmlAsMarkdown(page('<main><p>主体内容</p></main><div>侧栏</div>'));
    expect(withArticle.markdown).toContain('主体内容');
    expect(withArticle.markdown).not.toContain('侧栏');

    const withBody = importHtmlAsMarkdown(page('<p>只有一段</p>'));
    expect(withBody.markdown).toBe('只有一段');
  });

  it('把内嵌图片拆成资源文件，改写成相对路径', () => {
    const result = importHtmlAsMarkdown(page(
      `<img src="data:image/png;base64,${PNG_BASE64}" alt="架构图">`,
    ));

    expect(result.markdown).toBe('![架构图](assets/image-1.png)');
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].fileName).toBe('image-1.png');
    expect(Array.from(result.assets[0].bytes)).toEqual(PNG_BYTES);
  });

  it('外链图片保持原地址', () => {
    const result = importHtmlAsMarkdown(page('<img src="https://example.com/a.png" alt="外链">'));

    expect(result.markdown).toBe('![外链](https://example.com/a.png)');
    expect(result.assets).toHaveLength(0);
  });

  it('没有地址的图片计入丢弃数量，不产生空图片语法', () => {
    const result = importHtmlAsMarkdown(page('<p>前</p><img alt="坏图"><p>后</p>'));

    expect(result.markdown).not.toContain('![');
    expect(result.droppedImageCount).toBe(1);
  });

  it('兼容只有 tbody 的表格', () => {
    const result = importHtmlAsMarkdown(page(`
      <table>
        <tbody>
          <tr><td>名称</td><td>数量</td></tr>
          <tr><td>苹果</td><td>3</td></tr>
        </tbody>
      </table>
    `));

    expect(result.markdown).toContain('| 名称 | 数量 |');
    expect(result.markdown).toContain('| 苹果 | 3 |');
  });

  it('两次导入的内嵌图片编号互不干扰', () => {
    const first = importHtmlAsMarkdown(page(`<img src="data:image/png;base64,${PNG_BASE64}">`));
    const second = importHtmlAsMarkdown(page(`<img src="data:image/png;base64,${PNG_BASE64}">`));

    expect(first.assets[0].fileName).toBe('image-1.png');
    expect(second.assets[0].fileName).toBe('image-1.png');
  });

  it('空网页得到空字符串而不是报错', () => {
    const result = importHtmlAsMarkdown('<html><body></body></html>');

    expect(result.markdown).toBe('');
    expect(result.assets).toEqual([]);
  });
});
