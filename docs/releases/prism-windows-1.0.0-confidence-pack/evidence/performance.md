# 性能 Smoke

## 大工作区

测试目录：

```text
C:\Users\alex\Documents\PrismWindowsSmoke\LargeWorkspaceSmoke
```

规模：80 个 Markdown 文件，`note-001.md` 到 `note-080.md`。

## 打开速度

命令：`Start-Process app.exe <note-001.md>`

结果：Prism 主窗口约 1163 ms 出现。

## 文件树与编辑

已验证：

- 文件树能显示 `note-001.md` 起的一组文件。
- 文件树滚动后能看到 `note-009.md` 到 `note-025.md`。
- 编辑区可输入并保存 `performance edit smoke`。
- `note-001.md` 落盘后包含该 smoke 文本。

结论：80 文件工作区 smoke 通过，未观察到长期卡死。

## 长文预览

临时长文：

```text
C:\Users\alex\Documents\PrismWindowsSmoke\long-preview-export-smoke.md
```

规模：

```text
186126 字符 / 5034 行
```

结果：

- Prism 可打开该长文。
- 点击顶部 `预览` 后进入预览视图。
- 截图：`screenshots/16-long-preview.png`，Prism 窗口级截图，尺寸 1102x792。

## 长文诊断基准

命令：

```text
$env:PRISM_DIAGNOSTICS_BENCH='1'
$env:PRISM_DIAGNOSTICS_BENCH_FILE="$env:USERPROFILE\Documents\PrismWindowsSmoke\long-preview-export-smoke.md"
npm test -- --run src/app/documentDiagnostics.performance.test.ts --reporter verbose
```

结果：通过。

摘要：

```text
contentLength 186126
lineCount     5034
headingMs     2.2
linkMs        3.2
tableMs       1.8
typographyMs  5.1
```

## 导出反馈

命令：

```text
npm test -- --run src/hooks/useExportTaskUi.test.tsx src/app/documentDiagnostics.performance.test.ts
```

结果：

```text
Test Files  1 passed | 1 skipped (2)
Tests       3 passed | 1 skipped (4)
```

`useExportTaskUi.test.tsx` 覆盖：

- 前台导出进度事件。
- 导出进度移入状态栏后台展示。
- 完成、取消和失败反馈不会卡住。

## 工作区索引取消 / 降级

命令：

```text
npm test -- --run src/domains/workspace/hooks/useWorkspaceIndexModel.test.tsx src/components/shell/CommandPalette.test.tsx
```

结果：

```text
Test Files  2 passed (2)
Tests       13 passed (13)
```

覆盖项：

- workspace root 变化时取消上一个 running native index job。
- 大工作区优先使用 native index job。
- native job 不可用且超过 500 文件时降级为 lightweight metadata index，不读取所有文件内容。
- 命令面板能展示 indexing / no index / native ready 等状态。

额外复核：

```text
cargo test -q workspace_index_job --manifest-path src-tauri\Cargo.toml
```

结果：失败，`6` 项中 `5 passed / 1 failed`。失败项是 `queries_backlinks_and_relation_graph_from_completed_job`，在 backlinks 为空数组时越界。取消相关 Rust 测试通过，但该失败作为额外索引风险写入 `issues.md`。

结论：长文预览可用，导出反馈状态机有自动化测试覆盖；索引取消 / 降级有前端模型测试覆盖，另有 Rust workspace index job 查询测试风险。
