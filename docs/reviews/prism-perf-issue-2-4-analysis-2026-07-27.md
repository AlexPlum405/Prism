# Issue #2 和 #4 性能分析报告

## 执行日期
2026-07-27

## 分析结论

### Issue #2: 1MB/3MB 文档会话就绪未达目标

**测量链路：**
```
openCommandToLastSessionMs =
  文件读取 + markdown 渲染 + DOM 写入 + 后处理调度 +
  useAppLifecycleModel 防抖 (500ms，useAppLifecycleModel.ts:100) +
  saveSettings 文件写入 +
  harness 轮询滞后 (0-500ms，run-preview-webview-benchmark.mjs:265)
```

**当前读数：**
- 1MB: 1004ms (目标 <500ms)
- 3MB: 5024ms (目标 <1500ms)

**已实施的测量改造：**
1. `src/lib/performanceInstrumentation.ts`：应用内分阶段埋点，
   由 config.json 的 `perfInstrumentation` 开关启用，输出 `appData/perf-trace.json`
2. 插桩点：`document_read_start/done`、`document_store_updated`、`workspace_sync_done`、
   `preview_markdown_render`、`preview_dom_committed`、`preview_painted`、
   `preview_post_process`、`last_session_debounce_scheduled/write_start`
3. `waitFor` 同时报出 `elapsedMs` 与 `detectedAtEarliestMs`，把 swift 探测成本显式化
4. `measureAction` 增加同形状 baseline 脚本，量出 osascript 固定成本

**真实 WKWebView 分阶段实测（2026-07-27，打包应用）：**

| 阶段 | 1MB | 3MB | 随体积增长 |
|---|---:|---:|---|
| 文档读取 | 9ms | 18ms | 否（可忽略） |
| markdown → HTML | 189ms | 365ms | 近线性 |
| markdown 完成 → DOM commit | **660ms** | **4293ms** | **超线性（6.5×）** |
| DOM commit → 首帧绘制 | 826ms | 1555ms | 近线性 |
| 后处理 | 未捕获到非空运行 | 同 | — |

HTML 体积：1MB 源文档 → 1.74MB HTML；3MB 源文档 → 5.23MB HTML。
两者 `markdownRenderMode` 均为 `main`（主线程，未走 worker）。

**结论：DOM commit 是瓶颈，且已被实测证实。**
- 3MB 场景 4293ms 的 DOM commit 占 5024ms 总时长的 85%
- markdown 渲染仅 365ms（7%），此前"markdown 渲染是瓶颈"的推断是错的
- 源文档体积 3× 时 DOM commit 增长 6.5×，呈超线性——说明成本主要来自
  单次提交 5.23MB HTML 引发的布局，而非解析

**关于此前假设的 ~750ms 固定开销：修正。**
实测 `lastSessionDebounceMs`（防抖排定 → 写入开始）为 1MB 821ms、3MB 4598ms，
而代码常量是 500ms。超出部分（1MB 321ms、3MB 4098ms）是定时器被主线程阻塞饿死
——`setTimeout` 到期后无法执行，因为主线程正在做 DOM commit。
**这不是测量开销，而是主线程阻塞的直接证据**：同一时间窗口内应用无法响应任何输入。
此前把 750ms 整体记作"harness 固定开销"低估了应用侧问题。

**CONTEXT.md 约束已满足：**
> 只有当真实预览性能基准证明 DOM commit 或后处理仍是主要瓶颈时，才进入分阶段 DOM commit、渐进 hydrate 或其他预览渲染策略改造。

上表即该证明。分阶段 DOM commit / 渐进 hydrate 现在有据可依，但属于独立改动，
本次未实施——本次交付的是测量能力与结论。

**已完成优化：**
- Issue #1 修复：HTML 块委派策略，3MB 从 12s 降至 3.5s (71% 改进)

**测量方法的局限：**
- `preview_painted` 是 DOM commit 后两个 `requestAnimationFrame`，近似首帧，
  不等于合成完成；真实绘制可能更晚
- 未捕获到 `htmlLength > 0` 的后处理运行。仅观察到 html='' 的空渲染那次（约 0-1ms）。
  因此**无法排除后处理也有成本**，只能说它未出现在已采集的窗口内
- 3MB 读数在两次运行间波动较大（3530ms / 5024ms，且有一次 90s 超时），
  单次读数不宜作为回归基线

### Issue #4: 预览搜索和滚动性能

**测量开销分析：**
```
searchFirstTerm action = 
  AppleScript 开销 (activate + delays ~290ms) +
  实际搜索操作 (~7-17ms) +
  screencapture (~230ms)
```

**当前读数重新解读：**

`actionMs` 只包住 `runAppleScript()`，即 `osascript` 进程的完整生命周期，
**其中包含脚本自带的固定 `delay`**：
- 搜索脚本：`activate` + `delay 0.05` + `delay 0.1` = 150ms 硬编码等待
- 滚动脚本：`activate` + `delay 0.05` = 50ms 硬编码等待

**改造：** `measureAction` 现在对每个动作跑同形状但不含按键的 baseline 脚本
（同一目标应用、同样的 `activate` 与 `delay`，取 3 次中位数），得到本机固定成本，
并报出 `attributableMs = actionMs - baselineMs`。这比此前用 Finder 做 `activate`
的量级参考准确——`activate` 成本随目标应用而异。

**实测（2026-07-27）：**
```
1MB  scrollPageDown:  actionMs 427.7  baseline 170.2  attributable 257.5
1MB  searchFirstTerm: actionMs 306.6  baseline 276.7  attributable  29.9
3MB  scrollPageDown:  actionMs 198.7  baseline 162.2  attributable  36.5
3MB  searchFirstTerm: actionMs 302.9  baseline 279.2  attributable  23.7
```

