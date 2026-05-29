# Prism 预览同步与长文性能 Smoke 验证

> 日期：2026-05-15
> 目标：验证源码编辑与 Markdown 预览之间的映射、滚动同步、点击跳转和渲染诊断在真实长文中可信。
> 计划来源：`docs/archive/dirty-data-2026-05-30/historical-docs/prism-product-optimization-plan.md` 第 6 节“预览同步与渲染诊断”。
> 当前状态：已补长文和重媒体 source-line mapping 自动化回归，并降低预览滚动回算中的样式读取成本；macOS 真实 `.app` 已补分栏长文打开、源码/预览滚动同步、预览点击跳源码、底部错误区不空白、单次真实输入预览刷新、视图切换、undo history、`Cmd+Down` 跳文末同步、本地图片 / Mermaid / KaTeX 混排重媒体 smoke，以及 System Events 键盘突发输入 smoke；30 秒人工输入、精确帧率和 CPU 量化尚未闭环。

## 1. 覆盖范围

本 smoke 覆盖：

- 预览 DOM block 的 `data-source-line` 映射。
- 分栏模式下编辑器滚动驱动预览滚动。
- 分栏模式下预览滚动驱动编辑器滚动。
- 点击预览段落、标题、代码块跳回源码。
- Mermaid 渲染失败显示错误摘要和“跳到源码”。
- KaTeX 解析失败显示可定位错误。
- 视图切换后保留 editor mount、undo history 和 scroll state。
- 10 万字级中文长文的基本输入、滚动和预览刷新性能。

本 smoke 不覆盖：

- 导出产物；导出见 `docs/verification/prism-complex-export-smoke.md`。
- 完整可视化 pixel diff。
- 移动端或多窗口协同。

## 2. 现有自动化覆盖

当前自动测试已覆盖主要映射逻辑：

- `src/lib/markdownToHtml.test.ts`
  - 普通 block 写入 `data-source-line`。
  - Mermaid placeholder 保留源码行。
  - display math 保留源码行。
  - citekey 占位不破坏预览。
  - 用户编写的 raw HTML 不进入预览 DOM。
  - `javascript:` 链接和图片协议会在 Markdown -> HTML 阶段被移除，避免可执行 URL 进入预览 DOM。
  - URL 协议判断会先移除控制字符再校验，避免 `java\nscript:` 这类变体生成可点击 href。
  - 120 节、超过 10 万字符的长文 smoke fixture 能在宽松预算内完成 Markdown -> HTML，并保留大量 `data-source-line` 锚点、Mermaid 占位和 KaTeX 错误文本。
  - 20 节重媒体 smoke fixture 覆盖 50 张图片、20 个 Mermaid 块、20 个 display math 块，验证 Markdown -> HTML 在宽松预算内保留媒体节点、Mermaid placeholder、KaTeX display math 和 source-line 锚点。
- `src/domains/editor/components/SplitView.test.tsx`
  - 预览 block 点击跳源码。
  - 渲染诊断按钮跳源码。
  - editor / preview scroll ratio 上报。
  - preview 模式切换时保留 editor mount。
  - 120 节长文 DOM 的源码行号 ↔ 预览 scrollTop 双向映射，覆盖代码块内部按比例映射。
  - 重媒体预览 DOM 的 round-trip drift：100 个章节、50 个图片占位、20 个 Mermaid 占位、20 个 KaTeX 占位和代码块抽样，确认源码行 → 预览 scrollTop → 源码行最大 drift 小于 1 行，且映射回算在宽松预算内完成。
- `src/domains/editor/components/PreviewPane.test.tsx`
  - 内容连续变化时 debounce 只渲染最后一次内容，并在刷新后替换旧 `data-source-line` DOM 锚点。
  - Mermaid 渲染失败显示 source-locatable diagnostic。
  - Mermaid SVG cache。
  - 多个 Mermaid 块按顺序排队渲染，不会一次性并发启动所有 `mermaid.render()`。
  - KaTeX error 增强为可跳源码动作。
  - 外部链接走 opener，本地链接阻断并提示。
  - 协议相对外链走 opener，`javascript:` 等非 http 链接被阻断并提示。

