# Prism 预览分段 DOM 提交方案（issue #2）

> 日期：2026-07-27
> 前置证据：`docs/reviews/prism-perf-issue-2-4-analysis-2026-07-27.md`、`docs/verification/prism-preview-webview-benchmark-2026-07-26.{md,json}`
> 状态：**设计草案，等待产品决策**。本文档不含已实施改动。

---

## 0. 门槛与约束

`CONTEXT.md`「真实预览性能基准」节要求：只有当真实 WebView 基准证明 DOM commit 或后处理是主要瓶颈时，才可进入分阶段 DOM commit / 渐进 hydrate。该门槛已由 2026-07-27 打包应用实测满足：

| 阶段 | 1MB 文档 | 3MB 文档 |
|---|---|---|
| 文件读取 | 9ms | 18ms |
| markdown → HTML | 189ms（HTML 1.74MB） | 365ms（HTML 5.23MB） |
| **markdown → DOM commit** | **660ms** | **4293ms（占总时长 85%）** |
| DOM commit → 首帧 | 826ms | 1555ms |
| 总计（打开到可见） | 1003.9ms | 5023.9ms |
| 500ms 去抖实际超时 | +321ms | +4098ms |

源文件 3 倍 → DOM commit 6.5 倍，超线性。去抖定时器被饿死 4 秒，说明这段时间主线程完全阻塞。瓶颈不在 markdown 解析（仅约 7%）。

同节还要求：任何预览性能改动必须同时验证搜索、复制、滚动同步、源码定位、Mermaid/KaTeX 和导出预览一致性。第 5 节按此列出验收矩阵。

---

## 1. 现状链路

`src/domains/editor/components/PreviewPane.tsx`：

```
content
  → [去抖 120/220/600ms 按大小]  renderContent
  → markdownRenderService.render()（worker 或主线程降级）
  → setHtml(result.html)
  → React 单次 dangerouslySetInnerHTML 写入 #write   ← 瓶颈在此
  → effect：collectPreviewDomPostProcessTargets + KaTeX/媒体/PlantUML/Mermaid 后处理
```

下游全部依赖 `#write` 的完整 DOM：

| 消费方 | 位置 | 依赖形态 |
|---|---|---|
| 滚动同步 / 源码定位 | `previewScrollMap.ts`、`SplitView.tsx` | `data-source-line` 元素 + `getBoundingClientRect` |
| 预览内搜索 | `SplitView.tsx:applyPreviewSearch` / `startProgressivePreviewSearch` | 遍历全部文本节点（已分批） |
| 后处理 | `previewDomTargets.ts` | 一次性 querySelectorAll 扫描全树 |
| 导出 | `exportPipeline.ts:1913` | **自建离屏 root，不复用实时预览 DOM** |

导出走独立管线，这一点降低了风险面：分段提交不会改变导出保真。

---

## 2. 一个先于架构改动的发现

`src/styles/preview.css:198` 与 `:212`：

```css
.preview-compat:not(.prism-export-document):not(.preview-compat--miaoyan) #write
  > :where(p, blockquote, ul, ol, dl, table, pre, figure, ...) {
  content-visibility: auto;
  contain-intrinsic-size: auto 180px;
}
```

`content-visibility: auto` 让屏幕外顶层块跳过布局与绘制——正是 DOM commit 超线性的直接对策。但选择器用 `:not(.preview-compat--miaoyan)` 排除了妙言主题，而妙言是默认内容主题（`settings/types.ts:165`）。

已核对基准运行时的实际配置（`~/Library/Application Support/com.prism.editor.v1/config.json`）：`contentTheme` 为 `miaoyan`。基准脚本也不覆写该字段（`run-preview-webview-benchmark.mjs:233` 只设 `defaultViewMode` / `restoreLastSession` / `lastSession` / `perfInstrumentation`）。**因此第 0 节的全部数字都是在 content-visibility 关闭的分支上取得的。**

该排除引入于 `69d80ca7`（2026-06-24，妙言主题优化批次），提交信息未说明原因，我没有找到记录该决策的文档。合理推测是当时发现妙言主题下 `content-visibility` 造成了视觉或滚动问题，但这是推测，不是已证事实。

结论：在动渲染架构之前，必须先回答"妙言主题为什么被排除"。如果是可修复的具体问题，收益/成本比远优于分段提交。

---

## 3. 三个候选方案

### 方案 A：恢复妙言主题的 content-visibility（最小改动）

去掉 `:not(.preview-compat--miaoyan)`，按需补 `contain-intrinsic-size` 校准。