搜索的 `attributable` 约 24-30ms，且 1MB 与 3MB 基本一致，不随体积增长。
滚动的 1MB 读数 257.5ms 明显高于 3MB 的 36.5ms——顺序上 1MB 是首个动作，
更可能是首次 `activate`/窗口聚焦的一次性成本，而非文档体积效应。

**结论（修正）：**
- `attributableMs` 仍不是"应用响应时间"：`osascript` 在按键送达后即返回，
  不等待应用完成搜索或滚动渲染。它只是把 harness 固定成本剥掉后的上界更紧的估计
- 因此**仍不能判定"搜索 <300ms"是否达标**；要回答这个问题需要应用内埋点
  覆盖搜索与滚动路径（本次只插桩了文档打开链路）
- issue #4 所述"3MB 滚动后截图 3727ms"在当前 JSON 中不存在：实测 `screenshotMs`
  为 200-233ms。该读数已失效，需重新采集或关闭该子项

## 测量开销来源

### Swift 窗口探测
```
swift - < probe.swift
首次：~960ms (冷启动)
后续：~260-340ms/次
```
`waitFor` 现在同时报出 `openCommandToVisibleMs`（含检测到它的那次探测成本）与
`openCommandToVisibleEarliestMs`（该次探测开始时刻，即下界）。实测 1MB
947.7ms / 608ms、3MB 953ms / 631.8ms——**真实可见时间落在这两者之间**，
单报前者会把约 320-340ms 探测成本算进指标。

### AppleScript 基线
现由 `measureAction` 每次运行时实测（同形状脚本、同一目标应用 Prism、3 次取中位数），
不再依赖 Finder 做量级外推：
```
滚动脚本 baseline (activate + delay 0.05):            162-170ms
搜索脚本 baseline (activate + delay 0.05 + delay 0.1): 277-279ms
```
早前用 Finder 测得的参考值（noop 41-63ms、activate 98-145ms）已不再作为依据。

### screencapture
```
screencapture -x full: 200-233ms/次（实测）
```

## 建议

### 本次已完成
1. `performanceInstrumentation.ts` 埋点工具 + 单元测试
2. 文档打开链路插桩（读取 / store / workspace sync / markdown / DOM commit / 绘制 / 后处理 / 防抖）
3. harness 三处口径修正：探测成本区间、动作 baseline、超时时也保留 trace
4. 用打包应用采集真实读数，证实 DOM commit 是瓶颈

### 下一步（后续 PR，本次未做）
1. **分阶段 DOM commit / 渐进 hydrate**——现已有证据支持：
   3MB 场景 DOM commit 占 85%，且随体积超线性增长
2. markdown 渲染走 worker：实测两个 fixture 的 `mode` 均为 `main`，
   worker 路径未命中，需查明原因（但它只占 7%，收益有限）
3. 搜索与滚动路径插桩——issue #4 目前仍无法判定达标与否
4. 3MB 读数波动大（3530/5024ms、一次超时），回归基线需多次取中位数

### 长期
1. 集成 Safari Web Inspector 用于真实 WKWebView 分析
2. 建立持续性能回归检测
3. 优化大文档（>5MB）场景

## 附录：当前基准读数

### 2026-07-27 WebView 基准（打包应用，含应用内埋点）
```
1MB:
  openCommandToVisibleMs:     947.7ms  (下界 608ms，差值为 swift 探测成本)
  openCommandToLastSessionMs: 1003.9ms
    ├ 文档读取                    9ms
    ├ markdown → HTML           189ms  (mode=main, HTML 1.74MB)
    ├ DOM commit                660ms  ← 瓶颈
    ├ commit → 首帧              826ms
    └ 防抖超出常量               321ms  (主线程阻塞证据，常量为 500ms)
  scrollPageDown:  actionMs 427.7ms / baseline 170.2 / attributable 257.5
  searchFirstTerm: actionMs 306.6ms / baseline 276.7 / attributable  29.9

3MB:
  openCommandToVisibleMs:     953ms    (下界 631.8ms)
  openCommandToLastSessionMs: 5023.9ms
    ├ 文档读取                   18ms
    ├ markdown → HTML           365ms  (mode=main, HTML 5.23MB)
    ├ DOM commit               4293ms  ← 瓶颈，占总时长 85%
    ├ commit → 首帧             1555ms
    └ 防抖超出常量              4098ms  (主线程阻塞证据)
  scrollPageDown:  actionMs 198.7ms / baseline 162.2 / attributable 36.5
  searchFirstTerm: actionMs 302.9ms / baseline 279.2 / attributable 23.7
```
注：同一 fixture 跨运行波动明显（3MB 曾测得 3530ms，也曾 90s 超时）。
上表为单次运行，不宜直接当回归门槛。

### Node 侧管线基准（jsdom，不可外推到 WKWebView）
```
1MB (fast path命中):     markdownToHtml 65.4ms, domWrite 698.7ms
1MB (mixed-long修复后):  markdownToHtml 94ms,   domWrite 433.4ms
3MB:                     未测量
```
jsdom 不做布局、样式解析与合成，`domWrite` 只反映 DOM 树构建成本。
真实 WKWebView 的 DOM commit 还包含布局与绘制，量级关系未知——
这正是需要应用内埋点的原因。

## 参考文档
- docs/verification/prism-preview-webview-benchmark-2026-07-26.{md,json}
- docs/reviews/prism-perf-baseline-2026-07-26.md
- CONTEXT.md §真实预览性能基准
- src/app/useAppLifecycleModel.ts (500ms debounce)
- scripts/run-preview-webview-benchmark.mjs (500ms poll interval)
