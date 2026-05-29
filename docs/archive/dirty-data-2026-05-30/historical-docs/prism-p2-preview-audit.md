# Prism P2 预览同步与渲染诊断审计

> 日期：2026-05-15  
> 依据：`docs/prism-product-optimization-plan.md` 第 6 节  
> 结论：P2 已具备最小闭环，可以进入 P3 导出工作台；统一诊断面板仍作为后续增强保留。

| 项目 | 状态 | 证据 | 后续 |
| --- | --- | --- | --- |
| 双向滚动同步 | 已满足 | `SplitView` 按编辑器 top line 映射预览 scrollTop，预览滚动按 DOM source line 反推编辑器行号；`SplitView.test.tsx` 覆盖 editor/preview scroll ratio 上报。 | 长文精度可在 E2E 性能基准阶段继续校准。 |
| 预览 DOM source line | 已满足 | `markdownToHtml` 为 heading、paragraph、blockquote、list、math、code、table、hr 写入 `data-source-line` 和旧兼容 `data-line`；测试覆盖普通 block、Mermaid、display math。 | 保持 `data-line` 兼容，避免破坏旧映射。 |
| 点击预览跳源码 | 已满足 | 普通 block 点击、右键“在编辑器中定位源码”、诊断按钮 `data-preview-source-line` 都会调用 `jumpToLine`；测试覆盖普通 block 和诊断按钮。 | 复杂嵌套表格/列表可后续补 E2E。 |
| Mermaid 错误定位 | 最小闭环 | 渲染失败块显示摘要、源码行和“跳到源码”；测试覆盖错误摘要转义和 source line。 | 尚未进入统一诊断面板。 |
| KaTeX 错误定位 | 最小闭环 | `.katex-error` 会增强为可定位错误，并插入“跳到源码”按钮；测试覆盖 source line。 | 尚未进入统一诊断面板。 |
| 长文性能 | 最小闭环 | `PreviewPane` 对 Markdown 渲染做 120ms debounce；Mermaid SVG 按 `contentTheme + code hash` 缓存；测试覆盖 debounce 和缓存复用。 | 分批 Mermaid placeholder 队列已有 idle 调度，但仍需 10 万字基准验证。 |
| 预览位置记忆 | 已满足 | `OpenDocument.scrollState` 记录 editor/preview ratio；`lastSession.scrollState` 持久化并 normalize 到 0-1；切换视图时恢复。 | 真实窗口恢复可在手工 smoke 中验证。 |
| HTML 安全 | 已满足 | 预览链接只允许绝对 `http/https` 调系统 opener；本地/非 http 链接拦截并提示；`markdownToHtml` 不再把用户 raw HTML 传入预览 DOM，测试覆盖外链、本地链接、raw HTML 和 mark 转义。 | 若后续要支持安全 HTML 白名单，应通过结构化 sanitizer 引入，不回退到 `allowDangerousHtml`。 |

## 当前 P3 切片

下一批只做“上次导出”闭环：记录每个已保存文档最近一次成功导出的格式、路径和设置摘要，并提供“按上次设置导出”“覆盖上次导出文件”两个命令入口。该切片不重写导出渲染核心，不引入 Pandoc、front matter 覆盖、插件市场或云能力。
