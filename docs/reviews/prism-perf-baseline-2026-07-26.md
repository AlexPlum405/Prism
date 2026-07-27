# Prism 性能基线报告（2026-07-26）

> 来源计划：`docs/plans/prism-quality-audit-upgrade-plan-2026-07-26.md` 阶段一渠道 1。
> 测量对象：分支 `codex/prism-full-optimization` @ `455f45a5`，**含未提交改动**（见当日 git status），非已发布版本。
> 环境：macOS 26.5（arm64），Node v25.9.0，Tauri release `.app`（local-smoke 配置，`npm run macos:build-fast`）。

## 1. 结论摘要

1. **3MB 文档预览从 6 月基线的 timeout 变为 2.5s 就绪** —— 6 月 17 日以来最大的性能改善，`e03f199e`（修复系统打开文件与大工作区卡顿）等提交见效。
2. **已定位根因：一处原生 HTML 块会让整篇文档失去预览快速路径，1MB 文档从 37ms 退化到 1817ms（49 倍）**。详见 §2.1。这不是"合成 fixture 不真实"的测量偏差，而是真实的用户可感知缺陷。
3. 诊断扫描、链接扫描、工作区索引、全文搜索均健康（详见 §4），不是当前瓶颈。
4. 基准 harness 自身有缺口：右键菜单自动化失败（System Events -25208 权限错误）、预览定位源码未自动化、tauri-driver 缺失导致 DOM commit 只能用替代观测值。

## 2. 核心发现

### 2.1 单个 HTML 块使整篇文档退出预览快速路径（已修复，issue #1）

> **2026-07-26 更新（同日修复）**：已按下文"修复方向"的首选方案实施——禁用条件改为作用于局部块而非整篇文档。
> `mixed-long.md`（1MB，528 个 `<details>`）大文档预览选项 **1816.6ms → 84.1ms**；`PreviewPane.performance.test.tsx`
> 的 `markdownToHtmlMs` **1690.1 → 94**。真实 WebView 前后对比见 §3.1。
> 修复过程中另发现一处独立缺陷：快速路径的行内渲染器从未处理 `*斜体*`、`_下划线_`、`~~删除线~~`、`~下标~`、
> `^上标^` 与 pandoc 引文，任何 300KB 以上文档都会把它们当纯文本输出。已一并补齐。
>
> 实现要点：新增 `findCommonPreviewRawHtmlChunkEnd` 做深度感知的 HTML 块切分，`renderCommonPreviewRawHtmlChunk`
> 把该块交给完整管线并用 `rebaseDelegatedChunkHtml` 重写 `data-source-line` / `data-task-checkbox-index` 偏移。
> 选择委派而非手写 HTML 渲染，是为了让 HTML 保真度与 `rehypePreviewUrlSafety` 净化行为与完整管线逐字节一致。
> 因扁平 sidecar source map 依赖"元素按文档顺序一一对应"，含委派块的文档不再输出 sidecar，改用行内
> `data-line` 属性映射（`previewScrollMap.ts` 已支持该回退）。

`markdownToHtml` 有一条 `renderCommonMarkdownPreviewFastPath` 快速路径（`src/lib/markdownToHtml.ts:1171`），命中时用手写渲染器代替完整 unified/remark/rehype 管线。命中条件是 5 个渲染选项全部匹配大文档预览配置，**且正文（代码围栏之外）不含原生 HTML、GFM 任务列表、脚注或链接引用定义**。

任一条件不满足即整篇文档回落到完整管线。实测同一份 1MB 文档：

| 文档 | 大文档预览选项 | 说明 |
|---|---:|---|
| `mixed-long.md`（含 `<details>` 折叠块） | **1816.6ms** | 快速路径被禁用 |
| 同一文档移除 `<details>` 后 | **36.8ms** | 快速路径命中，**快 49 倍** |
| `preview-webview-1mb.md`（无 HTML） | 37.5ms | 快速路径命中 |
| `preview-webview-1mb.md` 去掉任一选项 | 1466.1ms | 证明快速路径是全有或全无 |

复现：`node scripts/diagnose-preview-fast-path.mjs`（报告命中与否及禁用原因）、`node scripts/profile-markdown-pipeline.mjs`（对比耗时）。

**用户影响**：写一个 `<details>` 折叠块、一个任务列表 `- [ ]`、一个脚注或一处 `<br>`，整篇长文的预览渲染就慢 40 倍以上。这些都是 Markdown 长文的常见写法，而 CONTEXT.md 已规划 Toggle 折叠块能力（当前正靠 `<details>` 透传实现），会进一步放大该问题。

