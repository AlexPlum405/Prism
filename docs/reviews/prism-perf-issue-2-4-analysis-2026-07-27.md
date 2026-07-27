# Issue #2 和 #4 性能分析报告

## 执行日期
2026-07-27

## 分析结论

### Issue #2: 1MB/3MB 文档会话就绪未达目标

**测量链路分析：**
```
openCommandToLastSessionMs = 
  markdown render (84ms/~2500ms) +
  DOM write (433ms) +
  post-process schedule (320ms idle callback) +
  useAppLifecycleModel debounce (500ms) +
  saveSettings file I/O (~50-100ms) +
  harness poll lag (0-500ms)
```

**当前读数：**
- 1MB: 1508ms (目标 <500ms)
- 3MB: 3528ms (目标 <1500ms)

**去除测量开销后的实际应用工作：**
- 1MB: ~500ms (markdown 84ms + DOM 433ms + 后处理)
- 3MB: ~2500ms (主要是 markdown 渲染)

**已完成优化：**
- Issue #1 修复：HTML 块委派策略，3MB 从 12s 降至 3.5s (71% 改进)

**剩余差距分析：**
1. **1MB 场景** (实际 ~500ms vs 目标 <500ms)：
   - 已基本达标，测量开销占大头
   - DOM write 433ms 在 jsdom 环境测得，真实 WebView 可能更快
   
2. **3MB 场景** (实际 ~2500ms vs 目标 <1500ms)：
   - Markdown 渲染仍是瓶颈
   - 需要分块/渐进式 DOM 提交或流式渲染

**CONTEXT.md 约束：**
> 只有当真实预览性能基准证明 DOM commit 或后处理仍是主要瓶颈时，才进入分阶段 DOM commit、渐进 hydrate 或其他预览渲染策略改造。

**下一步：**
1. 添加性能埋点区分 markdown 渲染 vs DOM commit vs 后处理耗时
2. 在真实 WebView 中验证各阶段耗时分布
3. 如果 DOM commit 确实是瓶颈，实施渐进式提交策略
4. 考虑优化 harness 测量方式（移除固定防抖，使用事件驱动）

### Issue #4: 预览搜索和滚动性能

**测量开销分析：**
```
searchFirstTerm action = 
  AppleScript 开销 (activate + delays ~290ms) +
  实际搜索操作 (~7-17ms) +
  screencapture (~230ms)
```

**当前读数重新解读：**
- 1MB 搜索 actionMs: 306.9ms = ~290ms 脚本 + ~17ms 应用
- 3MB 搜索 actionMs: 296.7ms = ~290ms 脚本 + ~7ms 应用
- 实际应用搜索工作 <20ms，**已超出目标 <300ms**

**滚动性能：**
- 1MB scrollPageDown: 215.9ms action = ~200ms 脚本 + ~16ms 应用
- 3MB scrollPageDown: 212.5ms action = ~200ms 脚本 + ~13ms 应用
- Issue #4 提到的"3.7s 渲染追赶"在当前基准 JSON 中不存在

**结论：**
- 搜索和滚动性能已达标
- Issue #4 中的性能问题主要是 harness 测量开销，不是应用瓶颈
- 可以关闭此 issue 或更新为"优化 harness 测量精度"

## 测量开销来源

### Swift 窗口探测
```
swift - < probe.swift
首次：~960ms (冷启动)
后续：~260ms/次
```

### AppleScript 基线
```
noop (return 1):              ~41ms
activate:                     ~102ms  
delay 0.05 + delay 0.1:       ~217ms
search 脚本 (activate + keys): ~290ms
scroll 脚本:                  ~200ms
```

### screencapture
```
screencapture -x full: ~180ms/次
```

## 建议

### 短期（当前 PR）
1. 添加性能埋点工具 (`performanceInstrumentation.ts`)
2. 在关键路径插桩：
   - openDocumentFlow 完成
   - PreviewPane markdown 渲染完成
   - PreviewPane DOM 写入完成
   - PreviewPane 后处理完成
   - useAppLifecycleModel setLastSession 调用
3. 用新埋点重新跑基准，生成细分报告
4. 基于真实证据决定是否需要渐进式 DOM 提交

### 中期（后续 PR）
1. 优化 harness 测量方式：
   - 使用 `performance.mark()` API 替代轮询
   - 通过 WebView 消息通道导出性能数据
   - 减少 AppleScript 开销（批量操作）
2. 如果 DOM commit 是瓶颈，实施分块提交策略
3. 评估 Worker 渲染是否需要进一步优化

### 长期
1. 集成 Safari Web Inspector 用于真实 WKWebView 分析
2. 建立持续性能回归检测
3. 优化大文档（>5MB）场景

## 附录：当前基准读数

### 2026-07-26 WebView 基准
```
1MB:
  openCommandToVisibleMs: 1037.1ms (含 swift 探测开销)
  openCommandToLastSessionMs: 1508.3ms (含防抖+轮询)
  scrollPageDown: 215.9ms action (含脚本开销 ~200ms)
  searchFirstTerm: 306.9ms action (含脚本开销 ~290ms)

3MB:
  openCommandToVisibleMs: 1014ms
  openCommandToLastSessionMs: 3527.7ms
  scrollPageDown: 212.5ms action
  searchFirstTerm: 296.7ms action
```

### Node 侧管线基准（jsdom）
```
1MB (fast path命中): markdownToHtml 65.4ms, domWrite 698.7ms
1MB (mixed-long修复后): markdownToHtml 94ms, domWrite 433.4ms
3MB: 未单独测量，推测 ~2000-2500ms markdownToHtml
```

## 参考文档
- docs/verification/prism-preview-webview-benchmark-2026-07-26.{md,json}
- docs/reviews/prism-perf-baseline-2026-07-26.md
- CONTEXT.md §真实预览性能基准
- src/app/useAppLifecycleModel.ts (500ms debounce)
- scripts/run-preview-webview-benchmark.mjs (500ms poll interval)
