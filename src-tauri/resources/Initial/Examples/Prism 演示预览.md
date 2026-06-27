# 试试 command + option + p

---

## Prism 演示预览

把 Markdown 文稿直接变成可翻页的演示

---

## 快速开始

- 方法一：在文档中按 `Command + Option + P`
- 方法二：从菜单栏选择 **视图 > 演示预览**
- 方法三：在编辑区或预览区右键选择 **演示预览**
- 带有独立一行 `---` 分隔符的文档会被识别为多页演示
- 按 `Esc` 退出演示
- 使用方向键、空格或回车翻页

---

<!-- .slide: data-background="#F8CB9E" -->
## 自定义背景

Prism 支持在幻灯片顶部使用 Reveal 风格注释设置背景色：

```txt
<!-- .slide: data-background="#F8CB9E" -->
```

---

## 分步出现

下面的内容会按顺序出现：

- 第一步：确认文档结构 <!-- .element: class="fragment" -->
- 第二步：补充证据和图表 <!-- .element: class="fragment" -->
- 第三步：导出或演示 <!-- .element: class="fragment" -->

---

## 代码高亮

```ts
type Slide = {
  title: string;
  body: string;
};

const deck: Slide[] = [
  { title: 'Prism', body: 'Local-first Markdown presentation' },
];
```

---

## 数学公式

演示页中可以使用 KaTeX：

$$E = mc^2$$

行内公式也支持：$\pi \approx 3.14159$

---

## 图表支持

```mermaid
graph LR
    A[Markdown] --> B[Prism Preview]
    B --> C[Presentation]
    C --> D[Export]
```

---

## 双栏布局

<div style="display: flex; gap: 2rem;">
<div style="flex: 1;">

**左栏**

- 写作
- 图表
- 公式

</div>
<div style="flex: 1;">

**右栏**

- 预览
- 演示
- 导出

</div>
</div>

---

## 表格支持

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| Markdown | 支持 | 使用当前预览链路 |
| LaTeX 数学 | 支持 | KaTeX 渲染 |
| Mermaid | 支持 | 流程图、时序图等 |
| PlantUML | 支持 | PUML / PlantUML |
| Markmap | 支持 | 思维导图 |

---

<!-- .slide: data-background-iframe="https://example.com/" -->

---

## 谢谢观看

Prism 让本地 Markdown 文稿可以写作、预览、演示和导出。