这些测试证明 mapping、错误路径、Mermaid cache、Mermaid 顺序渲染队列和基础预览链接安全可用，并能防止长文代码块内部行号回算漂移；重媒体 DOM 回归能量化预览映射 drift 和回算成本。但它仍不能替代真实 CodeMirror 输入延迟、真实浏览器布局、Mermaid/KaTeX 批量渲染耗时和用户点击路径。

## 3. Smoke 工作区

建议固定使用仓库内临时目录，验证完成后可删除：

```text
.codex-smoke/preview-sync/
  preview-sync.md
```

## 4. 准备 fixture

创建 `preview-sync.md`。建议由脚本生成长文，避免手写：

```bash
mkdir -p .codex-smoke/preview-sync
node <<'NODE'
const fs = require('node:fs');
const parts = ['# 预览同步 Smoke\n'];
for (let i = 1; i <= 120; i += 1) {
  parts.push(`\n## 第 ${i} 节\n`);
  for (let j = 1; j <= 12; j += 1) {
    parts.push(`这是第 ${i} 节第 ${j} 段，用于验证长文滚动同步。English words ${i}-${j} 与中文混排，行内公式 $a_${i}${j} + b = c$。\n\n`);
  }
  if (i % 15 === 0) {
    parts.push('```ts\nconst title = "Prism Preview Smoke";\nconsole.log(title);\n```\n\n');
  }
  if (i % 20 === 0) {
    parts.push('```mermaid\ngraph TD\n  A[源码] --> B[预览]\n  B --> C[点击跳转]\n```\n\n');
  }
}
parts.push('\n## Mermaid 错误\n\n```mermaid\ngraph TD\n  A -->\n```\n');
parts.push('\n## KaTeX 错误\n\n$$\\badcommand{$$\n');
fs.writeFileSync('.codex-smoke/preview-sync/preview-sync.md', parts.join(''));
NODE
```

## 5. 操作步骤：source line 映射与点击跳转

1. 启动 Prism。
2. 打开 `.codex-smoke/preview-sync/preview-sync.md`。
3. 切到分栏模式。
4. 在预览中点击：
   - 第 20 节标题。
   - 第 45 节正文段落。
   - 任意代码块。
5. 观察源码光标和高亮位置。

通过标准：

- 点击预览标题、段落、代码块后，源码定位到对应行附近。
- 目标行短暂高亮或滚动到视口中部。
- 点击链接、按钮、可交互控件时不误触发源码跳转。

## 6. 操作步骤：双向滚动同步

1. 分栏模式下，从文档顶部缓慢滚动源码到第 60 节。
2. 观察预览是否跟随到第 60 节附近。
3. 再在预览中滚动到第 100 节。
4. 观察源码是否跟随到第 100 节附近。
5. 快速滚动到末尾，再回到顶部。

通过标准：

- 双向滚动不要求逐像素一致，但标题和正文区段应大致对齐。
- 快速滚动后不会出现明显反向抖动或滚动抢占。
- 文档顶部和底部不会卡死或跳到错误区段。

## 7. 操作步骤：错误诊断跳转

1. 滚动到 `Mermaid 错误`。
2. 确认预览显示 Mermaid 渲染失败摘要。
3. 点击“跳到源码”。
4. 滚动到 `KaTeX 错误`。
5. 确认 KaTeX 错误旁有可跳源码动作并点击。

通过标准：

- Mermaid 错误显示错误摘要，不导致整个预览空白。
- KaTeX 错误只影响当前公式，不导致整篇预览失败。
- 两类错误的“跳到源码”都能定位到出错源码附近。

## 8. 操作步骤：视图切换与 undo history

1. 在分栏模式修改一段正文。
2. 切到预览模式。
3. 再切回编辑模式。
4. 按 `Mod+Z`。

通过标准：

- 切换预览模式后 editor 不应丢失 undo history。
- 视图切换后滚动位置尽量恢复。
- 不应出现编辑器重建造成的选区丢失或输入卡死。

## 9. 操作步骤：长文性能

1. 在第 80 节附近连续输入 30 秒。
2. 同时观察预览刷新和输入延迟。
3. 连续滚动源码和预览各 30 秒。

建议记录：

```text
输入是否明显掉帧：
预览是否长时间空白：
Mermaid 是否阻塞整篇预览：
滚动是否卡顿：
CPU 风扇/高负载是否异常：
```

通过标准：

- 输入不应持续明显卡顿。
- 预览刷新可延迟，但不应长时间空白。
- Mermaid 批量渲染不能阻塞基础文字预览。

## 10. P0 / P1 判定

P0 问题：

- 点击预览跳到完全错误的源码区域。
- Mermaid / KaTeX 单块错误导致整篇预览空白。
- 视图切换后撤销历史丢失。
- 长文输入持续不可用。

P1 问题：

- 双向滚动 drift 明显，但仍在同一大章节内。
- 错误诊断能跳转但行号偏差较大。
- 长文滚动偶发卡顿。

## 11. 本轮记录

2026-05-15 补强自动化证据：

- `src/domains/editor/components/SplitView.tsx` 的 `pageOffsetToLine` 二分选择逻辑已修正为“选择 `top <= scrollTop` 的最后一个元素”，避免 scrollTop 落在代码块内部时错误使用前一个段落回算源码行。
- `src/domains/editor/components/SplitView.test.tsx` 新增长文 mapping 回归：模拟 120 节、360 个 preview block，验证第 80 节代码块内部行号和第 118 节段落的双向映射没有明显漂移。
- `npm test -- --run src/domains/editor/components/SplitView.test.tsx`：通过，6 tests。
- `src/domains/editor/components/SplitView.tsx` 优化 `pageOffsetToLine` 可见元素过滤：滚动回算不再对每个 source-line block 调用 `getComputedStyle`，只跳过不参与布局的 0 高度元素，降低长文预览滚动同步成本。
- `src/domains/editor/components/SplitView.test.tsx` 新增重媒体 round-trip drift 回归：模拟 100 个章节、50 个图片占位、20 个 Mermaid 占位、20 个 KaTeX 占位和代码块，抽样超过 250 个源码行，验证源码行 → 预览 scrollTop → 源码行最大 drift 小于 1 行，映射回算耗时小于 500ms。
- `npm test -- --run src/domains/editor/components/SplitView.test.tsx`：通过，1 file / 7 tests。
- `src/domains/editor/components/PreviewPane.tsx` 将同一预览内多个 Mermaid placeholder 改为顺序队列渲染，并在图表之间让出一次预览渲染 slot，避免长文里多个图表同时抢占渲染线程。
- `src/domains/editor/components/PreviewPane.test.tsx` 新增 Mermaid 顺序渲染回归：第一个 `mermaid.render()` 未完成前不会启动第二个图表渲染。
- `src/domains/editor/components/PreviewPane.test.tsx` 新增内容更新 source-line 刷新回归：debounce 后旧 `data-source-line` 锚点会被移除，新内容的 `data-source-line="80"` / `81` DOM 锚点可见，避免预览刷新后点击映射继续指向旧内容。
- `npm test -- --run src/domains/editor/components/PreviewPane.test.tsx`：通过，1 file / 12 tests。
- `src/lib/markdownToHtml.test.ts` 新增长文 smoke fixture：120 节、超过 10 万字符、6 个 Mermaid 块和 KaTeX 错误文本，验证基础 Markdown -> HTML 在 5 秒宽松预算内完成，且保留超过 1500 个 `data-source-line` 锚点。
- `src/lib/markdownToHtml.test.ts` 新增重媒体 smoke fixture：20 节、超过 2 万字符、50 张图片、20 个 Mermaid 块、20 个 display math 块，验证基础 Markdown -> HTML 在 5 秒宽松预算内完成，且保留图片、Mermaid placeholder、KaTeX display math 和 source-line 锚点。
- `npm test -- --run src/lib/markdownToHtml.test.ts`：通过，1 file / 19 tests。
- `npm test -- --run`：通过，54 files / 309 tests。
- `npm run build`：通过，仅有既有 Vite large chunk warning。
- `git diff --check`：通过。

### 2026-05-15 macOS 真实 `.app` 长文预览 drift smoke

- 使用 `npm run tauri:build:app-smoke` 生成的 `Prism.app`，打开 `.codex-smoke/preview-sync/preview-sync.md`。
- fixture：约 193KB，120 节，超过 8.5 万字符，包含多段中文/英文混排、行内 KaTeX、每 15 节一个代码块、每 20 节一个 Mermaid 块，末尾包含 Mermaid 错误和 KaTeX 错误。
- 分栏打开：点击“分栏”后左侧 CodeMirror 和右侧 Preview 同时显示第 1 节内容，预览非空白。
- 源码滚动到预览：对分栏窗口滚动约 10 页后，左侧源码到第 14/15 节附近，右侧预览同步显示第 14/15 节附近，未出现明显反向抖动。
- 预览滚动到源码：在右侧预览区域点击后继续滚动，约 1 秒内左侧源码和右侧预览共同稳定到第 27/28 节附近，属于同一章节区间。
- 预览点击跳源码：点击右侧第 28 节标题后，左侧源码定位到第 28 节标题附近，状态栏显示 `LN 716 COL 1`。
- 底部错误区：光标跳到末尾后，左侧源码显示第 120 节末尾、Mermaid 错误和 KaTeX 错误；一次小幅滚动后右侧预览同步到尾部，正常 Mermaid 图可见，底部错误诊断区域出现 `Syntax error in text`，整篇预览没有空白。
- 输入尝试：通过 Computer Use `type_text` 在第 28 节附近插入一段测试文本，实际工具调用耗时约 20 秒，无法区分 app 输入延迟与 Computer Use 输入开销，因此不作为真实输入性能通过证据。
- 截图证据：
  - `.codex-smoke/preview-sync/split-top-real-app.png`
  - `.codex-smoke/preview-sync/editor-to-preview-scroll-real-app.png`
  - `.codex-smoke/preview-sync/preview-to-editor-scroll-real-app.png`
  - `.codex-smoke/preview-sync/preview-click-jump-real-app.png`
  - `.codex-smoke/preview-sync/bottom-mermaid-sync-real-app.png`
  - `.codex-smoke/preview-sync/error-diagnostic-bottom-real-app.png`
- 限制：
  - 这次只证明 macOS 真实 `.app` 的长文滚动 drift、预览点击和尾部错误区可用；没有证明连续 30 秒真实人工输入延迟。
  - 该 drift smoke 原本未覆盖视图切换 / undo history / `Cmd+Down` 键盘跳转；同日补充见下一小节。
  - 未执行 50 图片 / 20 Mermaid / 20 KaTeX 组合的真实浏览器端到端性能 smoke。

### 2026-05-15 macOS 真实 `.app` 输入 / undo / 键盘跳转 smoke

- 使用同一个 `npm run tauri:build:app-smoke` 产物打开 `.codex-smoke/preview-sync/preview-sync.md`，保持分栏模式。
- 同一真实 app 会话中通过一次性粘贴 marker `PREVIEW_UNDO_PASTE_20260515` 修改文档；编辑器和右侧预览同时显示该 marker，落盘文件中 `rg -n "PREVIEW_UNDO"` 命中第 3 行。
- 切到预览模式再回到编辑模式后，marker 仍保留在编辑器内容中，说明这条路径没有重建 editor 导致内容丢失。
- 在编辑器焦点内按一次 `Cmd+Z` 后，marker 从编辑器和右侧预览同时消失；等待自动保存后 UI 显示“已保存”，`rg -n "PREVIEW_UNDO" .codex-smoke/preview-sync/preview-sync.md` 无命中，fixture 文件恢复到无 marker 状态。
- 从文档顶部按 `Cmd+Down` 后，编辑区跳到文档尾部，状态栏显示 `LN 3210 COL 1`；右侧预览同步显示第 120 节末尾、代码块、Mermaid 错误和 KaTeX 错误区域，未复现此前“键盘跳尾后预览不立即跟随”的弱观察。
- 本轮仍不把连续输入性能判定为通过：前序 `type_text` 工具耗时无法区分 app 输入延迟和 Computer Use 输入开销；需要后续用更接近真实键盘输入的工具或人工计时补证。

### 2026-05-15 macOS 真实 `.app` 重媒体端到端 smoke

- 实现补丁：`PreviewPane` 接收当前文档路径后，将本地 `img[src]` / `source[src]` 相对路径解析到当前文档目录，通过已授权的 Tauri fs scope 读取文件并转为 `blob:` URL；没有引入 Tauri `assetProtocol` 静态全盘 scope。`DocumentView` / `SplitView` 负责把 `currentDocument.path` 传入预览。
- 自动化回归：`PreviewPane.test.tsx` 覆盖相对本地图片、绝对本地图片和远程 HTTPS 图片；本地图片走 `readFile()` + `URL.createObjectURL()`，远程图片保持原 URL。
- fixture：`.codex-smoke/preview-heavy/preview-heavy.md`，20 节、50 张本地 SVG 图片、20 个 Mermaid 块、20 个 display math 块，末尾包含 Mermaid 错误和 KaTeX 错误。
- 真实 app 路径：`npm run tauri:build:app-smoke` 重新生成 `src-tauri/target/release/bundle/macos/Prism.app`，再用 `open -na .../Prism.app .codex-smoke/preview-heavy/preview-heavy.md` 通过 macOS Opened 事件打开文件。
- 分栏打开：右侧预览显示标题、正文、行内 KaTeX 和本地 SVG 图片；第 1 节可见 `Prism preview media 01`，不再是断图。
- 中段滚动：滚动到第 4/5 节附近后，源码与预览同段稳定；右侧 Mermaid 图渲染为节点 / 箭头图，没有整篇空白。
- 尾部跳转：`Cmd+Down` 后源码到第 20 节和末尾错误区，右侧预览显示第 39/40 张本地图片和第 20 个 Mermaid 图，预览仍非空白。
- 截图证据：
  - `.codex-smoke/preview-heavy/real-app-heavy-top.png`
  - `.codex-smoke/preview-heavy/real-app-heavy-tail.png`
- 限制：
  - 本轮证明真实 app 中本地图片、Mermaid、KaTeX 和长文本混排可显示、可滚动、尾部不空白；没有采集帧率、CPU 或输入延迟指标。
  - 本轮暴露状态栏 `LINK 50` 对已存在本地图片误报缺失链接；随后已调整 `linkDiagnostics`：在没有资产感知索引时，Markdown 图片语法 `![](...)` 默认不做 missing-file 诊断，避免 Markdown-only 文件树造成假阳性。精确图片缺失检测仍需后续资产索引。

### 2026-05-15 macOS 真实 `.app` 键盘突发输入 smoke

- 工具：macOS `System Events` 向 Prism 进程发送真实 `keystroke` 事件，不使用剪贴板粘贴；命令总耗时 `/usr/bin/time -p` 记录为 `real 1.07s`。
- 输入内容：先输入 marker `PERF_TYPING_20260515`，再连续发送 30 组中英混排输入。由于当前系统中文输入法开启，原始英文 / 中文片段被输入法转换为中文词组；这说明测试经过真实输入法路径，不是直接写 DOM。
- 结果：编辑器接收约 1.1KB 新文本，右侧预览同步显示 marker 和后续文本，窗口没有空白或卡死；自动保存后 `rg -n "PERF_TYPING_20260515" .codex-smoke/preview-heavy/preview-heavy.md` 命中第 2 行。
- 清理：按一次 `Cmd+Z` 撤销整段临时输入，等待自动保存后同一 `rg` 命令无命中，fixture 恢复为无 marker 状态。
- 截图证据：
  - `.codex-smoke/preview-heavy/real-app-typing-smoke.png`
- 限制：
  - 这证明真实键盘事件的突发输入、预览刷新、自动保存和 undo history 可用；仍不等同于 30 秒人工连续输入、帧率或 CPU 基准。

待剩余真实性能 smoke 完成后，在此追加：

```text
日期：
Prism 版本：
运行方式：
平台：
source line 点击跳转：
编辑器 -> 预览滚动：
预览 -> 编辑器滚动：
Mermaid 错误定位：
KaTeX 错误定位：
视图切换 / undo：
长文输入：
长文滚动：
结论：
```
