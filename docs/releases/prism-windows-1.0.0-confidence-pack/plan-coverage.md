# 原始验证计划覆盖审计

源计划：`docs/releases/prism-windows-1.0.0-confidence-plan.md`，基线 `e03f199e6f3bcd256bc9cc83c356302e69239d31`。

## 覆盖结论

当前证据包已经覆盖原计划的主要命令、产物、安装、文件关联、路径动作、写作预览、导出、updater、性能和收尾检查。P0 安装阻塞已消减，结论推进到 `Conditional Go`。

尚不能记为 Windows Stable 的项目：

- updater 签名私钥缺失。
- 文件树删除到回收站、高 DPI 125% / 150%、F9 打字机模式仍需人工或稳定入口补验。
- MSI 非管理员 `/qn` 静默安装仍会因 per-machine 权限限制失败；管理员静默安装已经通过。
- 额外 Rust workspace index job 查询风险已消减，见 `issues.md`。

## 计划项映射

| 原计划项 | 当前证据 | 状态 |
|---|---|---|
| 版本口径 `tag=v1.0.0` / `e03f199e...` | `README.md`、`manifest.json`、`evidence/environment.md` | Pass |
| 证据目录结构 | `README.md`、`manifest.json`、`evidence/`、`screenshots/`、`artifacts/` | Pass |
| Windows 11 x64 环境 | `evidence/environment.md` | Pass |
| Git / Node / npm / Rust / Cargo | `evidence/environment.md` | Pass |
| PowerShell / Build Tools / WebView2 | `evidence/environment.md` | Pass |
| `npm test -- --run` | `evidence/build-and-test.md`、`issues.md` | Pass |
| `npm run build` | `evidence/build-and-test.md` | Pass |
| `npm run tauri:build` | `evidence/build-and-test.md`、`evidence/installer-artifacts.md`、`evidence/updater.md` | Blocked at updater signing |
| `git diff --check` | `evidence/build-and-test.md` | Pass |
| 安装器类型、文件名、大小、SHA256 | `evidence/installer-artifacts.md` | Pass |
| 文件版本、产品名、签名状态 | `evidence/installer-artifacts.md`、`evidence/install-smoke.md` | Pass |
| WIN-REL-001 安装器启动并安装 | `evidence/install-smoke.md`、`screenshots/00-installer-home.png` | Pass for NSIS and elevated MSI |
| WIN-REL-002 开始菜单可启动 Prism | `evidence/install-smoke.md` | Pass |
| WIN-REL-003 安装后版本为 1.0.0 | `evidence/install-smoke.md`、`evidence/installer-artifacts.md` | Pass |
| WIN-REL-004 覆盖安装保留设置 / 最近文件 | `evidence/install-smoke.md` | Pass |
| WIN-REL-005 卸载不删除用户工作区文档 | `evidence/install-smoke.md` | Pass |
| 安装器首页截图 | `screenshots/00-installer-home.png` | Pass |
| 安装完成页截图 | `evidence/install-smoke.md` | Evidence limitation |
| 开始菜单 / 首次启动 | `evidence/install-smoke.md`、`screenshots/01-first-launch.png` | Pass |
| WIN-UI-001 标题栏 / 窗口控制 | `evidence/ui-and-shortcuts.md`、`screenshots/03-titlebar-window-controls.png` | Pass |
| WIN-UI-002 最大化 / 还原不重叠 | `evidence/ui-and-shortcuts.md`、`screenshots/03b-maximized.png` | Pass |
| WIN-UI-003 多窗口单文档 | `evidence/ui-and-shortcuts.md`、`evidence/file-association.md` | Pass |
| WIN-UI-004 高 DPI 125% / 150% | `evidence/ui-and-shortcuts.md`、`manifest.json` | Blocked |
| WIN-FILE-001 默认打开 `.md` | `evidence/file-association.md` | Pass |
| WIN-FILE-002 Explorer 打开方式候选 | `evidence/file-association.md` | Pass by registry/default shell evidence |
| WIN-FILE-003 文件 B 不错误跳回文件 A | `evidence/file-association.md`、`evidence/ui-and-shortcuts.md` | Pass |
| WIN-FILE-004 `.txt` 文本模式 | `evidence/file-association.md` | Pass |
| WIN-FILE-005 `.json` / `.sql` 文本边界 | `evidence/file-association.md` | Pass |
| WIN-FILE-006 Explorer 图标 | `evidence/file-association.md`、`screenshots/04-file-association-explorer.png` | Pass |
| WIN-PATH-001 路径复制 | `evidence/path-actions.md` | Pass |
| WIN-PATH-002 Explorer 定位 | `evidence/path-actions.md`、`screenshots/04-file-association-explorer.png` | Pass |
| WIN-PATH-003 删除到回收站 | `evidence/path-actions.md`、`manifest.json` | Blocked |
| WIN-PATH-004 复杂路径打开 / 保存 / 导出 | `evidence/path-actions.md`、`evidence/export.md` | Pass |
| WIN-WRITE-001 编辑 / 分栏 / 预览 | `evidence/writing-preview.md`、`screenshots/05-split-preview.png` | Pass |
| WIN-WRITE-002 复杂 Markdown 预览 | `evidence/writing-preview.md`、`evidence/export.md`、`screenshots/08-diagrams-formulas.png` | Pass |
| WIN-WRITE-003 搜索 / 替换 | `evidence/writing-preview.md`、`evidence/ui-and-shortcuts.md` | Pass |
| WIN-WRITE-004 快捷键格式化 / 打开 / 新建 / 全屏 | `evidence/ui-and-shortcuts.md`、`manifest.json` | Pass |
| WIN-WRITE-008 `Ctrl` + 滚轮字号条件项 | `evidence/ui-and-shortcuts.md`、`manifest.json` | Not Run |
| WIN-WRITE-005 五套主题 | `evidence/ui-and-shortcuts.md`、主题截图 | Pass |
| WIN-WRITE-006 三语无明显溢出 | `evidence/ui-and-shortcuts.md`、语言截图 | Pass |
| WIN-WRITE-007 知识图谱入口 | `evidence/writing-preview.md`、`screenshots/15-relation-graph.png` | Pass |
| WIN-EXPORT-001 HTML 导出 | `evidence/export.md`、`artifacts/export/windows-smoke.html` | Pass |
| WIN-EXPORT-002 PDF 导出 | `evidence/export.md`、`artifacts/export/complex-export.pdf` | Pass smoke |
| WIN-EXPORT-003 PNG 导出 | `evidence/export.md`、`artifacts/export/complex-export.png` | Pass smoke |
| WIN-EXPORT-004 DOCX 导出 | `evidence/export.md`、`artifacts/export/complex-export.docx` | Pass smoke |
| WIN-EXPORT-005 导出诊断 | `evidence/export.md` | Pass |
| WIN-EXPORT-006 中文 / 空格导出路径 | `evidence/export.md`、`evidence/path-actions.md` | Pass |
| WIN-UPD-001 检查更新不一直 loading | `evidence/updater.md`、`screenshots/14-update-unavailable.png` | Pass |
| WIN-UPD-002 无 Windows manifest 时合理最终态 | `evidence/updater.md` | Pass |
| WIN-UPD-003 updater asset / `.sig` | `evidence/updater.md`、`issues.md` | Blocked |
| WIN-PERF-001 大工作区可交互 | `evidence/performance.md` | Pass |
| WIN-PERF-002 选择 / 滚动 / 编辑 | `evidence/performance.md` | Pass |
| WIN-PERF-003 索引取消 / 降级 | `evidence/performance.md`、`manifest.json` | Pass |
| WIN-PERF-004 长文预览 / 导出反馈 | `evidence/performance.md`、`screenshots/16-long-preview.png` | Pass |
| 结论门槛 / Release status 摘要 | `README.md` | Conditional Go |

## 截图约束

本包保留的截图均为 Prism、Explorer 或安装器目标窗口本体。未把被其它浮层污染的 F9 测试截图作为证据。