- 改动量：CSS 两处选择器
- 预期收益：DOM commit 从"整树布局"降为"视口内布局"，3MB 的 4293ms 有望降一个量级
- 风险：未知的原始排除原因可能复现；`contain-intrinsic-size` 估算不准会导致滚动条跳动、滚动同步偏移
- 前提：需先复现并定位 `69d80ca7` 的排除动机

### 方案 B：分段 DOM 提交（chunked commit）

在离屏 `<template>` 里解析完整 HTML（解析不触发布局），按顶层子元素切成 N 段，首段同步插入，其余段用 `requestAnimationFrame` 逐帧 append，每帧预算约 8ms。

- 改动量：`PreviewPane.tsx` 渲染路径重写 + 新增分段调度模块 + 后处理改为增量
- 预期收益：首屏可见时间接近首段成本；总时长不减，但不再阻塞主线程，去抖不再被饿死
- 风险（较高）：
  - 搜索、滚动映射、后处理在"DOM 尚未完整"期间会看到不一致的树，全部需要感知提交进度
  - `previewScrollMap` 签名依赖 `write.childElementCount`，分段期间每帧变化会反复失效
  - 滚动条高度在提交过程中持续增长，用户滚动会被打断
  - 源码定位在目标段落尚未提交时会失败，需要排队重试（`4dd96f62` 已建过队列，需扩展）
- 需要新增：提交进度状态 + "预览渲染中"语义（现有 `renderPending` 可复用）

### 方案 C：只把首屏做同步，其余整块延后一帧

折中：切两段，第一段是覆盖视口的前若干块，第二段是剩余全部。第二段在首帧之后一次性 append。

- 改动量：介于 A 与 B 之间
- 预期收益：首帧显著提前；第二段仍有一次长任务（3MB 下仍是秒级）
- 风险：中等，只有一次不一致窗口，下游只需处理"两阶段"而非"N 阶段"

---

## 4. 建议顺序

1. **先做方案 A 的调查**：查清妙言排除原因，若可解决则实施并重跑基准。这一步可能直接关闭 issue #2，成本最低。
2. 若 A 无效或不可行，实施 **方案 C**，重跑基准。
3. 只有 C 仍不达标时才做 **方案 B**，且需要先把搜索/滚动/源码定位改造成可感知提交进度。

理由：A 和 C 都不改变"HTML 一次性生成"的架构，回退成本低；B 会让四个下游消费方都必须处理部分 DOM，是本方案里唯一的架构级改动。按 `CONTEXT.md` 的增量原则，不应从 B 起步。

---

## 5. 验收矩阵（CONTEXT.md 强制）

任一方案落地都必须逐项验证，缺一项不算完成：

| # | 项目 | 方法 | 通过标准 |
|---|---|---|---|
| V-1 | 打开耗时 | 重跑 `scripts/run-preview-webview-benchmark.mjs`（1MB/3MB，各 3 次取中位数） | 3MB DOM commit 显著下降，总时长下降 |
| V-2 | 主线程不阻塞 | 同基准的 `lastSessionDebounceOverrunMs` | 超时量 < 200ms |
| V-3 | 预览内搜索 | 1MB/3MB 文档搜索，含首屏外命中 | 命中数与改动前一致，可跳转 |
| V-4 | 复制 | 全选复制、局部选区复制 | 内容完整，格式不丢 |
| V-5 | 滚动同步 | 分栏模式双向滚动，含跳到文末 | 无偏移累积，无跳动 |
| V-6 | 源码定位 | 预览点击 → 编辑器定位，含文末段落 | 定位准确，不失败 |
| V-7 | Mermaid / KaTeX | 重图表 fixture | 全部渲染，无遗漏、无重复渲染 |
| V-8 | 导出一致性 | HTML/PDF 导出对比预览 | 与改动前一致（导出走独立管线，预期无变化，仍需实测） |
| V-9 | 单测 | `npm test` + `npx tsc --noEmit` + `npm run build` | 全绿 |

V-3/V-5/V-6 是方案 B 的主要风险点，必须在 3MB 文档上测，不能只测小文档。

---

## 6. 方案 A 实测结果（2026-07-27）

移除妙言主题对 `content-visibility` 的排除后，重跑基准：

| 指标 | 改动前（`:not(.preview-compat--miaoyan)`） | 改动后（启用） | 变化 |
|---|---:|---:|---|
| 1MB markdown→domCommit | 660ms | **2219ms** | **+336%** |
| 1MB domCommit→paint | 826ms | 2801ms | +239% |
| 3MB 状态 | 通过（4293ms） | **超时（90s）** | 失败 |

**结论：`content-visibility: auto` 在 WKWebView 中反而严重恶化性能。**

可能原因：
1. WKWebView 的 `content-visibility` 实现存在性能问题或 bug
2. `contain-intrinsic-size` 估算触发反复重排
3. 首次渲染时所有内容都在视口内，containment 的建立成本 > 跳过布局节省的成本
4. 大文档下 containment 边界计算本身成为瓶颈

