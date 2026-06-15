# Prism 全局性能自检优化记录

> 日期：2026-06-15
> 目标：围绕全局功能进行 5 轮性能卡顿风险自检，每轮按“自检 -> 修复 -> 回归测试 -> 数据验证”闭环。

## 第 1 轮：文档诊断首屏同步扫描

风险：

- `useDocumentDiagnosticsModel` 在打开/编辑文档时同步计算中文排版建议。
- 中文排版建议不计入状态栏 `ERROR n`，不是首屏错误诊断必需项。

优化前基准：

```bash
PRISM_DIAGNOSTICS_BENCH=1 PRISM_DIAGNOSTICS_BENCH_FILE=/Users/Alex/.qoderworkcn/workspace/mpz8o63iwqg7cqnc/phase19/annotation/CHAR_REVIEW.md npm test -- --run src/app/documentDiagnostics.performance.test.ts --reporter verbose
```

| 指标 | 优化前 |
|---|---:|
| heading scan | 2.9 ms |
| link scan | 8.6 ms |
| table scan | 12.0 ms |
| typography scan | 35.7 ms |
| 默认首屏同步诊断合计 | 59.2 ms |

修复：

- `typographyDiagnostics` 改为惰性状态。
- 初始渲染不再扫描中文排版建议。
- 用户请求排版建议面板后才执行 `scanChineseTypography`。

优化后验证：

```bash
npm test -- --run src/app/useDocumentDiagnosticsModel.test.tsx src/app/documentDiagnostics.performance.test.ts
PRISM_DIAGNOSTICS_BENCH=1 PRISM_DIAGNOSTICS_BENCH_FILE=/Users/Alex/.qoderworkcn/workspace/mpz8o63iwqg7cqnc/phase19/annotation/CHAR_REVIEW.md npm test -- --run src/app/documentDiagnostics.performance.test.ts --reporter verbose
```

| 指标 | 优化后 |
|---|---:|
| heading scan | 2.1 ms |
| link scan | 7.2 ms |
| table scan | 11.1 ms |
| typography scan | 惰性触发，不在首屏执行 |
| 默认首屏同步诊断合计 | 20.4 ms |

结果：默认首屏同步诊断约 `59.2ms -> 20.4ms`。

## 第 2 轮：链接诊断 workspace 文件匹配

风险：

- `scanMarkdownLinks` 在每条链接校验时重复把 `workspaceFiles` 归一化为 `Set`。
- 在大量链接和大型工作区下形成 `链接数 * 文件数` 成本。

优化前基准：

```bash
PRISM_LINK_DIAGNOSTICS_BENCH=1 npm test -- --run src/domains/editor/extensions/linkDiagnostics.performance.test.ts --reporter verbose
```

| 场景 | 优化前 |
|---|---:|
| 1200 links / 4000 workspace files | 1508.5 ms |

修复：

- 每次链接扫描只预构建一次 normalized workspace file `Set`。
- 每条链接只做候选路径查找，不再重建文件集合。

优化后验证：

```bash
npm test -- --run src/domains/editor/extensions/linkDiagnostics.test.ts src/domains/editor/extensions/linkDiagnostics.performance.test.ts
PRISM_LINK_DIAGNOSTICS_BENCH=1 npm test -- --run src/domains/editor/extensions/linkDiagnostics.performance.test.ts --reporter verbose
```

| 场景 | 优化后 |
|---|---:|
| 1200 links / 4000 workspace files | 5.2 ms |

结果：链接诊断约 `1508.5ms -> 5.2ms`。

## 第 3 轮：工作区索引 backlink 摘录

风险：

- 工作区索引生成 backlink 摘录时，每条 link 都对同一源文档执行 `content.split(/\r?\n/)`。
- 单文档大量链接时反复切分全文。

优化前基准：

```bash
PRISM_WORKSPACE_INDEX_BENCH=1 npm test -- --run src/domains/workspace/services/workspaceIndex.performance.test.ts --reporter verbose
```

| 场景 | 优化前 |
|---|---:|
| 1501 docs / 1500 links | 396.4 ms |

修复：

- 处理某个源文档 backlinks 前只拆分一次行数组。
- 每条 backlink 复用该行数组生成 excerpt。

优化后验证：

```bash
npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/services/workspaceIndex.performance.test.ts
PRISM_WORKSPACE_INDEX_BENCH=1 npm test -- --run src/domains/workspace/services/workspaceIndex.performance.test.ts --reporter verbose
```

