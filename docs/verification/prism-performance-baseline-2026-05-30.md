# 性能基线实测（竞品差距补齐 Phase 4）

> 日期：2026-05-30
> 关联 goal：`docs/prism-competitor-gap-fix-goal.md`
> 关联报告：`docs/prism-vs-competitors-benchmark-2026-05-30.md` 第 3.1 节
> 采集环境：Apple M1 Max / 32 GB / macOS 26.5（25F71）/ Node v25.9.0；Prism release v1.4.1 aarch64

## 实测方法

- 安装包体：直接量 `src-tauri/target/release/bundle/dmg/Prism_1.4.1_aarch64.dmg` 字节数；挂载 dmg 量 `.app` 解压体积。
- 内存：启动 `.app` 主二进制，等待稳定态后采样主进程 + 同批启动的 WebKit XPC 子进程（GPU/Networking/WebContent）RSS。
- 渲染耗时：`vite-node` 调用 `markdownToHtml` 处理构造的大文档，预热后取多次中位数。

## 实测结果

### 包体（确定值）
| 项 | 数值 |
|---|---|
| DMG 安装包 | 24,196,330 字节 ≈ 23.1 MB |
| 解压 `.app` | ≈ 29 MB |
| 主二进制（app，含 Rust） | ≈ 27 MB |

结论：相对 Electron（通常 80–150 MB）有约一个量级优势，**属实**。

### 空载内存（单文档稳定态）
| 进程 | RSS |
|---|---|
| 主进程（app + Rust） | ≈ 126 MB（Prism 独占，确定） |
| WebKit.WebContent | ≈ 238 MB（系统共享，部分非独占） |
| WebKit.GPU | ≈ 81 MB |
| WebKit.Networking | ≈ 13 MB |
| 进程树合计 | ≈ 458 MB |

结论：内存优势**没有架构推断暗示的那么大**。WebKit 系统进程内存有共享成分，不应全算 Prism 独占，但即便只算确定独占的主进程（126 MB），加上渲染进程的实际增量，整体并非「远低于 Electron」。这是性能评分从 5 下调到 4 的主因之一。

### 大文档全量渲染（markdownToHtml 中位数）
| 文档规模 | 含 KaTeX | 不含公式 |
|---|---|---|
| 约 1 万行（9411 行 / 244KB） | 2128 ms | 751 ms |
| 约 5 千行（4707 行 / 121KB） | 992 ms | 288 ms |

归因：KaTeX 渲染占大头（含/不含差 1.6–2.8 倍）；markdown 解析本身在 1 万行也约 750 ms。

## 现有缓解（已在代码中）

`src/domains/editor/components/PreviewPane.tsx`：
- 自适应防抖 `getPreviewRenderDebounceMs`：<30KB → 120ms，30KB–300KB → 220ms，>300KB → 600ms。
- `useMemo` 缓存渲染结果（依赖 locale + renderContent）。
- `requestIdleCallback`（超时 300ms）延迟重渲染；大文档显示「更新中」状态。

因此日常输入手感远好于全量数字，但**大文档单次刷新仍有可感延迟**。

## 待后续立项（不在本 goal 展开）

真实的 React 端大文档瓶颈，建议后续单独优化，方向：
- [ ] 增量渲染：只重渲染变更的 Markdown 块，而非全量 `markdownToHtml`。
- [ ] KaTeX 懒渲染：视口内公式优先，视口外延迟。
- [ ] 解析层缓存：对未变更的大段落复用上次 AST/HTML。

## 复跑命令

```
# 包体
ls -la src-tauri/target/release/bundle/dmg/
# 渲染耗时（构造大文档并计时，见本轮一次性脚本，可按需重建）
npx vite-node <perf-script>.mjs
```