方案 A 已证明不可行，转入方案 C。

---

## 7. 方案 C 实测结果（2026-07-27）

两段提交：首段（前 10 个顶层块）同步插入，余段延后一帧 append。

| 指标 | 改动前（单次提交） | 方案 C（两段提交） | 变化 |
|---|---:|---:|---|
| 3MB markdown→domCommit（首段） | 4293ms | **92ms** | **-98%** ✅ |
| 3MB domCommit→paint | 1555ms | **4725ms** | **+204%** ❌ |
| 3MB 总时长（lastSession） | 5024ms | 6073ms | +21% |
| 3MB 状态 | 通过 | 通过 | ✅ |
| 1MB 总时长 | 1004ms | 2523ms | +151% |

**关键发现：**
- 首段 commit 确实快（92ms），首屏立即可见
- 但第二段 append 时触发全树布局，耗时 4725ms（比原方案的 1555ms 还高 3 倍）
- 总时长反而增加，因为两次布局的累计成本 > 一次布局

**结论：分段提交没有解决根本问题。**

瓶颈不在"commit 调度"，而在**布局算法对大 DOM 树的超线性复杂度**。HTML 解析本身不贵（92ms 能处理 5.23MB），贵的是布局和样式计算。分两段只是把一个长任务拆成两个长任务，第二段仍然阻塞主线程 4+ 秒。

为什么第二段比原方案更慢？
- 首段插入后建立了初始布局树
- 第二段 append 时，浏览器需要重新计算整棵树的布局（因为新增节点可能影响全局，如 flexbox、文档流）
- 相比一次性插入，增量插入的布局失效 + 重排成本更高

---

## 8. 最终建议

三个方案都已实测：
- **方案 A（content-visibility）**：性能严重倒退（+336%），WKWebView 实现有问题
- **方案 C（两段提交）**：首屏提前但总时长增加（+21%），第二段仍阻塞 4+ 秒
- **方案 B（完整分段）**：预期与 C 类似，多段累计布局成本会更高

**建议路径：**

1. **接受大文档的布局成本**，优化体验而非消除延迟：
   - 保留 600ms 去抖，避免编辑时频繁重排
   - 3MB 文档显示明确的加载进度（已有 `renderPending` 状态）
   - 文档打开后，首次预览切换给予"正在渲染大文档"提示
   - 考虑在文档元数据中记录"已知大文档"，打开时预警

2. **减少 HTML 体积**（治本）：
   - 当前 3MB markdown → 5.23MB HTML（1.74× 膨胀）
   - 审计 `markdownToHtml.ts` 的冗余属性（`data-source-line` 在每个块上）
   - 大文档模式下关闭非必要特性（已有 `lightweightTables` 等降级开关）

3. **异步布局**（浏览器层面）：
   - 调研 Chrome/Safari 的 `content-visibility: auto` 在 Chromium-based WebView 中的表现
   - 如果 Electron/Chromium WebView 下有效，考虑切换 WebView 实现（大工程）

4. **虚拟化**（破坏性）：
   - 只渲染可见块 + 上下缓冲区
   - 会破坏搜索、复制、导出、滚动同步，成本极高
   - 不推荐，除非产品定位改为"超大文档编辑器"

**当前 issue #2 的处理建议：**
- 标记为 `wontfix` 或 `by-design`
- 文档说明：3MB 级文档的预览渲染需要 5~6 秒，这是浏览器布局引擎的固有成本
- 产品上建议用户拆分超大文档，或接受首次预览的等待时间
- 保留去抖和加载状态，确保体验可预期

**issue #4（搜索/滚动性能）** 仍需单独埋点测量，当前数据无法判定。

---

## 9. 未解决问题

- 后处理（KaTeX/媒体扫描）的实际耗时仍未测到：实测中唯一捕获的 `preview_post_process` 标记 `htmlLength` 为 0，属首次空渲染，已在汇总中过滤
- `markdownRenderMode` 在两个 fixture 下均为 `main` 而非 `worker`，未查因（仅占约 7%，低优先级）
- 3MB 读数不稳定（曾 3530ms、5024ms、6073ms、一次 90s 超时），需多次取中位数才能作为基线
- issue #4（搜索/滚动性能）仍无法判定：这两条路径尚未埋点，现有 `attributableMs` 不等于响应时间
- `content-visibility` 在 WKWebView 中的性能倒退原因未深入分析（低优先级，方案已放弃）
- 为什么方案 C 的第二段布局比原方案更慢（4725ms vs 1555ms）？可能是增量布局失效机制，但未用 Chrome DevTools Performance 深入分析
