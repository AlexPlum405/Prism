# 导出保真验收记录（竞品差距补齐 Phase 3）

> 日期：2026-05-30
> 关联 goal：`docs/prism-competitor-gap-fix-goal.md`
> 关联报告：`docs/prism-vs-competitors-benchmark-2026-05-30.md`（短板③ 导出保真未被验证）

## 结论

导出保真在评测报告里被列为「广度够、保真度缺实战检验」的短板。本轮核查发现：**导出难点其实已有大量自动回归覆盖**，`CONTEXT.md` 的关键硬要求基本都有对应测试。真正缺的是一份集中的、面向人工核对的黄金样本文档。本轮已补齐该样本与机器可断言的回归。

## 已有自动回归覆盖（核查所得）

`src/domains/export/exportPipeline.test.ts`（60 用例）等已覆盖：

| CONTEXT.md 硬要求 | 对应测试 |
| --- | --- |
| 图片/渲染块不被分页切断 | `inserts pdf pagination spacers before atomic blocks that would be cut by a page boundary`（exportPipeline.test.ts:960） |
| 标题与后续可视块不分离 | `keeps headings attached to following raw html visual blocks during pdf pagination`（:1006） |
| PNG 高清、超限报错而非降清 | `rejects over-limit png exports instead of lowering the requested scale`（:833） |
| 长文多页不降清 | `renders long pdf documents in multi-page batches without lowering scale`（:853） |
| DOCX 中 Mermaid PNG-first | `renders Mermaid docx diagrams as png-first images with root-level non-html labels`（:1639） |
| 图片链接保留可点击 | `keeps markdown image links clickable in docx output`（:1549） |
| 相对本地 SVG 内联 | `inlines relative local svg images from the markdown document directory`（:329） |
| Callout/Toggle 不漏源码标记 | `exports callout and toggle blocks to docx without leaking source markers`（:1606） |
| Mermaid 渲染失败隔离 | `isolates Mermaid parser error artifacts during html/docx export`（:350, :1767） |

## 本轮新增

1. **黄金样本文档**：`docs/examples/export-fidelity-sample.md`
   - 集中覆盖：front matter、中文长文、行内标记（加粗/斜体/删除线/高亮/行内公式）、宽表格、带语言/无语言/含 Markdown 字面量的代码块、块级 KaTeX、Mermaid、本地 SVG 图片、四类 Callout、Toggle、长文分页压力。
   - 配套图片：`docs/examples/assets/export-fidelity-sample.svg`
2. **回归测试**：`src/domains/export/goldenSampleFidelity.test.ts`（8 用例，全过）
   - 断言：样本含全部难点块；渲染产出表格/高亮/KaTeX/Mermaid 占位/Callout/Toggle/mark；真实 Callout 被识别；代码块内 Markdown 字面量原样保留（不被解析）；五套主题渲染不抛异常且产物非空。

## 人工核对待办（需真实 app）

以下属于「需肉眼核对」，自动回归无法替代，建议在真实构建里对 `export-fidelity-sample.md` 实测：

- [ ] HTML 导出：四类 Callout 样式区分、Toggle 可展开、SVG 清晰
- [ ] PDF 导出：Mermaid/KaTeX/SVG 清晰不模糊，长文分页处图片与渲染块不被切断，Toggle 为展开态
- [ ] PNG 导出：高清，超大不自动降清
- [ ] DOCX 导出：表格保留、Mermaid 为 PNG、Toggle 降级为「标题+展开正文」、图片链接可点击

## 验证命令

```
npx vitest run src/domains/export/
```

结果：21 文件 132 用例通过（2026-05-30）。
