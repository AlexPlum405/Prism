# Prism 完整预览性能优化记录

> 日期：2026-06-12
> 目标：约 1MB Markdown 文档完整预览最快，不改成首屏虚拟化或懒加载预览。

## 基准命令

显式开启 1MB 混合 Markdown 完整预览基准：

```bash
PRISM_PREVIEW_BENCH=1 npm test -- --run src/domains/editor/components/PreviewPane.performance.test.tsx
```

该基准构造约 1MB Markdown，覆盖标题、长段落、表格、代码块、Callout、wiki link、KaTeX、Mermaid placeholder 和本地图片引用。记录：

- `markdownToHtmlMs`：Markdown 到 HTML 的完整转换耗时。
- `domWriteMs`：`#write.innerHTML` 写入耗时。
- `domTargetScanMs`：当前 DOM 后处理目标扫描耗时。
- `mediaTargetCount` / `katexErrorCount` / `mermaidPlaceholderCount`：图片、KaTeX 错误、Mermaid placeholder 数量。

## 2026-06-12 基线

命令：

```bash
PRISM_PREVIEW_BENCH=1 npm test -- --run src/domains/editor/components/PreviewPane.performance.test.tsx --reporter verbose
```

环境：本机 Vitest/jsdom，Node 运行时；该数字用于 repo 内同机同命令前后对比，不代表真实 Tauri WebView 绝对耗时。

| 指标 | 中位数 / 数量 |
|---|---:|
| Markdown 内容长度 | 1,048,751 |
| HTML 长度 | 11,323,428 |
| `markdownToHtmlMs` | 5,026.4 ms |
| `domWriteMs` | 3,531.7 ms |
| `domTargetScanMs` | 739.7 ms |
| 图片目标 | 359 |
| KaTeX 错误目标 | 0 |
| Mermaid placeholder | 431 |

单次样本：

| 样本 | `markdownToHtmlMs` | `domWriteMs` | `domTargetScanMs` |
|---:|---:|---:|---:|
| 0 | 5,076.0 ms | 3,176.0 ms | 739.7 ms |
| 1 | 4,956.0 ms | 3,531.7 ms | 712.7 ms |
| 2 | 5,026.4 ms | 3,650.7 ms | 947.6 ms |

## DOM 后处理目标扫描优化

变更：

- 新增 `previewDomTargets` 纯 DOM 收集器。
- PreviewPane 先根据 HTML 字符串判断是否存在本地图片、KaTeX 错误、Mermaid placeholder。
- 无目标时跳过 DOM 扫描；有目标时用一次 `querySelectorAll` 同时收集图片、KaTeX 错误和 Mermaid placeholder。
- Mermaid effect 复用 postprocess effect 已收集的 placeholder 列表，避免同一轮 HTML 再扫一次。

验证：

```bash
npm test -- --run src/domains/editor/components/previewDomTargets.test.ts src/domains/editor/components/PreviewPane.test.tsx
PRISM_PREVIEW_BENCH=1 npm test -- --run src/domains/editor/components/PreviewPane.performance.test.tsx --reporter verbose
```

结果：

| 指标 | 优化前 | 优化后 | 变化 |
|---|---:|---:|---:|
| `markdownToHtmlMs` | 5,026.4 ms | 5,008.9 ms | 基本持平 |
| `domWriteMs` | 3,531.7 ms | 3,702.3 ms | jsdom 波动 |
| `domTargetScanMs` | 739.7 ms | 577.7 ms | -162.0 ms（约 -22%） |

优化后单次样本：

| 样本 | `markdownToHtmlMs` | `domWriteMs` | `domTargetScanMs` |
|---:|---:|---:|---:|
| 0 | 4,869.7 ms | 3,274.0 ms | 549.6 ms |
| 1 | 5,083.4 ms | 3,908.3 ms | 577.7 ms |
| 2 | 5,008.9 ms | 3,702.3 ms | 663.5 ms |

## Worker 渲染 backpressure

变更：