**修复方向（未实施，需另立计划）**：快速路径的禁用条件应作用于局部而非整篇文档——把含 HTML/任务列表/脚注的块隔离出去交给完整管线，其余部分继续走快速路径；或为这些常见构造在快速路径内补上直接渲染支持（任务列表、`<details>`、`<br>` 覆盖面最大）。任何改动都必须验证搜索、复制、滚动同步、源码定位、Mermaid/KaTeX 与导出预览一致性（CONTEXT.md 约束）。

## 3. 真实 WebView 基准（P-2 ~ P-6）

工具：`scripts/run-preview-webview-benchmark.mjs`；完整数据 `docs/verification/prism-preview-webview-benchmark-2026-07-26.{md,json}`。

| 指标 | 2026-06-17 | 2026-07-26 | 目标 | 判定 |
|---|---:|---:|---:|---|
| 1MB 打开→窗口可见 | 930.6ms | 1740.6ms | — | 波动（截图开销混入，见 §5） |
| 1MB 打开→会话就绪 | 4534ms | **1005ms** | <500ms | 明显改善，未达标 |
| 3MB 打开→窗口可见 | 928ms | 1013.2ms | — | 持平 |
| 3MB 打开→会话就绪 | **timeout** | **2525.4ms** | <1.5s | 重大改善，未达标 |
| 1MB 预览滚动 action | pass | 511.8ms | 无长帧 | 偏慢，待细分 |
| 3MB 预览滚动 action | 未测到（timeout） | 229.9ms | 无长帧 | 可接受 |
| 1MB / 3MB 预览搜索 | pass | 324.3ms / 336.9ms | <300ms | 边缘 |
| 预览右键菜单 | error | error（-25208） | — | **harness 缺口，非 app 结论** |

### 3.1 §2.1 修复的真实 WebView 前后对比

上表的 6/17 与 7/26 两列用的 fixture **不含任何原生 HTML**，因此无法体现 §2.1 的问题（这一盲点即 issue #3）。
为拿到有效证据，先修改 `scripts/run-preview-webview-benchmark.mjs` 的 `buildBenchmarkSection`，让 fixture 注入
真正会触发委派的构造（`<details>`/`<summary>` 折叠块、`- [x]` 任务列表、行内 `<kbd>`）；新 fixture 的委派块数量为
1MB 390 个 / 3MB 1158 个（`node scripts/diagnose-preview-fast-path.mjs` 报告）。

随后在同一 fixture 上各打一次 release `.app` 实测（before = `git show HEAD:src/lib/markdownToHtml.ts`）：

| 指标 | 修复前 | 修复后 | 判定 |
|---|---:|---:|---|
| 1MB 打开→会话就绪 | 2514.3ms | **1508.3ms** | 改善 40% |
| 1MB 打开→截图完成 | 7056.2ms | **5882.6ms** | 改善 17% |
| 3MB 打开→会话就绪 | 12094.6ms | **3527.7ms** | **改善 71%** |
| 3MB 打开→截图完成 | 15842.2ms | **7870.2ms** | 改善 50% |
| 1MB / 3MB 预览滚动 action | 198.0 / 206.9ms | 215.9 / 212.5ms | 持平（噪声内） |
| 1MB / 3MB 预览搜索 action | 309.1 / 294.4ms | 306.9 / 296.7ms | 持平 |

"打开→窗口可见"两次分别为 before 1133.4 / 345.1ms、after 1037.1 / 1014.0ms，波动大于差异，不作为结论。
滚动与搜索 action 持平说明委派带来的 DOM 结构变化（含 sidecar 回退为属性映射）没有拖慢交互。

## 4. Node 侧管线基准（快速回归信号，非发布证据）

### 4.1 预览管线（`PreviewPane.performance.test.tsx`，jsdom，3 次取中位）

| fixture | 大小 | markdownToHtml | domWrite | domTargetScan | domDiagnosticsScan |
|---|---:|---:|---:|---:|---:|
| 内置合成 1MB（快速路径命中） | 1.0MB | 65.4ms | 698.7ms | 117.2ms | 216.5ms |
| mixed-long（含 `<details>`，修复前快速路径整篇禁用） | 1.0MB | **1690.1ms** | 478.3ms | 66.9ms | 130.6ms |
| mixed-long（修复后，仅 HTML 块委派） | 1.0MB | **94ms** | 433.4ms | — | — |
| heavy-katex（500 行内 + 50 块级公式） | 66KB | 57.7ms | 30.9ms | 3.3ms | 7.3ms |
| heavy-mermaid（30 图） | 29KB | 13.7ms | 6.5ms | 0.4ms | 1.1ms |
| heavy-table（200×12 表 + 深嵌套列表） | 54KB | 22.6ms | 40.5ms | 0.1ms | 12.8ms |

