/**
 * 把 `![说明](a.png){width=320}` 的尺寸属性挂到 image 节点上。
 *
 * 结果同时写两处，供不同渲染端消费：
 * - `data.hProperties.style`：HTML 侧（预览 / PDF / PNG / HTML 导出）直接生效；
 * - `data.prismImageSize`：DOCX 侧没有 HTML，只能读结构化尺寸。
 */
import { visit } from 'unist-util-visit';
import { imageSizeStyle, parseImageSizeFromText } from './imageSize';

export function remarkImageSize() {
  return (tree: any) => {
    visit(tree, (node: any) => {
      if (!Array.isArray(node.children)) return;

      for (let index = 0; index < node.children.length; index += 1) {
        const child = node.children[index];
        if (child?.type !== 'image') continue;

        const next = node.children[index + 1];
        if (next?.type !== 'text' || typeof next.value !== 'string') continue;

        const parsed = parseImageSizeFromText(next.value, 0);
        if (!parsed) continue;

        const style = imageSizeStyle(parsed.size);
        child.data = child.data ?? {};
        child.data.hProperties = {
          ...(child.data.hProperties ?? {}),
          ...(style ? { style } : {}),
        };
        child.data.prismImageSize = parsed.size;

        const rest = next.value.slice(parsed.endIndex);
        if (rest.trim()) next.value = rest;
        else node.children.splice(index + 1, 1);
      }
    });
  };
}