- `markdownRenderService` 在 Worker 已有请求执行时，不继续把每个中间版本都 `postMessage` 到 Worker。
- Worker 繁忙期间只保留最后一次排队请求；新的请求到来时，被替换的旧排队请求立即以 `stale=true` 完成。
- 正在执行的请求仍允许自然结束；结束后只发送最新排队请求，保证最终仍是完整预览。
- 排队请求保留发起时的 locale，避免等待 Worker 空闲期间语言设置变化导致文案不一致。

验证：

```bash
npm test -- --run src/lib/markdownRenderService.test.ts
npm test -- --run src/domains/editor/components/PreviewPane.test.tsx src/domains/editor/components/previewDomTargets.test.ts
```

结果：

| 场景 | 优化前 | 优化后 |
|---|---:|---:|
| Worker 繁忙时连续请求 `# 第一次` / `# 第二次` / `# 第三次` | 3 次 Worker `postMessage` | 2 次 Worker `postMessage` |
| 中间请求处理方式 | 等 Worker 计算后回 stale | 立即返回 `stale=true` |
| 最新请求 | 完整渲染 | 完整渲染 |

这项优化不改变单次完整渲染耗时；收益来自连续输入、快速切换视图或快速切换文档时减少 Worker 队列里的重复重活。

## CHAR_REVIEW.md 超大字模校对表优化

触发文件：

```bash
/Users/Alex/.qoderworkcn/workspace/mpz8o63iwqg7cqnc/phase19/annotation/CHAR_REVIEW.md
```

结构特征：

- 文件约 926KB / 33,667 行。
- 10 个 `Font Selector` 分区。
- 2,098 行字符表数据。
- 2,098 个跨 16 行的 `<pre>` 字模块嵌在 Markdown 表格单元格中。

复跑命令：

```bash
PRISM_PREVIEW_BENCH=1 PRISM_PREVIEW_BENCH_FILE=/Users/Alex/.qoderworkcn/workspace/mpz8o63iwqg7cqnc/phase19/annotation/CHAR_REVIEW.md npm test -- --run src/domains/editor/components/PreviewPane.performance.test.tsx --reporter verbose
```

定位：

- 打开慢：主要来自浏览器构建/布局超长 Markdown 表格，jsdom 基线中 `domWriteMs` 中位数约 31,981 ms。
- 滚动和菜单卡：preview-only 模式滚动时仍执行源码同步扫描，每次会扫约 4,389 个 source-line 节点，jsdom 基线中 `scrollSyncScanMs` 中位数约 2,304.6 ms；同时水平滚动条每 300ms 主动读取 `scrollWidth/clientWidth`，会在大 DOM 上反复触发布局测量。

变更：

- 对超过阈值的跨行 `<pre>` Markdown 表格，在预览阶段转成完整的轻量 block-grid HTML，保留全部行和字模内容，不做首屏虚拟化。
- preview-only 滚动只记录 `previewRatio`，不再同步到隐藏编辑器，因此不再执行源码行号扫描。
- 水平滚动条测量改为 `requestAnimationFrame` 合并，并移除 300ms 常驻轮询。

结果：

| 指标 | 优化前 | 优化后 | 变化 |
|---|---:|---:|---:|
| `markdownToHtmlMs` | 2,504.6 ms | 1,993.2 ms | -511.4 ms |
| `domWriteMs` | 31,981.0 ms | 2,677.8 ms | -29,303.2 ms（约 -91.6%） |
| `domTargetScanMs` | 0.5 ms | 1.5 ms | 仍可忽略 |
| `scrollSyncScanMs` | 2,304.6 ms | preview-only 实际跳过 | 滚动热路径移除 |

优化后单次样本：

| 样本 | `markdownToHtmlMs` | `domWriteMs` | `scrollSyncScanMs` |
|---:|---:|---:|---:|
| 0 | 1,967.7 ms | 2,605.1 ms | 245.7 ms |
| 1 | 1,993.2 ms | 2,677.8 ms | 229.3 ms |
| 2 | 2,028.4 ms | 2,691.1 ms | 235.3 ms |

注：`scrollSyncScanMs` 是测试保留的源码行映射扫描成本，用于 split 模式和诊断参考；preview-only 滚动路径已不调用该扫描。
