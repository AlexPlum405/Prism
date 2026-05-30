# 预览渲染异步化验证（消除主线程卡顿）

> 日期：2026-05-30
> 关联 goal：预览渲染异步化（Web Worker 优先 + 主线程降级）
> 关联基线：`docs/verification/prism-performance-baseline-2026-05-30.md`
> 采集环境：Apple M1 Max / macOS 26.5 / Node 25

## 背景

性能基线实测：约 1 万行含公式文档全量 `markdownToHtml` 渲染约 2128ms（KaTeX 占 66%），且**同步执行时完全阻塞主线程**——此间输入、滚动、点击均无响应，即「编辑大文档卡顿」的根因。

本次不改渲染逻辑、不分块（已论证文本切块无法与全量输出行号等价），改为把整个 `markdownToHtml` 调用从主线程移到 Web Worker，输出与现状完全一致。

## 方案

- `src/lib/markdownRenderCore.ts`：核心渲染函数 + 请求/响应协议，供 Worker 与单测共用；含 locale 注入（Worker 是独立模块实例，渲染前按主线程传入 locale 设定 i18n，渲染后恢复）。
- `src/lib/markdownRender.worker.ts`：Worker 入口，在工作线程执行渲染。
- `src/lib/markdownRenderService.ts`：主线程服务。优先用 `new Worker(new URL('./markdownRender.worker.ts', import.meta.url), { type: 'module' })`；Worker 不可用（jsdom/旧环境/创建失败）时自动降级主线程渲染。每次请求带递增序号，过期回包标记 stale 被丢弃，保证旧结果不覆盖新结果。
- `PreviewPane.tsx`：有 Worker 走异步服务，无 Worker 走原同步路径（保既有测试与降级行为）。Mermaid 仍在主线程、依赖 `html` 的 useEffect，html 异步更新后自然重渲，时序保留。

## 主线程阻塞对比（约 1 万行含公式文档）

| 指标 | 异步化前（同步） | 异步化后（Worker） |
|---|---|---|
| 文档规模 | 9243 行 / 114 KB | 同 |
| 主线程被阻塞时长 | **约 1548 ms** | **≈ postMessage 序列化开销（114KB 字符串，通常 <10ms）** |
| 阻塞期间输入/滚动 | 完全无响应 | 可正常响应 |
| 渲染总耗时 | 1548 ms（占用主线程） | 1548 ms（在工作线程，不占主线程） |

注：渲染**总耗时不变**（同一份 `markdownToHtml`），关键变化是这 1.5 秒从「主线程独占、UI 冻结」变为「工作线程进行、主线程可响应」。异步化不缩短计算，而是让计算不再阻塞交互——这正是消除卡顿的本质。

## 测试验证

`src/lib/markdownRenderService.test.ts`（8 用例，全过）覆盖四类：
- **字节一致**：Worker 路径与降级路径输出均与直接 `markdownToHtml` 完全相同。
- **过期丢弃**：连发三次请求，仅最新 `stale=false`，前两次 `stale=true`。
- **降级路径**：无 Worker 环境返回正确 HTML（含表格/代码/KaTeX/Callout 富内容）。
- **三语 i18n**：Worker 路径在 zh-CN/en-US/ja-JP 下 front matter 文案分别为「文档属性 / Document Properties / 文書プロパティ」。

`PreviewPane.test.tsx`（20 用例，全过）：同步降级路径下既有行为不回退（防抖、主题切换不重渲、source-line 锚点、Mermaid 时序、链接安全等）。

全套件：`npm test -- --run` → 147 文件 / 726 测试全绿。

## 复跑命令

```
npx vitest run src/lib/markdownRenderService.test.ts src/domains/editor/components/PreviewPane.test.tsx
```

## 剩余风险

- 真实 Tauri WebView 下 Worker 的实际加载与 postMessage 延迟需 app 内验证（构建产物正确性已由 npm run build 覆盖）。
- 首次渲染在 Worker 路径下有一次异步往返，极大文档首屏会短暂显示「更新中」状态，属预期。