两个 1MB fixture 的差异不是"合成 vs 真实"，而是 §2.1 的快速路径命中与否；`domWrite` 反而是快速路径产物更慢（HTML 结构不同）。
`node scripts/profile-markdown-pipeline.mjs` 的对照读数（修复后）：`mixed-long.md` 大文档预览选项 84.1ms，
去掉任一选项 1383.3ms，默认选项 1945.1ms；无 HTML 的 `preview-webview-1mb.md` 保持 38.6ms——说明提速确实来自委派改动，
而非选项判定被放宽。

fixture 生成：`node scripts/generate-perf-fixtures.mjs`（确定性输出到 `.codex-smoke/perf-fixtures/`）。
注：KaTeX/Mermaid 实际渲染是异步占位符流程，此处只含管线与 DOM 写入成本；重公式/重图表的真实渲染耗时需在真实 WebView 中补测。

### 4.2 诊断与索引（均达标，非瓶颈）

| 基准 | 规模 | 中位耗时 |
|---|---|---:|
| 全套文档诊断扫描（heading/link/table/typography） | 116KB / 6723 行 | 合计 ≈10ms |
| 链接扫描 | 1200 链接 vs 4000 工作区文件 | 5.2ms |
| 工作区文件集缓存复用 | 8000 文件 ×30 次编辑 | 0.4ms（重建 120.3ms） |
| 工作区索引构建 | 1501 文档 / 1500 链接 | 34.2ms |
| 全文搜索（重复查询） | 1200 文档 ×5 查询 | 7.7ms |

启用方式：`PRISM_DIAGNOSTICS_BENCH=1`、`PRISM_LINK_DIAGNOSTICS_BENCH=1`、`PRISM_WORKSPACE_INDEX_BENCH=1`、`PRISM_PREVIEW_BENCH=1`（可配 `PRISM_PREVIEW_BENCH_FILE` 指定外部 fixture）。

## 5. 待测项（本轮未覆盖，方法已明确）

| 指标 | 方法 | 阻碍 |
|---|---|---|
| P-1 冷启动到可输入 | WebView 基准增加空文档场景 | 需扩展 harness |
| P-7 输入延迟 p95 | Safari Web Inspector 挂真实 WKWebView（前端无纯浏览器 fallback，Chrome trace 不可用） | 需 devtools 构建 + 手动/AppleScript 采样 |
| P-8 分栏编辑→预览刷新 | 同上 | 同上 |
| P-9 重公式/图表真实渲染 | WebView 基准接入 `.codex-smoke/perf-fixtures/`（fixture 已就绪） | 需扩展 harness fixture 列表 |
| P-10 大工作区文件树 | 生成 2000+ 文件 fixture 工作区 + WebView 基准 | 需扩展 harness |
| P-11 内存三点采样 | Safari Web Inspector 堆快照 / Instruments Allocations | 手动执行 |
| P-12 导出耗时基线 | 手动计时 1MB → PDF/HTML/DOCX/PNG | 手动执行 |

## 6. 已识别问题（转 GitHub Issues）

1. ~~**[perf] 单个 HTML 块使整篇文档预览慢 49 倍**~~（issue #1，**已修复**，见 §2.1 / §3.1）：原生 HTML 与任务列表改为按块委派完整管线，1MB 混合文档 1816.6ms → 84.1ms，3MB 真实 WebView 会话就绪 12094.6ms → 3527.7ms。脚注、链接引用定义、缩进代码块仍需全文档上下文，保持整篇回落。
2. **[perf] 1MB/3MB 会话就绪未达目标**（1005ms vs 500ms；2525ms vs 1500ms）：3MB 已从 timeout 大幅改善，剩余差距待预览渲染策略评估——按 CONTEXT.md 约束，须先由真实 WebView 证据证明瓶颈再动渲染策略。
3. **[quality] WebView 基准 harness 缺口**：右键菜单自动化 System Events -25208、源码定位未自动化、`openCommandToVisibleMs` 混入截图开销导致波动（1MB 930→1740ms 不能解读为回归）、torture fixtures 未接入。
4. **[perf] 预览搜索 324-337ms 处于目标边缘**，3MB 滚动 action 后截图耗时 3.7s（可能含渲染追赶），待细分。

## 7. 复现命令

```bash
npm run macos:build-fast                               # 构建 release .app
node scripts/run-preview-webview-benchmark.mjs         # 真实 WebView 基准（会拉起 app，勿同时操作 Prism）
node scripts/generate-perf-fixtures.mjs                # 生成 torture fixtures
node scripts/diagnose-preview-fast-path.mjs            # 报告快速路径命中与禁用原因
node scripts/profile-markdown-pipeline.mjs             # 对比各 fixture 管线耗时
PRISM_PREVIEW_BENCH=1 PRISM_PREVIEW_BENCH_FILE=.codex-smoke/perf-fixtures/mixed-long.md \
  npx vitest run src/domains/editor/components/PreviewPane.performance.test.tsx --silent=false --reporter=verbose
```
