# Prism 问题修复回归报告（2026-06-23）

## 总体结论

自动检查通过：baseline 证据目录完整，目标 App bundle 身份正确，当前源码包含本轮计划要求的修复点。

本报告只记录代码修复后的自动化证据和后续截图口径，不覆盖 `manifest.json`、`test-report.md`、`issues.md` 或旧截图。真实 UI 修复后截图需要在新构建替换 `/Applications/Prism.app` 后执行回填。

## App 与 Baseline

| 项目 | 结果 |
| --- | --- |
| App 路径 | /Applications/Prism.app |
| Bundle ID | com.prism.editor.v1 |
| Bundle Name | Prism |
| Baseline cases | 113 |
| Baseline issues | ISSUE-001, ISSUE-002, ISSUE-003, ISSUE-004, ISSUE-005, ISSUE-006, ISSUE-007, ISSUE-008, ISSUE-009, ISSUE-010, ISSUE-011, ISSUE-012 |

## 源码修复点自动检查

| 检查项 | 文件 | 状态 |
| --- | --- | --- |
| ContextMenu Escape closes overlays | src/components/shell/ContextMenu.tsx | Pass |
| Selection context menu keeps link action | src/domains/editor/extensions/contextMenu.ts | Pass |
| Selection background right-click keeps current selection | src/domains/editor/components/useEditorRuntimeModel.ts | Pass |
| Table menu exposes TSV copy | src/domains/editor/extensions/contextMenu.ts | Pass |
| Preview replace switches to split before opening replace panel | src/domains/editor/components/SplitView.tsx | Pass |
| Export success result emits actionable toast | src/hooks/useExportTaskUi.ts | Pass |
| Update available state uses an actionable final toast | src/domains/commands/registry.ts | Pass |

## 修复项回归清单

| ID | Issue | 基线用例 | 状态 | 修复后截图目标 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| REG-ISSUE-001 | ISSUE-001 | TC-P0-010 | ReadyForTestRun | screenshots/01-selection-context-menu-fixed.png | 选中标题、段落或代码文字后右键，复制与链接均启用，并能作用于原选区。 |
| REG-ISSUE-002 | ISSUE-002 | TC-P0-062 | ReadyForTestRun | screenshots/02-table-copy-tsv-fixed.png | 表格右键菜单同时包含 Markdown、HTML、CSV、TSV 复制入口。 |
| REG-ISSUE-003 | ISSUE-003 | TC-P0-019/TC-P0-020 | ReadyForTestRun | 无需截图 | 文件树、编辑区、表格菜单打开后按一次 Escape 关闭。 |
| REG-ISSUE-005 | ISSUE-005 | TC-P0-088 | ReadyForTestRun | screenshots/03-check-update-final-state.png | 检查更新后能看到最新、不可用、发现更新或失败中的一种最终态。 |
| REG-ISSUE-008 | ISSUE-008 | TC-P0-034 | ReadyForTestRun | screenshots/04-preview-replace-split-fixed.png | 预览模式触发替换不会静默降级为查找，界面切到分栏并展示替换输入。 |
| REG-ISSUE-012 | ISSUE-012 | TC-P0-078 | ReadyForTestRun | screenshots/05-export-success-toast-fixed.png | 导出成功 toast 包含打开与显示位置动作；打开失败和显示位置失败均有错误反馈。 |

## 测试口径修正

- 通用命令面板不恢复，验收改为 Quick Open / Workspace Search。
- 导出清晰度保持下拉控件，不改 slider；验收为档位可见、可切换、可保存。
- 行号入口不加到视图菜单；验收改为 `设置 > 写作 > 显示行号`。
- Windows/Linux 必须真机验证；当前只生成回填模板，标记为 `Blocked: no device`。

## 建议验证命令

```bash
npm test -- --run src/components/shell/ContextMenu.test.tsx src/domains/editor/extensions/contextMenu.test.ts src/domains/editor/components/SearchPanel.test.tsx src/domains/editor/components/SplitView.test.tsx
npm test -- --run src/domains/editor/components/EditorPane.integration.test.tsx src/domains/editor/components/useEditorCommandEventModel.test.tsx src/domains/commands/registry.test.ts
node scripts/run-prism-issue-regression.mjs --app /Applications/Prism.app --baseline docs/reviews/prism-full-feature-test-2026-06-22
npm run build
git diff --check
```

## 未验证风险

- 本脚本不启动或操作桌面 UI，不能替代修复后真机截图。
- 如果 `/Applications/Prism.app` 尚未被当前源码构建产物替换，截图仍会反映旧版本 App。
- Windows/Linux 文件关联、标题栏和字体 fallback 仍需真机补充。