| 场景 | 优化后 |
|---|---:|
| 1501 docs / 1500 links | 293.8 ms |

结果：工作区索引构建约 `396.4ms -> 293.8ms`。

## 第 4 轮：工作区链接解析

风险：

- `resolveDocumentLinkTarget` 为每条 Markdown/Wiki link 遍历 `workspaceFiles`。
- wiki alias 也在每次解析时对每个文件重复生成。

优化前基准：

第 3 轮修复后，保留相同 workspace index 基准作为第 4 轮 baseline：

| 场景 | 优化前 |
|---|---:|
| 1501 docs / 1500 links | 293.8 ms |

修复：

- 为同一个 `workspaceFiles` 数组构建 WeakMap 缓存。
- 缓存 normalized path lookup 和 wiki alias lookup。
- Markdown/Wiki link 解析改为 map lookup。

优化后验证：

```bash
npm test -- --run src/domains/workspace/services/documentLinks.test.ts src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/services/workspaceIndex.performance.test.ts
PRISM_WORKSPACE_INDEX_BENCH=1 npm test -- --run src/domains/workspace/services/workspaceIndex.performance.test.ts --reporter verbose
```

| 场景 | 优化后 |
|---|---:|
| 1501 docs / 1500 links | 17.9 ms |

结果：工作区索引构建约 `293.8ms -> 17.9ms`。

## 第 5 轮：工作区全文搜索重复 lower-case

风险：

- `searchWorkspaceIndex` / `rankWorkspaceIndexDocuments` 每次查询都会重复 lower-case 文档 title/name/path/content/headings。
- 快速打开或全文搜索连续输入时，该成本按按键重复。

优化前基准：

```bash
PRISM_WORKSPACE_INDEX_BENCH=1 npm test -- --run src/domains/workspace/services/workspaceIndex.performance.test.ts --reporter verbose
```

| 场景 | 优化前 |
|---|---:|
| 600 docs / 5 repeated queries | 12.5 ms |

修复：

- 使用 WeakMap 为 `WorkspaceIndexedDocument` 缓存 lower-case 搜索字段。
- 内容 snippet 复用 cached lower-case content。

优化后验证：

```bash
npm test -- --run src/domains/workspace/services/workspaceIndex.test.ts src/domains/workspace/services/workspaceIndex.performance.test.ts
PRISM_WORKSPACE_INDEX_BENCH=1 npm test -- --run src/domains/workspace/services/workspaceIndex.performance.test.ts --reporter verbose
```

| 场景 | 优化后 |
|---|---:|
| 600 docs / 5 repeated queries | 4.1 ms |

结果：重复搜索约 `12.5ms -> 4.1ms`。

## 最终回归命令

```bash
npm test -- --run
npm run build
git diff --check
```

## 追加优化：连续编辑时链接诊断复用工作区文件集合

追加自检风险：

- 第 2 轮已把 `scanMarkdownLinks` 从“每条链接重建文件集合”优化为“每次扫描只建一次集合”。
- 但 `useDocumentDiagnosticsModel` 在文档内容每次变化时仍会重新 `flattenFiles(fileTree)`，并让链接诊断为同一个工作区重复归一化文件路径。
- 大工作区连续输入时，这部分成本会和每次编辑同步诊断叠加。

修复：

- `useDocumentDiagnosticsModel` 将工作区文件路径提升为 `useMemo`，只在 `fileTree/rootPath` 变化时重新拍平。
- `linkDiagnostics` 增加 `createMarkdownLinkWorkspaceFileSet`，允许调用方复用预归一化文件集合。
- 文档内容变化时仍重新扫描当前 Markdown 链接，但不再为同一个工作区重复准备文件集合。

验证：

```bash
PRISM_LINK_DIAGNOSTICS_BENCH=1 npm test -- --run src/domains/editor/extensions/linkDiagnostics.test.ts src/domains/editor/extensions/linkDiagnostics.performance.test.ts --reporter verbose
npm test -- --run src/app/useDocumentDiagnosticsModel.test.tsx src/app/documentDiagnostics.performance.test.ts
```

| 场景 | 优化前 | 优化后 |
|---|---:|---:|
| 30 次连续编辑 / 8000 workspace files | 103.1 ms | 0.4 ms |
| 1200 links / 4000 workspace files 单次扫描 | 6.3-7.7 ms | 7.7 ms |

结果：连续编辑路径显著减少重复工作；单次大量链接扫描仍保持毫秒级，没有出现数量级回退。
