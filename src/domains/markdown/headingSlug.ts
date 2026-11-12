/**
 * 标题锚点的唯一实现。
 *
 * 项目里曾有三套：预览用这一份、导出目录用 toc.ts 的 slugifyHeading、
 * Rust 索引用 heading_slug。三处对 `/`、`_`、连续空格的处理各不相同，
 * 于是 `## A/B 测试` 在预览里是 `ab-测试`、在导出目录里是 `a-b-测试`，
 * 点大纲跳到错误位置、复制的深链也打不开。
 *
 * 规则（三处必须一致，Rust 侧见 domain/workspace_index.rs 的 heading_slug）：
 * 1. 先删行内标记字符 ` * _ ~ [ ] ( )
 * 2. 丢弃标点、斜杠、点号等一切非字母非数字
 * 3. 空白与连字符折叠成单个 -
 * 4. 去掉首尾的 -
 */
export function getMarkdownHeadingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 同一篇文稿内重复标题追加 -2、-3。
 *
 * 预览（remarkHeadingIds）、导出目录、Rust 索引都按这套规则，否则
 * 第二个 `## Notes` 会在三个地方指向不同锚点。
 */
export function createHeadingSlugRegistry() {
  const used = new Map<string, number>();

  return function nextSlug(text: string): string {
    const base = getMarkdownHeadingSlug(text);
    if (!base) return '';
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}
