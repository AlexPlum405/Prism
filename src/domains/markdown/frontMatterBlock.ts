/**
 * front matter 块的切分与标量归一。
 *
 * 文档属性（domains/markdown/frontMatter）与导出配置（domains/export/frontMatter）
 * 是两套 schema，但共用同一段骨架：开头 `---` 到下一行 `---` 之间的 YAML 文本、
 * 以及 Date／数字／字符串到字符串的归一。之前这段骨架各写一遍，两边的空值语义
 * 还不一样（一边返回空串、一边返回 undefined）。
 */

export const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export interface FrontMatterBlock {
  /** 块内的 YAML 文本，没有块时为空串 */
  raw: string;
  /** 去掉 front matter 之后的正文 */
  body: string;
  hasBlock: boolean;
}

export function splitFrontMatterBlock(content: string): FrontMatterBlock {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) return { raw: '', body: content, hasBlock: false };
  return {
    raw: match[1],
    body: content.slice(match[0].length),
    hasBlock: true,
  };
}

/**
 * YAML 标量转成展示用字符串。日期统一成 yyyy-mm-dd（js-yaml 会把未加引号的
 * `2026-01-02` 解析成 Date），非标量返回空串。
 */
export function frontMatterScalar(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value);
}

/** 把 YAML 根节点收成普通对象，数组与标量都当成空对象 */
export function frontMatterObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}
