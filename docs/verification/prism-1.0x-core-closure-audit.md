# Prism 1.0.x 核心本地写作体验闭环审计

> 日期：2026-05-15  
> 本批目标：只做审计，不改运行时代码。  
> 计划来源：`docs/prism-product-optimization-plan.md`  
> 设计约束：`AGENTS.md`、`CONTEXT.md`、`docs/adr/`、`docs/prism-openai-redesign.html`

## 1. 目标与范围

本审计用于判断 Prism 1.0.x 的“本地优先 Markdown 写作器”核心体验是否已经闭环，并把真实证据、弱验证和剩余缺口拆清楚。审计对象不是完整 v1.4.0 backlog，而是 1.0.x 核心本地写作体验：

- 文件安全与发布可信
- 写作效率
- 预览同步
- 导出工作台
- 专业扩展
- 对外扩展 / 明确非目标

以下内容不作为 1.0.x 闭环要求：完整 WYSIWYG、云同步、移动端、实时协作、图谱视图、Obsidian 式插件市场、数据库式 Properties 表格视图。

## 2. Prompt-to-artifact checklist

| 要求 | 证据 | 状态 |
| --- | --- | --- |
| 先读项目约束与计划 | `AGENTS.md`、`CONTEXT.md`、`docs/adr/`、`docs/prism-openai-redesign.html`、`docs/prism-product-optimization-plan.md` | 已完成 |
| 保持单文档单窗口 | `CONTEXT.md` 明确无标签页；`src/domains/workspace/store.ts` 仍为 single/folder 工作区模型；`src/lib/fileActions.ts`、`src/domains/workspace/components/FileTree.tsx` 用“新窗口打开”而不是 tab | 已满足 |
| 保持 OpenAI 极简方向 | `docs/adr/0001-adopt-openai-minimal-design.md`、`docs/adr/0002-css-token-naming.md`、`docs/prism-openai-redesign.html` | 已满足，本文档未改 UI |
| 不引入禁用能力 | `rg` 未发现插件市场、云同步、移动端、图谱或完整 WYSIWYG 实现入口；计划中仍标为非目标 | 已满足 |
| 每批先说明目标和影响面 | 每批开工前均先说明目标和影响面；近期批次分别限定在 recovery App 接线、预览长文 smoke、写作效率事件接线、导出失败诊断、专业写作诊断与审计刷新 | 已完成 |
| 产出本地审计文档 | `docs/verification/prism-1.0x-core-closure-audit.md` | 已完成 |
| 运行验证命令 | 最新 `npm test -- --run --maxWorkers=1` 通过 59 files / 362 tests；`npm run build` 通过，仅有既有 Vite large chunk warning；`git diff --check` 通过；`npm run tauri:build:app-smoke` 通过并完成 Rust release 编译 | 已通过 |
| Tauri build gate | `npm run tauri:build:app-smoke` 通过并生成 `.app`；`npm run tauri:build` 完成前端 build、Rust release 编译和 `.app` bundle 后失败在已知 DMG `bundle_dmg.sh` 或 updater 签名环境；`npm run release:mac-dmg:skip-finder` + `hdiutil verify` 通过 | 已验证并记录限制 |

## 3. 总体结论

核心 1.0.x 本地写作体验已经有较多实现和自动测试覆盖，但还不能判定“完全闭环”。可以把状态分成三类：

- **已具备最小闭环**：文件保存状态、外部修改冲突、recovery、图片粘贴、组件级图片拖拽接线、表格/列表/模板、快速打开、源码-预览跳转、导出设置、引用设置与 Pandoc 回退。
- **弱验证**：真实 Pandoc citeproc、正式签名/公证、Windows 发布链路、Finder / Explorer 图片拖拽、30 秒人工输入帧率 / CPU 量化。
- **未闭环但非当前主线**：CLI/deep link、主题包 / 导出模板包、插件 API。插件市场按计划为明确非目标。

下一步不建议再盲目加功能；应先补 1-2 个真实 smoke 文档或自动化检查，把弱验证变成可复现验证。

### Active goal 完成度判定

按产品全量闭环口径，当前不能宣称所有任务全部完成；按 2026-05-15 新版 active goal（持续推进到只剩外部 / 人工阻塞即可停止），本机可执行 checkpoint 已推进到停止条件 2。可交付条件与证据如下：

| 成功条件 | 当前证据 | 判定 |
| --- | --- | --- |
| 基于本地计划持续推进 v1.4.0 优化 | `docs/prism-product-optimization-plan.md`、本审计、各 smoke 文档、多个已完成自动化切片；本机可完成项已推进到只剩外部 / 人工阻塞 | 满足新版 goal 停止条件 |
| 保持单文档单窗口与 OpenAI 极简方向 | `CONTEXT.md`、ADR、原型约束；本轮未引入 tab、图谱、云同步、移动端、插件市场或 WYSIWYG | 已满足 |
| 文件安全与发布可信核心路径有证据 | 保存状态、外部修改冲突、recovery、App 层 recovery modal 接线、macOS App-only 真实 crash / restart recovery smoke、fs scope、macOS Prism UI 文件树删除到废纸篓、release checklist、updater manifest、macOS fallback DMG、Windows release smoke 文档 | 自动化与 macOS 运行时 smoke 较强，但正式签名 / 公证 / Windows release 环境未闭环 |
| 写作效率核心路径有证据 | 图片 helper、Markdown 链接补全/诊断、轻量 `[[note]]` 工作区内链补全、表格、列表、模板、快速打开、字数统计、CodeMirror 全局命令事件接线、paste / normal-drop / Alt-drop DOM 接线测试、Alt-drop 缺路径提示、列表 keymap 组件级回归、链接补全上下文组件回归、macOS 真实 `.app` 系统剪贴板图片粘贴、快速打开、链接补全/诊断、表格命令、列表续写/退出、PRD 模板插入、大纲搜索和选区统计 smoke | 自动化较强，macOS 主要写作路径已补真实桌面证据；macOS Finder 拖拽已尝试但当前自动化工具无法安全完成，Finder / Explorer 拖拽、Option / Alt 原路径和 Windows 桌面路径仍未闭环 |
| 预览同步与 HTML 安全有证据 | source-line mapping、点击跳源码、长文 / 重媒体 mapping、内容更新后 source-line 刷新、10 万字符级 Markdown -> HTML smoke、Mermaid 队列、KaTeX/Mermaid 错误定位、链接安全清理测试、macOS 真实 `.app` 长文分栏滚动 / 预览点击 / 尾部错误区 / 单次输入预览刷新 / undo history / `Cmd+Down` 跳文末同步 / 本地图片重媒体 / System Events 键盘突发输入 smoke | 自动化中等偏强，macOS 真实 drift、单次输入撤销、重媒体渲染和突发输入证据已补；30 秒人工连续输入和精确帧率 / CPU 量化未闭环 |
| 导出工作台可靠性有证据 | HTML/PDF/PNG/DOCX pipeline、golden fixture、复杂导出产物 smoke、命令入口四格式集成 smoke、真实 Prism UI 四格式导出、PDF / PNG 栅格颜色兼容修复、PDF WebKit 矢量主链路、DOCX task list、Pandoc 回退、安全清理测试、导出进度事件、App 层进度 UI / 失败诊断复制测试 | 自动化和 macOS 真实 UI smoke 较强；PDF 已从图片 PDF 主链路改为 macOS WebKit 矢量 PDF capture；真实 Pandoc citeproc 仍受环境阻塞 |
| 专业扩展有证据 | citation settings、Pandoc citeproc 分支、citekey / suppress-author 占位、邮箱/代码语境误报防护、专业写作 smoke 文档、中文排版 10 万字符级 micro benchmark、排版诊断 250 条长列表组件回归 | 自动化中等偏强，但本机缺 Pandoc，真实 citeproc 未闭环 |
| 每批验证 gate 通过 | 最近多批均执行 `npm test -- --run`、`npm run build`、`git diff --check` 并通过；最新全量为 59 files / 362 tests；本批已补 `npm run tauri:build:app-smoke` 并完成 Rust release 编译 | 已满足当前自动化 gate |
| 无剩余必需工作 | Finder / Explorer 图片拖拽与 Option / Alt 原路径、30 秒人工连续输入量化、Pandoc、签名公证、Windows release 仍未完成 | 未满足产品全量完成；满足新版 goal 停止条件 2 |

因此，当前状态应表述为：本机可执行的 1.0.x 本地写作体验 checkpoint 已推进到只剩外部 / 人工阻塞，可以按新版 goal 停止条件收束；但不能对外宣称 Prism 1.0.x 全量任务全部完成。

## 4. 文件安全与发布可信

### 计划要求

- 扩展文档状态模型，区分 dirty / saving / saved / failed / conflict。
- 保存前检测磁盘 mtime / size，防止外部修改被静默覆盖。
- 提供冲突处理 UI：重新加载、另存为、覆盖。
- 保存失败不清 dirty，并能生成 recovery 快照。
- 收紧 Tauri fs scope，不保留静态 `**` 全盘权限。
- 发布前具备 release checklist、updater manifest、macOS 签名/公证流程和 Windows 发布验证路径。

### 当前证据

- `src/domains/document/types.ts` 定义 `DocumentSaveStatus = 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict'`，并在文档状态中保存 `lastKnownMtime`、`lastKnownSize`、`saveError`。
- `src/domains/document/store.ts` 在 open / update / saving / saved / failed / conflict 各状态间显式更新 `saveStatus`。
- `src/domains/document/fileSnapshot.ts` 使用 Tauri `stat` 生成 mtime / size 快照。
- `src/domains/document/hooks/useAutoSave.ts` 保存前创建 recovery，比较磁盘快照；磁盘变化时进入 conflict，不调用 `writeTextFile`。
- `src/domains/document/hooks/useAutoSave.ts` 在自动保存关闭时仍为 dirty 已保存文档写入 recovery 快照，但不写回原文件，避免用户关闭自动保存后异常退出完全没有本地快照。
- `src/domains/document/hooks/useExternalFileChangeMonitor.ts` 在窗口重新聚焦时检测 dirty 文档是否被外部修改。
- `src/domains/document/components/SaveConflictModal.tsx` 暴露三个动作：重新加载磁盘版本、保留我的版本并另存为、覆盖磁盘版本。
- `src/domains/document/services/conflictResolution.ts` 分别实现 reload / save-as / overwrite，并配有 `conflictResolution.test.ts`。
- `src/domains/document/services/recovery.ts` 把快照写入 appData `recovery/`，每文档保留最近 10 个，并可恢复为 dirty 文档。
- `src/domains/document/services/recovery.ts` 启动扫描会忽略损坏 JSON 和目录 hash 与 `documentPath` 不匹配的错位快照，避免坏 recovery 文件阻塞或污染恢复提示。
- `src/domains/document/services/recovery.ts` 启动扫描会校验 recovery metadata：只接受合法 `version`、非空 `documentPath`、字符串 `content`、有限数字 `createdAt` 和 `autosave | manual-save` reason；旧快照缺少 `documentName` 时回退显示文件名。
- `src/domains/document/services/recovery.ts` 会在同一文档同一毫秒连续创建快照时寻找下一个可用时间戳文件名，避免 `Date.now()` 碰撞覆盖旧快照。
- `src/domains/commands/registry.test.ts` 覆盖手动保存前创建 `manual-save` recovery 快照、保存成功后清理快照、磁盘外部修改时保留快照且不覆盖磁盘文件。
- `src/domains/document/hooks/useRecoveryQueue.ts` 把启动扫描 recovery 快照、当前提示队列、恢复/丢弃动作从 `App.tsx` 抽成可测 hook；`useRecoveryQueue.test.tsx` 覆盖启动列出快照、恢复后移除当前快照、丢弃只移除当前快照、恢复失败 / 丢弃失败保留快照和卸载后不更新状态。
- `src/App.tsx` 通过 `shouldShowRecoveryPrompt()` 明确 recovery modal 的 App 级遮挡规则：有启动快照、没有保存对话框、没有保存冲突时才显示；`src/App.recovery.test.tsx` 覆盖 App 接入 `RecoveryModal`、恢复 / 丢弃动作转发、保存冲突优先展示 `SaveConflictModal`，以及 save dialog 遮挡规则。
- `docs/verification/prism-recovery-crash-smoke.md` 记录 macOS App-only 真实 crash / restart recovery smoke：关闭自动保存后真实编辑已保存文档，recovery 快照包含 marker 且原文件不含 marker；`kill -9` 后重启显示“恢复文档”modal；点击恢复后内容回到编辑器且状态为“已编辑 / 未保存”；`Cmd+S` 后原文件写入 marker、recovery 目录清理，再次重启不再提示同一快照。
- `src-tauri/capabilities/default.json` 只列出 fs 默认、read/write files、appData 递归读写等能力；`docs/prism-p0-runtime-smoke.md` 记录 `rg '"path": "\\*\\*"' src-tauri/capabilities` 无命中。
- `src/lib/fileSystemScope.ts` 调用 `grant_markdown_file_scope`；`src-tauri/src/lib.rs` 通过 `FsExt` scope 授权非对话框打开的 Markdown 文件。
- `src-tauri/src/lib.rs` 新增 `move_path_to_trash` Tauri command；`src/lib/fileActions.ts` 删除文件时优先移到系统废纸篓，失败后才二次确认永久删除。macOS Finder AppleScript 已从直接 `POSIX file` 修正为 `POSIX file ... as alias`；真实 Prism `.app` smoke 暴露 Finder 在 App 进程内 8 秒超时后，已补 `~/.Trash` 唯一路径 fallback。2026-05-15 真实 UI 复测右键删除临时 Markdown 文件通过：Prism 文件树移除目标，编辑区进入安全空状态，toast 显示已移到系统废纸篓，源文件消失，`~/.Trash/ui-delete-20260515175002.md` 存在，`keep.md` 未受影响。
- `docs/prism-p0-runtime-smoke.md` 记录真实 macOS release bundle 文件打开 smoke、updater manifest 生成与校验、`npm run tauri:build` 到 `.app.tar.gz` / `.sig` 的验证。
- `docs/verification/prism-macos-dmg-packaging-smoke.md` 记录 DMG Finder AppleScript 超时 `(-1712)` 的真实诊断，以及 `npm run release:mac-dmg:skip-finder` fallback 生成 DMG 并通过 `hdiutil verify` 的证据。
- `src-tauri/tauri.local-smoke.conf.json` 和 `npm run tauri:build:app-smoke` 提供本机 App-only runtime smoke 构建，关闭 updater artifacts 并跳过 DMG 生成；2026-05-15 已返回 0 并生成 `src-tauri/target/release/bundle/macos/Prism.app`。
- `docs/prism-release-checklist.md`、`docs/prism-macos-release.md`、`docs/prism-updater-manifest.example.json`、`.github/ISSUE_TEMPLATE/export_bug.yml` 构成发布和反馈入口。
- `docs/verification/prism-windows-release-smoke.md` 明确 Windows v1.4.0 release / updater 的阻塞定义、构建命令、产物检查和人工 smoke。
- `package.json` 和 `src-tauri/tauri.conf.json` 当前版本均为 `1.4.0`；许可证为 MIT。

### 验证强度

- 自动测试强：store、auto-save、manual-save command、external monitor、conflict resolution、recovery、settings path persistence、文件删除废纸篓 fallback 均有测试；recovery 已覆盖单个快照丢弃、丢弃失败不误报成功、坏快照忽略、错位快照过滤、malformed metadata 过滤、旧快照文件名回退、同毫秒快照不覆盖、手动保存外部修改时保留快照、App 层恢复提示队列的恢复/丢弃/失败路径，以及 App 树中 `RecoveryModal` 与 `SaveConflictModal` 的优先级接线。
- 运行时 smoke 较强：macOS release bundle 的文件打开、fs scope、settings 写入、manifest 生成已有本机证据；recovery crash / restart 已用最新 `npm run tauri:build:app-smoke` bundle 跑通真实编辑、强退、重启恢复、显式保存清理和二次重启不重复提示。
- 发布可信弱验证：Apple Developer ID 签名、公证、GitHub Release 正式 `latest.json`、Windows installer/updater 仍未在真实发布环境完成；macOS DMG 已有 Finder 超时 fallback，但 fallback DMG 没有 Finder 美化布局；Windows v1.4.0 已明确为 release 阻塞项。

### 缺口

- Apple Developer ID 签名与公证没有真实证书环境结果，不能宣称 stable 发布链路闭环。
- 默认 `npm run tauri:build` 在本机仍可能被 updater 私钥、Apple 签名/公证或 DMG Finder AppleScript 超时阻塞；当前 App-only smoke 构建可用于本地运行时验证，fallback 可生成可校验 DMG，但二者都不能替代正式 Stable release 签名、公证和 updater artifacts。
- Windows release、Windows updater 产物和 Windows 文件关联仍未真实验证；`docs/verification/prism-windows-release-smoke.md` 已把它们明确列为 Stable 阻塞项。
- recovery 真实 crash / restart 在 macOS App-only bundle 中已闭环；尚未做真实桌面的“丢弃快照”按钮、保存失败路径和 Windows crash/restart，不能把这些平台 / 分支也宣称完成。
- 文件删除已优先接入系统废纸篓，macOS Prism `.app` 文件树删除到 `~/.Trash` 已通过真实 UI smoke；Windows Explorer smoke 仍未验证，不能宣称 Windows 废纸篓闭环。

### 下一步

文件安全里 macOS 删除到废纸篓主链路已补强；下一步应转向同优先级的 Windows release / updater / 文件关联环境阻塞记录，或继续处理本机可完成的写作效率、预览和导出真实 smoke，不要把 Windows 与正式签名公证包装成已完成。

## 5. 写作效率

### 计划要求

- 图片粘贴保存到当前文档旁的 `assets/<document-name>/`，插入相对路径。
- 图片拖拽默认复制到 assets；按 Option / Alt 时插入原路径链接。
- `](` 后触发路径补全，支持当前文档 heading 补全。
- `[[note]]` 轻量内链补全只服务本地工作区 Markdown 文件，不扩展为图谱、反链或数据库式知识库。
- 链接诊断检查相对文件、图片和 heading。
- 表格命令只改源码 Markdown。
- 列表回车续写、空项退出、Tab / Shift+Tab 调整缩进。
- Markdown 模板覆盖 README、PRD、会议纪要、周报、技术方案、公众号长文和学术模板。
- 快速打开支持 fuzzy search 和最近打开加权。
- 大纲支持标题层级、标题搜索和点击跳源码。
- 字数统计支持中文、英文、字符、阅读时间、选区统计。

### 当前证据

- `src/domains/editor/extensions/imagePaste.ts` 生成 assets 目标路径、保存剪贴板图片并返回相对 Markdown 图片。
- `src/domains/editor/components/EditorPane.tsx` 处理剪贴板图片、拖拽图片；`event.altKey` 时读取原生路径并插入原路径 Markdown 链接。
- `src/domains/editor/extensions/imagePaste.test.ts` 覆盖 MIME 扩展名、中文文档名 assets 路径、拖拽图片文件识别、Windows 路径归一、Tauri fs 写入 contract 和同秒文件名冲突后缀。
- `src/domains/editor/extensions/headingSlug.ts` 统一标题锚点 slug contract；`linkCompletion.ts`、`linkDiagnostics.ts` 共享同一规则，覆盖工作区路径补全、heading slug、标题末尾标点、缺失文件 / 缺失 heading / 空链接诊断。
- `src/domains/editor/extensions/linkCompletion.ts` 新增轻量 `[[note]]` wiki 内链补全：优先识别 `[[` 上下文，候选只来自工作区 Markdown / Markdown-like 文件，补全 label 为工作区相对路径并移除 `.md` / `.markdown` / `.txt` 后缀；没有引入图谱、反链、渲染解析或插件式知识库能力。
- `src/domains/editor/components/LinkDiagnosticsPanel.tsx` 可列出问题并跳源码；`src/domains/workspace/components/StatusBar.tsx` 展示链接问题数。
- `src/domains/editor/extensions/tables.ts` 提供插入、格式化、增删行列等源码表格编辑；`tables.test.ts` 覆盖不破坏周边正文。
- `src/domains/editor/extensions/markdownLists.ts` 覆盖列表续写、退出空项、缩进和反缩进。
- `src/domains/editor/extensions/templates.ts` 包含通用和学术 Markdown 模板；`src/domains/commands/registry.ts` 将模板命令暴露到文件菜单和命令面板。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 真实挂载 CodeMirror 后验证全局 `prism-editor-command`、`prism-format`、`prism-heading`、`prism-block-format` 事件能执行表格插入、模板插入、行内加粗、标题格式化和任务列表，并忽略非法模板 id、非法 heading payload、缺失 block format detail 和缺失 editor command detail，补齐命令注册到编辑器事件的接线回归。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 真实挂载 CodeMirror 后覆盖 Markdown 列表 keymap：`Enter` 续写列表、空项再次 `Enter` 退出列表、`Tab` 缩进和 `Shift+Tab` 反缩进。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 真实挂载 CodeMirror 后覆盖 Markdown 链接补全上下文：`']('` 触发位置能读取当前文档 heading、工作区 Markdown 文件和当前文档路径，且不会把图片文件作为链接补全项。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 真实挂载 CodeMirror 后覆盖 `[[note]]` wiki 内链补全上下文：`[[` 触发位置能读取工作区 Markdown 文件，补全 `docs/guide`、`docs/api`、`README`，并排除图片文件和图片去扩展名。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 真实挂载 CodeMirror 后覆盖图片事件接线：`paste` 剪贴板图片会调用当前文档资产保存 pipeline 并插入 Markdown 图片；普通 `drop` 图片会复制到当前文档 assets 并插入相对 Markdown 图片；Alt / Option `drop` 图片会插入原始路径 Markdown 链接且不会复制到 assets；Alt / Option `drop` 取不到原生路径时显示明确提示并保持正文不变。
- `src/domains/workspace/services/quickOpen.ts` 实现 name/path/preview 分数和 recent boost；`fileTree.test.ts` 覆盖最近打开加权。
- `docs/verification/prism-writing-efficiency-smoke.md` 记录 macOS 真实 `.app` 快速打开键盘 smoke：`Mod+P` 打开快速打开，输入 `gui` 后出现 `docs/guide.md`，回车后窗口标题、文件树选中项和编辑区内容都切换到 `guide.md`；空搜索结果可见当前 workspace 文件列表。
- `src/domains/workspace/components/OutlinePanel.tsx` 支持按标题文本搜索大纲；`OutlinePanel.test.tsx` 覆盖标题渲染、搜索过滤、无匹配空状态和过滤后点击仍跳到原源码行。
- `src/domains/workspace/services/writingStats.ts` 统计中文字符、英文词、字符数、阅读分钟；`SplitView.test.tsx` 和 `StatusBar.test.tsx` 覆盖选区统计传递与展示。

### 验证强度

- 自动测试强：各 helper 和 command registry 覆盖较多；图片粘贴已覆盖实际 fs 写入调用和同秒文件名不覆盖；Markdown 链接补全、heading anchor、轻量 wiki 内链补全和链接诊断均有 helper 回归。
- UI 行为中等偏强：React 组件测试覆盖面板、状态栏和 CodeMirror 命令事件接线；全局编辑器事件已覆盖表格、模板、行内格式、heading、任务列表和异常 payload 防护；列表 keymap 已覆盖 Enter / Tab / Shift+Tab 的 CodeMirror 按键路径；Markdown 链接补全和 `[[note]]` 内链补全已覆盖挂载后 CodeMirror 上下文；macOS 真实 `.app` 已补系统剪贴板图片粘贴、快速打开键盘、链接诊断面板与跳转、Markdown link 补全面板与插入、`[[note]]` 候选展示、命令面板表格格式化、列表续写 / 退出、PRD 模板插入、大纲搜索和选区统计；图片拖拽已有普通 drop、Alt / Option 原路径 drop 和 Alt / Option 缺路径提示的 CodeMirror DOM 事件接线回归。2026-05-15 macOS Finder 拖拽真实 smoke 尝试未能安全触发 Prism drop pipeline，不能作为通过证据。

### 缺口

- 图片粘贴已有 macOS 真实 `.app` 系统剪贴板 smoke：PNG 写入 `NSPasteboard` 后通过原生 `Edit > Paste` 触发，产物写入 `assets/index/image-20260515-141341.png`，正文插入相对 Markdown 图片路径。快速打开已有 macOS 真实 `.app` 键盘 smoke：`Mod+P` 搜索 `guide` 并打开 `docs/guide.md`。链接诊断已有 macOS 真实 `.app` smoke：状态栏 `LINK 3` 打开“链接问题”面板，列出缺失文件、缺失标题、空链接，点击缺失标题后跳到 `LN 8 COL 1`。Markdown 链接补全已有真实输入 smoke：`[Guide](` 候选包含 heading、工作区 Markdown 文件和当前文件，键盘选择 `docs/guide.md` 后插入 `[Guide](docs/guide.md)`。`[[note]]` 内链补全已有真实候选展示 smoke：候选为 `docs/api`、`docs/guide`、`index`，不展示图片且不带 `.md` 后缀。表格、列表、模板、大纲和选区统计已有 macOS 真实 `.app` smoke：命令面板格式化当前表格、Enter 续写并空项退出列表、命令面板插入 PRD 模板、大纲搜索 `目标` 只显示匹配项、选中文英混排段落后状态栏显示选区统计。图片拖拽已有普通 drop、Alt / Option 原路径 drop 和缺路径提示的组件级接线回归；macOS Finder 拖拽已尝试但工具无法安全复现，Windows Explorer 拖入和 Alt/Option 修饰键差异仍需人工或平台验证。

### 下一步

`docs/verification/prism-writing-efficiency-smoke.md` 已覆盖图片粘贴、快速打开、链接补全、链接诊断、表格命令、列表续写 / 退出、模板插入、大纲搜索和选区统计的 macOS 真实 `.app` 路径；Finder 拖拽 / Option 原路径仍需要人工 smoke 或更可靠的跨应用拖拽自动化，Windows Explorer 拖拽仍需 Windows 机器。

## 6. 预览同步

### 计划要求

- 预览 DOM block 带 `data-source-line`。
- 编辑器与预览双向滚动同步。
- 点击预览标题、段落、代码块可跳源码。
- Mermaid / KaTeX 错误显示摘要和“跳到源码”。
- 长文 Markdown 生成 debounce，Mermaid 渲染分批或缓存。
- HTML 安全：本地链接不直接打开，外链走 opener。

### 当前证据

- `src/lib/markdownToHtml.ts` 为 heading、paragraph、blockquote、list、math、code、table、hr、Mermaid placeholder 写入 `data-source-line`，并保留 `data-line` 兼容。
- `src/lib/markdownToHtml.test.ts` 覆盖 block source line、Mermaid、display math、citekey 占位、raw HTML 不进入预览 DOM、`javascript:` 链接 / 图片协议清理，以及控制字符混淆协议不会生成可点击 href。
- `src/lib/markdownToHtml.test.ts` 新增长文 smoke fixture：120 节、超过 10 万字符、6 个 Mermaid 块和 KaTeX 错误文本，验证基础 Markdown -> HTML 在 5 秒宽松预算内完成，且保留超过 1500 个 `data-source-line` 锚点。
- `src/lib/markdownToHtml.test.ts` 新增重媒体 smoke fixture：20 节、超过 2 万字符、50 张图片、20 个 Mermaid 块和 20 个 display math 块，验证基础 Markdown -> HTML 在 5 秒宽松预算内保留图片、Mermaid placeholder、KaTeX display math 和 source-line 锚点。
- `src/domains/editor/components/SplitView.tsx` 使用 source line 元素建立 line -> preview scroll 和 preview scroll -> line 映射，并记录 editor / preview scroll ratio。
- `SplitView.test.tsx` 覆盖预览点击跳源码、渲染诊断跳源码、滚动比例上报、预览模式保留 editor mount，以及 120 节长文 DOM 的源码行号 ↔ 预览 scrollTop 双向映射。
- `src/domains/editor/components/SplitView.tsx` 的预览 scrollTop 回源码行逻辑已修正为选择 `top <= scrollTop` 的最后一个可见元素，避免 scrollTop 落在代码块内部时被前一个段落带偏。
- `src/domains/editor/components/SplitView.tsx` 的预览 scrollTop 回源码行过滤不再为每个 source-line block 调用 `getComputedStyle`，只跳过 0 高度元素，降低长文滚动同步时的样式读取成本。
- `src/domains/editor/components/SplitView.test.tsx` 覆盖重媒体预览 round-trip drift：100 个章节、50 个图片占位、20 个 Mermaid 占位、20 个 KaTeX 占位和代码块抽样，验证源码行 → 预览 scrollTop → 源码行最大 drift 小于 1 行，映射回算在 500ms 宽松预算内完成。
- `src/domains/editor/components/PreviewPane.tsx` 缓存 Mermaid SVG，Mermaid 失败时生成带 `data-preview-source-line` 的错误块；KaTeX error 会增强为可跳源码动作。
- `PreviewPane.test.tsx` 覆盖内容连续变化后的 debounce 刷新：旧 `data-source-line` DOM 锚点会被移除，新内容 source-line 锚点可见，避免预览点击映射停留在旧内容。
- `src/domains/editor/components/PreviewPane.tsx` 多个 Mermaid placeholder 现在按顺序队列渲染，并在图表之间让出预览渲染 slot，避免长文里多个图表同时抢占渲染线程。
- `PreviewPane.test.tsx` 覆盖 Mermaid failure、Mermaid cache、KaTeX error source action、外链 opener、协议相对外链 opener、本地链接阻断和 `javascript:` 等非 http 链接阻断。
- `PreviewPane.test.tsx` 覆盖 Mermaid 顺序渲染：第一个 `mermaid.render()` 未完成前不会启动第二个图表渲染。
- `docs/verification/prism-preview-sync-smoke.md` 记录 macOS 真实 `.app` 长文预览 drift smoke：约 193KB、120 节、超过 8.5 万字符 fixture 在分栏模式打开后预览非空白；源码滚动约 10 页后左右两栏同在第 14/15 节附近；预览区域滚动后左右两栏稳定到第 27/28 节附近；点击右侧第 28 节标题后左侧源码定位到第 28 节，状态栏显示 `LN 716 COL 1`；尾部区域正常 Mermaid 图可见，错误区出现 `Syntax error in text`，没有整篇预览空白。
- `docs/verification/prism-preview-sync-smoke.md` 记录 macOS 真实 `.app` 单次输入 / undo / 键盘跳转 smoke：一次性粘贴 marker 后编辑器和预览同时刷新，视图切换回编辑后内容仍保留；一次 `Cmd+Z` 后 marker 从 UI 和落盘文件移除，UI 回到“已保存”；从顶部按 `Cmd+Down` 后编辑区与预览同步到第 120 节尾部，未复现此前键盘跳文末预览不立即跟随的弱观察。
- `src/domains/editor/components/PreviewPane.tsx` 已修复本地预览图片加载：预览接收当前文档路径后，将相对 / 绝对本地媒体路径通过已授权的 Tauri fs scope 读取为 `blob:` URL，不需要放开 Tauri `assetProtocol` 静态全盘 scope；`PreviewPane.test.tsx` 覆盖本地图片和远程图片分支。
- `src/domains/editor/extensions/linkDiagnostics.ts` 已避免把 Markdown 图片语法 `![](...)` 默认当成普通文件链接做 missing-file 诊断，防止当前 Markdown-only 工作区文件树对本地图片资产产生 `LINK 50` 假阳性；保留 `validateImageTargets` 入口，未来有资产感知索引时可重新开启精确图片缺失检测。
- `docs/verification/prism-preview-sync-smoke.md` 记录 macOS 真实 `.app` 重媒体端到端 smoke：`.codex-smoke/preview-heavy/preview-heavy.md` 含 50 张本地 SVG、20 个 Mermaid、20 个 display math；分栏模式下本地图片可见且不再断图，中段 Mermaid 图渲染正常，尾部第 39/40 张图片和第 20 个 Mermaid 仍可见，整篇预览没有空白。
- `docs/verification/prism-preview-sync-smoke.md` 记录 macOS 真实 `.app` 键盘突发输入 smoke：System Events 向 Prism 发送真实 `keystroke` 事件，约 1.1KB 文本在 `real 1.07s` 内进入编辑器，右侧预览同步显示，自动保存落盘；一次 `Cmd+Z` 后 marker 从 UI 和文件移除。

### 验证强度

- 自动测试中等偏强：source-line、点击跳转、scroll ratio、长文 mapping、重媒体 round-trip drift、内容更新后的 source-line DOM 刷新、长文 Markdown -> HTML smoke、重媒体 Markdown -> HTML smoke、Mermaid/KaTeX 错误路径、Mermaid 顺序渲染队列和基础链接安全已覆盖。
- 性能验证仍偏弱：已有 Mermaid 并发控制、10 万字符级 Markdown -> HTML 宽松预算回归、重媒体 scroll mapping 宽松预算回归，以及 macOS 真实 `.app` 长文滚动 / 点击 / 单次输入撤销 / 重媒体显示 / System Events 突发输入 smoke；但没有可信的 30 秒人工连续输入、帧率或 CPU 指标。
- 真实 E2E 中等偏强：已有 macOS 真实 `.app` 截图和可复查命令证明长文滚动区间、预览点击跳源码、尾部错误区非空白、单次输入预览刷新、视图切换后内容保留、undo history、`Cmd+Down` 跳文末同步、本地图片 / Mermaid / KaTeX 混排可显示，以及真实键盘事件突发输入可进入编辑器并刷新预览；但没有覆盖长时间人工输入性能量化。

### 缺口

- 长文基础 Markdown -> HTML、重媒体 Markdown -> HTML、重媒体 scroll mapping 已有宽松量化指标，Mermaid 批量渲染已有并发控制；macOS 真实 `.app` 长文滚动 drift、预览点击、尾部错误区、单次输入预览刷新、undo history、重媒体显示和键盘突发输入已补证据；30 秒人工连续输入和批量媒体 / Mermaid / KaTeX 组合的帧率 / CPU 仍没有量化结果。
- 双向滚动同步已有长文和重媒体算法回归，也已有一轮真实 CodeMirror / Preview viewport drift 记录；2026-05-15 复测 `Cmd+Down` 从顶部直接跳文末，编辑区与预览同步到第 120 节尾部，未复现此前“跳文末后预览不立即跟随”的弱观察，后续只需作为回归观察。
- 重媒体真实 smoke 暴露的状态栏 `LINK 50` 假阳性已通过“图片语法默认不做 missing-file 诊断”消除；但这不是精确图片缺失检测，后续如要完整覆盖图片资产，需要为链接诊断提供非 Markdown 资产索引。

### 下一步

`docs/verification/prism-preview-sync-smoke.md` 已补长文 fixture 生成方式、source-line 点击、双向滚动、Mermaid/KaTeX 错误定位、视图切换、长文性能检查表、jsdom 长文 / 重媒体 mapping 回归、Markdown -> HTML 长文 smoke，以及 macOS 真实 `.app` 长文滚动 / 点击 / 输入撤销 / 键盘跳转 / 重媒体显示 / 键盘突发输入 smoke；下一步如需继续提升性能证据，应人工或专用工具采集 30 秒输入、帧率和 CPU 指标。

## 7. 导出工作台

### 计划要求

- 统一导出设置：模板、纸张、边距、页眉页脚、目录、代码块、表格、默认目录。
- YAML front matter 可覆盖导出设置。
- 记录每个文件上次成功导出，支持按上次设置导出和覆盖上次导出文件。
- HTML / PDF / PNG / DOCX 正确处理中文、表格、Mermaid、KaTeX、代码块、图片。
- DOCX 保真：heading、paragraph、blockquote、table、code、task list、Mermaid 图片。
- 导出进度和失败诊断可复制。
- Pandoc 是可选增强，不作为基础依赖。

### 当前证据

- `src/domains/settings/types.ts`、`normalize.ts`、`store.ts` 已有 `exportDefaults`、`exportHistory`、Pandoc、citation 设置。
- `src/domains/export/frontMatter.ts` 解析 title、author、date、template、paper、margin、toc。
- `src/domains/export/templates.ts` 解析模板、front matter 覆盖、TOC、DOCX 字体策略、citation 和 pandoc 设置。
- `src/domains/export/toc.ts` 生成导出目录 HTML。
- `src/domains/commands/registry.ts` 包含“按上次设置导出”和“覆盖上次导出文件”，并把导出失败诊断加入 stage、template、front matter、TOC、纸张、页眉页脚、DOCX 字体、citation / Pandoc 状态。
- `src/domains/export/exportPipeline.ts` 有 HTML / PDF / PNG / DOCX 分支、Pandoc citeproc HTML 分支、回退 warning、导出进度 stage。
- `src/domains/export/exportPipeline.ts` 会在 Pandoc citeproc HTML 注入导出 DOM 前清理 fragment，移除 `<script>`、事件属性、inline style 和危险 URL，避免外部 Pandoc 路径绕过内置 Markdown HTML 安全策略。
- `src/domains/export/index.ts` 会按导出格式动态加载 adapter；Tauri 主窗口指定输出路径时会把实际导出渲染迁到独立 WebView，避免 PDF / PNG / HTML / DOCX 导出占满主编辑窗口；`vite.config.ts` 将 `exportPipeline`、`docx`、`pdf-lib`、`html2canvas` 拆为按需 chunk，主入口 JS 从约 `2,620.04 kB / gzip 834.05 kB` 降到 `1,950.05 kB / gzip 632.95 kB`，避免导出工作台完整链路拖入启动首包。
- `exportPipeline.test.ts` 覆盖 HTML/PDF/PNG/DOCX 基础导出、TOC、front matter、header/footer、DOCX golden fixture、progress stage、Pandoc citeproc 和回退。
- `exportPipeline.test.ts` 覆盖 DOCX GFM task list 产物级 XML：已完成任务导出为 `☑`，未完成任务导出为 `☐`，避免退化成普通项目符号。
- `exportPipeline.test.ts` 已新增复杂导出产物 smoke：同一份复杂 Markdown 会写出 `.codex-smoke/complex-export/out/complex-export.html|pdf|png|docx`，并读取产物检查 HTML 结构、PDF A4 页面、PNG 签名、DOCX XML / media 与 Mermaid 非源码输出。
- `src/domains/commands/exportCommand.integration.test.ts` 新增命令入口集成 smoke：从 `runCommand()` 执行 HTML / PDF / PNG / DOCX 四个导出命令，走真实导出 domain 和动态 adapter，写出 `command-export.*` 四个产物，确认无导出失败事件，并记录四条 export history。
- `src/domains/commands/registry.test.ts` 覆盖导出进度事件接线：pipeline progress 会派发 `prism-export-progress` 可见事件，成功或失败后都会派发 `{ visible: false }` 清理进度状态。
- `src/domains/commands/registry.ts` 会把导出失败前产生的 pipeline warning 汇总到可复制失败诊断中，避免 Pandoc / CSL / citekey 回退原因只以 toast 出现后丢失；`registry.test.ts` 覆盖 warning 汇总进入诊断文本。
- `src/App.recovery.test.tsx` 覆盖 App 层导出进度与失败诊断：`prism-export-progress` 事件会展示/隐藏进度状态并清理旧失败浮层；`prism-export-failure` 事件会展示诊断浮层，诊断文本可复制到系统剪贴板，并显示复制成功 toast。
- `src/domains/export/isolatedWebviewExport.ts` 将独立导出 WebView 停在主窗口背后的极小可见窗口，启用 `backgroundThrottling: disabled`，并加入 90 秒无进度 watchdog；`isolatedWebviewExport.test.ts` 覆盖 worker 不再离屏隐藏、无进度会失败并清理 worker。
- `src/domains/export/exportPipeline.ts` 为 `requestAnimationFrame` 等待增加 timer fallback，Mermaid 多图导出按 `正在渲染图表 N / 总数` 报告进度，并给 DOCX Mermaid 图片链路增加 render / 图片加载超时；`exportPipeline.test.ts` 覆盖 rAF 不回调时 HTML 导出仍能完成，以及多 Mermaid 的逐图进度。
- `src/domains/export/exportPipeline.ts` 将 macOS / Tauri export worker 内的 PDF 默认主链路改为 WebKit `createPDFWithConfiguration` capture；旧 `html2canvas -> PNG pages -> pdf-lib` 只作为明确 warning fallback。长文 WebKit capture 按最多 8 页 / 12,000 CSS px 一批执行，再用 `pdf-lib.embedPdf()` 分页到 A4 / Letter；页眉页脚和页码只叠加小型 chrome，不重新栅格化整页。
- `src-tauri/src/lib.rs` 新增 async `capture_current_webview_pdf` command，macOS 通过 `WKWebView.createPDFWithConfiguration_completionHandler` 写出临时 capture PDF；非 macOS 当前返回平台未接入错误，由前端 warning fallback 到 raster，避免破坏跨平台构建。
- `src/domains/commands/registry.ts` 给导出前的 `waitForExportProgressPaint()` 增加 timer fallback，避免 WebKit 暂停 `requestAnimationFrame` 时真实 UI 卡在“准备导出”。
- `docs/verification/prism-complex-export-smoke.md` 记录自动化 pipeline 产物 smoke、命令入口集成 smoke 和真实 Prism UI 四格式导出 smoke 通过；2026-05-15 通过当前 `.app` 应用内导出菜单生成 `ui-raster-fixed.html|pdf|png|docx`，并用 `file`、`pdf-lib`、`sips`、`jszip`、`textutil` 和 Quick Look thumbnail 检查产物。
- `docs/verification/prism-complex-export-smoke.md` 记录 2026-05-17 独立导出 WebView 卡死修复 smoke：真实 `.app` 曾在 HTML 导出 `preview-heavy.md` 时停在“正在渲染图表”并 20 分钟后超时；修复后通过命令面板导出 `preview-heavy-webview-smoke-fixed.html`，文件在几秒内生成，HTML 中有 20 个 Mermaid SVG，1 个 fixture 内故意非法 Mermaid 以单图 fallback 落地，没有阻断整份导出。
- `docs/verification/prism-pdf-export-performance.md` 记录 2026-05-17 PDF 性能重构：官方资料研究、方案矩阵、失败过的 `printOperationWithPrintInfo` 路线、WebKit `createPDFWithConfiguration` 选型、raster fallback、before / after 文件级对比和真实 app smoke 证据。
- `docs/verification/prism-complex-export-smoke.md` 记录 2026-05-17 PDF WebKit 矢量主链路 smoke：`preview-heavy-webkit-smoke.pdf` 约 475K、51 页 A4、PDFKit 可提取正文、`/Font = 7`、`/Subtype /Image = 0`，第 1 / 26 / 51 页渲染截图可见正文、本地 SVG、Mermaid 图、KaTeX 和尾部错误诊断；旧 raster 对比文件为 5.0M、50 个 image object、0 个 font object、文本提取为空。
- `docs/verification/prism-docx-rich-export-smoke.md` 记录 2026-05-18 DOCX 富内容导出重构：正文结构保留原生 DOCX，本地普通 SVG 写入 SVG + PNG fallback，Mermaid 改为 PNG-first 主图，KaTeX / HTML 块按视觉 fallback 写入 PNG；真实 `.app` 导出 `docx-rich-export.docx` 后，`jszip` 检查 `drawingCount 5`、`hasSvg true`、`hasPng true`、`containsGraphSource false`、任务列表 / 表格 / 代码文本存在，Quick Look thumbnail 可见本地 SVG、正常宽度表格、正常宽度代码块和 Mermaid 节点文字 / 边标签；WPS 复查暴露 SVG 主图文本度量偏差后，Mermaid DOCX 路径已锁定为 PNG-first；继续复查暴露复杂图被 Word 缩放后仍有文字挤压 / 线条缺失风险，因此 Mermaid PNG 改为 Prism 预览同构 DOM 截图并以 650px 上限写入 DOCX。
- `docs/verification/prism-complex-export-smoke.md` 记录 2026-05-18 导出视觉块分页保护：PDF / HTML 导出 DOM 统一标记图片、表格、代码块、Mermaid、KaTeX 和带边框 / 背景 / 阴影的原始 HTML 视觉块为 `prism-export-atomic`；WebKit PDF 主链路和 raster fallback 在捕获前按真实页高插入 spacer，避免视觉块被固定页切线切成两段；标题后紧跟原始 HTML 视觉块时会额外形成 `prism-export-atomic-group`，避免小节标题与视觉卡片跨页断开。
- `src/domains/export/exportPipeline.ts` 已修复真实 PDF / PNG 导出暴露的 `html2canvas` 现代 CSS color function 兼容问题：栅格导出 iframe 使用 raster-safe CSS，并在截图前把 computed `color(...)` 归一为 `rgb(...)` / `rgba(...)`；HTML 导出保持完整主题 CSS。
- `docs/verification/prism-pandoc-citation-html-smoke.md` 记录 Pandoc smoke 方案和本机阻塞。

### 验证强度

- 自动测试强：导出 pipeline、命令入口和设置归一化覆盖广；HTML 导出已覆盖 Pandoc 返回 HTML 的安全清理；导出进度事件、App 层进度 UI、失败诊断浮层、warning 汇总和复制路径已有回归；导出 pipeline 已从主入口 chunk 拆出，降低启动首包压力。
- 自动化产物 smoke 中等偏强：复杂 Markdown 已可生成并读取 HTML/PDF/PNG/DOCX 产物；PNG 自动化仍使用 `html2canvas` 测试替身，但真实 UI smoke 已补同一 fixture 的 PDF / PNG 文件级结果。
- 真实导出 UI smoke 较强：当前 `.app` 通过真实导出菜单生成 HTML / PDF / PNG / DOCX；PDF 用 `pdf-lib` 确认 2 页 A4，PNG 用 `sips` 确认 2054 x 3316，DOCX 用 `jszip`、`textutil` 和 Quick Look thumbnail 确认可解析、保留中文 / 表格 / 任务列表且 Mermaid 未退化为源码。DOCX 富内容 smoke 已补 SVG + PNG fallback、Mermaid 图、KaTeX / HTML drawing、表格和代码块宽度证据。独立 WebView 导出也已用真实 `.app` 复测重媒体 HTML 导出，不再长期卡在“正在渲染图表”。长文 PDF 已通过 WebKit 矢量主链路生成 51 页 A4，PDFKit 可提取正文，且不是整页 image PDF；包含 `waitForExportProgressPaint()` 修复的新构建已真实 UI 复测，不再停在“准备导出”，约 57 秒更新输出文件。
- Pandoc 真实验证弱：本机 `pandoc --version` 为 `command not found`，未生成 citeproc 实际 HTML。

### 缺口

- DOCX Mermaid、SVG、KaTeX / HTML fallback、表格 / 代码块宽度和 task list 已有自动化与真实 UI 产物级检查，确认 Mermaid 不以源码留在正文且存在 SVG / PNG media，GFM task list 保留可读勾选状态；Word / Pages 的逐页人工视觉检查仍可作为发布前补充。
- PDF / PNG 导出已通过真实 UI 文件级检查；人工逐页视觉审阅仍可作为发布前补充。
- 真实 Pandoc citeproc 依赖本机安装 Pandoc，当前阻塞。

### 下一步

导出主链路已从“弱验证”提升为 macOS 真实 UI smoke 通过；下一步应安装 Pandoc 后重跑 `docs/verification/prism-pandoc-citation-html-smoke.md`，或在发布前补 Word / Pages 人工视觉审阅。

## 8. 专业扩展

### 计划要求

- 第一版引用系统支持 BibTeX / CSL JSON 文件路径和 Pandoc citekey 语法 `[@doe2024]`。
- 设置中心配置 bibliography file 和 CSL style。
- 预览中 citekey 渲染为占位。
- Pandoc 可用时导出完整参考文献；不可用时不破坏基础导出。
- 学术模板只生成 Markdown。
- 中文排版工具只提示，不自动修改。

### 当前证据

- `src/domains/settings/types.ts` 定义 `CitationSettings`；`store.ts` 提供 `setCitationBibliographyPath`、`setCitationCslStylePath`、`setCitationSettings`。
- `src/components/shell/SettingsModal.tsx` 在导出设置区展示 Pandoc 路径、参考文献文件、CSL 样式文件，并显示引用导出就绪 / 回退提示。
- `SettingsModal.test.tsx` 覆盖引用路径展示、后缀提示、Pandoc readiness、修改和清除路径。
- `src/domains/editor/extensions/citations.ts` 识别单个、组合和 suppress-author Pandoc citekey，并支持 `/`、`+` 等更真实的 key 字符；同时要求 `@` 前处在 citation 分隔边界，避免邮箱本地部分误报。`citations.test.ts` 覆盖普通链接、方括号内邮箱、带连字符邮箱和 `mailto:` 链接不误识别。
- `src/lib/markdownToHtml.ts` 把 citekey 渲染为 `.prism-citation` 占位；`markdownToHtml.test.ts` 覆盖 `[-@doe/2024; @team+paper_2026]` 这类 suppress-author / rich citekey 占位，以及链接文字、inline code 和 fenced code block 内的 `[@key]` 不生成 citation 占位。
- `src/domains/export/exportPipeline.ts` 在 HTML 导出中尝试 `render_citations_with_pandoc`；条件不满足或失败时回退内置导出并给 warning。
- `src-tauri/src/lib.rs` 构建 `pandoc --citeproc --bibliography ... --csl ... --to html` 参数并有 Rust 单测覆盖。
- `src/domains/editor/extensions/typographyDiagnostics.ts` 检查中英文间距、中文半角标点、标题层级；`typographyDiagnostics.test.ts` 覆盖链接 / 图片目标路径不误报，并新增 1200 节、超过 10 万字符的中文长文 micro benchmark，验证扫描在 1500ms 宽松预算内完成且继续忽略 fenced code 和链接目标。
- `src/domains/editor/components/TypographyDiagnosticsPanel.tsx` 只展示提示和跳源码，不改正文；`TypographyDiagnosticsPanel.test.tsx` 覆盖 250 条诊断长列表的首尾渲染、晚段问题跳源码和 Escape 关闭。
- `src/domains/editor/extensions/templates.ts` 包含论文草稿、读书笔记、研究摘要、白皮书模板。
- `docs/verification/prism-professional-writing-smoke.md` 汇总引用、Pandoc 回退和中文排版诊断的自动化证据与真实 Pandoc 阻塞。

### 验证强度

- 自动测试中等偏强：settings、citekey、suppress-author citation、preview placeholder、export fallback、typography diagnostics 均覆盖；citekey parser 已有邮箱 / `mailto:` 误报防护回归，预览占位已有链接文字、inline code 和 fenced code block 误报防护；中文排版诊断已有 10 万字符级长文 micro benchmark，诊断面板已有 250 条长列表组件级回归。
- 真实专业导出弱：Pandoc 未安装，citeproc 未真实跑通。

### 缺口

- 没有真实 BibTeX / CSL JSON 与 CSL 样式组合的导出产物。
- 中文排版诊断已有 helper 层长文 micro benchmark 和诊断面板 250 条长列表组件回归，但没有真实编辑器输入、状态栏触发和真实滚动性能记录。

### 下一步

安装 Pandoc 后补真实 citeproc smoke；未安装前，下一批可继续补“引用诊断 / 路径校验”或诊断面板在长列表下的组件级性能证据。

## 9. 对外扩展 / 明确非目标

### 计划要求

- 先开放低风险扩展点：CLI、deep link、主题包、导出模板格式。
- 插件 API 延后；插件市场不上线前不展示入口。

### 当前证据

- `src-tauri/src/lib.rs` 已处理 Windows/Linux 命令行传入文件路径和 macOS `RunEvent::Opened` 文件打开事件。
- `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 中没有 `@tauri-apps/plugin-deep-link` / `tauri-plugin-deep-link` 依赖或配置。
- `rg 'prism://' src src-tauri docs` 只命中计划文档；没有 deep link runtime。
- `rg '插件|plugin|market' src` 未发现插件市场 UI。Tauri plugin 依赖仅是 dialog / fs / opener / updater / log 等基础能力。
- `src/domains/commands/registry.test.ts` 覆盖菜单和命令面板的负向边界：在已保存文档、工作区、上次导出记录都存在的最大可见上下文里，不出现插件市场、deep link、云同步、移动端、实时协作、图谱或完整 WYSIWYG 等延后能力入口。

### 验证强度

- “不做插件市场”有代码搜索证据和 command registry 负向 UI 入口回归。
- CLI/deep link 未实现，不能算闭环。

### 缺口

- 没有 `prism open <file>` / `prism export ...` CLI。
- 没有 `prism://open` / `prism://export` deep link。
- 主题包 / 导出模板包格式未实现。

### 下一步

按 1.0.x 核心体验排序，CLI/deep link 暂缓；等文件安全、导出主链路、发布可信和剩余桌面 smoke 完成后再拆小切片。

## 10. 本批补充：文件树空壳入口闭环

### 计划要求

- 工作区文件树的删除、重命名、复制路径、刷新、新窗口打开等用户可见入口必须有真实处理路径。
- 菜单、快捷键、命令面板和文件动作层不能出现命令漂移。
- 不保留会误导用户的“尚未实现”核心入口。

### 当前证据

- `src/lib/fileActionCommands.ts` 定义文件动作 command contract，集中列出 `openFile`、`openNewWindow`、`newFile`、`newFolder`、`rename`、`commitRename`、`duplicate`、`delete`、`openRootLocation`、`openLocation`、`copyRootPath`、`copyPath`、`properties`、`refreshFolder`、`viewList`、`viewTree`、`sortByName`、`sortByModified`、`sortByCreated`、`sortBySize`、`searchInFolder`。
- `src/lib/fileActions.ts` 复用同一 parse contract；未知命令改为“未知文件操作”，不再显示“功能尚未实现”。
- `src/lib/fileActions.ts` 删除流程改为优先调用系统废纸篓；如果 `move_path_to_trash` 失败，才展示包含“永久删除 / 不可撤销”的二次确认并调用 `remove`。
- `src-tauri/src/lib.rs` 暴露 `move_path_to_trash`；macOS 路径先使用可超时终止的 `osascript` 子进程调用 Finder 废纸篓，Finder 失败或超时后 fallback 到用户 `~/.Trash`，并为重名目标生成唯一路径；非 macOS 继续使用 Rust `trash = 4.1.1`。
- `src/domains/workspace/components/fileTreeContextMenu.ts` 把文件树背景、文件项、文件夹项、状态栏工作区菜单的 ContextMenu 动作集中为一个纯构造器。
- `src/domains/workspace/components/FileTree.tsx` 和 `src/App.tsx` 已共用该菜单构造器，减少状态栏工作区菜单与文件树菜单漂移。
- `src/lib/fileActionCommands.test.ts` 覆盖 action 解析、Windows 路径、支持命令识别和未知命令文案。
- `src/lib/fileActions.test.ts` 覆盖首次取消不删除任何内容、废纸篓优先、废纸篓失败后取消永久删除、废纸篓失败后二次确认永久删除。
- `src/domains/workspace/components/fileTreeContextMenu.test.ts` 覆盖工作区背景、文件项、文件夹项菜单的所有 action 都能被文件动作 contract 识别。
- `src/domains/workspace/hooks/useWorkspaceFocusRefresh.ts` 在已有工作区重新聚焦或页面重新可见时静默重扫文件树，作为第一版工作区文件监控；`useWorkspaceFocusRefresh.test.tsx` 覆盖 focus 刷新、无工作区跳过、陈旧 root 结果忽略和 visible 恢复刷新。
- `docs/verification/prism-file-actions-smoke.md` 记录文件动作真实桌面 smoke 协议，以及 macOS Prism `.app` 文件树删除到 `~/.Trash` 的复测证据。

### 验证强度

- 自动测试中等偏强：新增 contract 测试能阻止菜单 action 漂移回到未知文件动作；删除流程已有首次取消、废纸篓优先和永久删除 fallback 回归；工作区聚焦刷新已有 hook 级回归。
- Rust 编译中等偏强：`cargo test` 和 `cargo check` 已覆盖新增 Tauri command 的编译链路；`move_path_to_trash` 已覆盖不存在路径拒绝，系统废纸篓子进程正常返回、超时 kill 分支和 macOS `~/.Trash` fallback 重名保护。
- 系统废纸篓自动化 smoke 受阻：直接运行旧 macOS `trash::delete` smoke 会卡在 Finder `osascript ... delete` 超过 60 秒，已记录在 `docs/verification/prism-file-actions-smoke.md`；当前实现已把 Finder 不响应从“让前端进入永久删除二次确认 fallback”升级为“先尝试 `~/.Trash` 文件移动 fallback”，只有 Finder 与 fallback 都失败时才进入永久删除二次确认。
- 真实桌面行为已有 macOS 删除主链路证据；重命名、新窗口打开、复制路径和打开位置在真实 macOS / Windows 文件管理器中的行为仍需人工确认，Windows 系统废纸篓仍需 Windows 机器验证。

### 缺口

- macOS Prism `.app` 文件树删除到 `~/.Trash` 已通过真实 UI smoke；Windows Explorer 废纸篓结果仍未真实验证。
- 文件动作真实桌面 smoke 仍未完整覆盖，尤其是 Windows Explorer 的打开位置和路径复制，以及 macOS 的重命名、创建副本、复制路径、打开位置逐项验证。

### 下一步

短期不继续扩展文件树功能；macOS 删除到废纸篓主链路已经补强，下一批应转向写作效率桌面 smoke 或预览真实输入 / 性能 smoke。Windows 机器验证完成前，不能宣称系统废纸篓在 macOS / Windows 桌面都已闭环。

## 11. 后续执行建议

建议只选一个 checkpoint 继续，优先级如下：

1. **写作效率桌面 smoke**
   `docs/verification/prism-writing-efficiency-smoke.md` 已补 smoke 协议和检查表，macOS 图片粘贴、快速打开、链接补全/诊断、表格、列表、模板、大纲和选区统计已回填真实 `.app` 证据；Finder 拖拽当前自动化无法安全完成，下一步需要人工 smoke 或更可靠跨应用拖拽工具，Windows Explorer 图片拖拽和 Alt 原路径仍需 Windows 机器。价值是把剩余图片拖拽系统事件证据提升为真实桌面工作流验证。

2. **预览真实输入 / 性能 smoke**
   `docs/verification/prism-preview-sync-smoke.md` 已补长文 drift、输入撤销、键盘跳转、重媒体显示和键盘突发输入真实 `.app` 证据，并消除了本地图片资产的链接诊断假阳性；下一步仅剩 30 秒人工输入、帧率和 CPU 量化。价值是把预览同步从滚动 / 点击证据提升到真实写作过程证据。

3. **文件动作剩余桌面 smoke**
   `docs/verification/prism-file-actions-smoke.md` 已补 macOS Prism UI 删除到废纸篓证据；剩余价值集中在 Windows Explorer 废纸篓 / 打开位置、复制路径，以及 macOS 文件夹删除、重命名、创建副本等逐项真实桌面确认。

不建议下一批直接做 CLI/deep link 或主题包；它们属于外扩能力，不是核心 1.0.x 本地写作体验闭环的首要风险。

## 12. Completion audit 刷新

2026-05-15 重新按 active goal 做完成度审计，结论仍是 **不能标记完成**。

### 成功标准拆解

- 文件安全：不能丢稿；保存失败、外部修改、recovery、权限 scope 和删除行为有可靠证据。
- 写作效率：图片、链接、表格、列表、模板、快速打开和字数统计有真实编辑器路径证据。
- 预览同步：source-line、点击跳源码、双向滚动、错误诊断和长文性能有可复现证据。
- 导出工作台：HTML / PDF / PNG / DOCX pipeline、失败诊断和复杂产物可信。
- 专业扩展：citekey、Pandoc 回退、设置中心和中文排版诊断可用。
- 对外扩展：CLI / deep link / 主题包 / 模板包未进入核心闭环；插件市场是明确非目标。
- 验证 gate：每批至少 `npm test -- --run`、`npm run build`、`git diff --check` 通过；涉及 Tauri / Rust / capabilities 时补 Tauri 或 Rust gate。

### 最新证据

- `src/App.recovery.test.tsx` 覆盖 recovery modal App 接线、导出进度 UI 和导出失败诊断浮层。
- `src/domains/document/hooks/useAutoSave.test.tsx` 覆盖自动保存关闭时仍生成 recovery 快照，且不调用磁盘 stat、原文件写入或 recovery 清理。
- `docs/verification/prism-recovery-crash-smoke.md` 记录 macOS App-only 真实 crash / restart recovery smoke：真实编辑生成 recovery、原文件未写回、`kill -9` 后重启显示恢复提示、恢复后保持未保存、显式保存清理 recovery、再次重启不再提示。
- `src/domains/commands/registry.test.ts` 覆盖导出进度事件接线、成功 / 失败后的进度清理，以及导出失败诊断中的 warning 汇总。
- `src/lib/fileActions.test.ts` 覆盖删除流程首次取消、废纸篓优先、废纸篓失败后取消永久删除和废纸篓失败后二次确认永久删除。
- `src-tauri/src/lib.rs` 覆盖 macOS `~/.Trash` fallback 重名保护；`docs/verification/prism-file-actions-smoke.md` 记录真实 Prism `.app` 文件树删除到 `~/.Trash` 的 UI smoke。
- `src/domains/editor/components/EditorPane.integration.test.tsx` 覆盖 CodeMirror 命令事件、剪贴板图片 paste、普通图片 drop、Alt / Option drop、Alt / Option 缺路径提示、列表 keymap 按键路径、Markdown 链接补全上下文和 `[[note]]` wiki 内链补全上下文。
- `docs/verification/prism-writing-efficiency-smoke.md` 记录 macOS 真实 `.app` 系统剪贴板图片粘贴、快速打开键盘、链接补全/诊断、表格格式化、列表续写/退出、PRD 模板插入、大纲搜索和选区统计 smoke。
- `src/lib/markdownToHtml.test.ts` 覆盖 10 万字符级 Markdown -> HTML 长文 smoke，以及链接文字、inline code、fenced code block 内 `[@key]` 不生成 citation 占位。
- `src/domains/editor/components/PreviewPane.test.tsx` 覆盖 debounce 内容更新后的 source-line DOM 锚点刷新。
- `src/domains/editor/components/SplitView.test.tsx` 覆盖重媒体 preview DOM 的 round-trip drift 和映射耗时预算；`SplitView.tsx` 已移除 scroll 回算中的全量 `getComputedStyle` 读取。
- `docs/verification/prism-preview-sync-smoke.md` 记录 macOS 真实 `.app` 长文预览 drift smoke：分栏长文打开、源码/预览滚动同步到同章节区间、预览点击第 28 节跳源码、尾部 Mermaid / KaTeX 错误区不导致整篇预览空白。
- `src/domains/editor/extensions/typographyDiagnostics.test.ts` 覆盖 10 万字符级中文排版诊断 micro benchmark。
- `src/domains/editor/components/TypographyDiagnosticsPanel.test.tsx` 覆盖 250 条诊断长列表的首尾渲染、晚段跳源码和 Escape 关闭。
- `src/domains/settings/normalize.test.ts` 覆盖旧 `settingsVersion` 配置升级到当前版本、旧字体字段迁移到 `FontSource`、临时 PDF 页眉页脚字段迁移到通用页面字段且不泄漏旧 key，以及缺失 Pandoc / citation / exportHistory / lastSession 时回填安全默认值。
- `src/domains/commands/exportCommand.integration.test.ts` 覆盖命令入口四格式导出：`exportHtml`、`exportPdf`、`exportPng`、`exportDocx` 都通过真实 export domain 写出产物并记录 history。
- `docs/verification/prism-complex-export-smoke.md` 记录真实 Prism UI 四格式导出 smoke：通过当前 `.app` 应用内导出菜单生成 HTML / PDF / PNG / DOCX；PDF 为 2 页 A4，PNG 为 2054 x 3316，DOCX 可由 `jszip`、`textutil` 和 Quick Look 解析，Mermaid 未退化为源码；本轮同时修复 PDF / PNG 栅格导出对现代 CSS color function 的兼容性问题。2026-05-17 补充独立导出 WebView 卡死修复 smoke：重媒体 HTML 导出曾 20 分钟超时，修复后几秒内生成 `preview-heavy-webview-smoke-fixed.html`，含 20 个 Mermaid SVG 和 1 个单图 fallback。
- `docs/verification/prism-professional-writing-smoke.md` 补齐专业写作能力 smoke 入口。
- `src/domains/commands/registry.test.ts` 覆盖插件市场、deep link、云同步、移动端、实时协作、图谱和完整 WYSIWYG 等延后能力不会出现在菜单或命令面板。
- 最新验证：导出聚焦测试 `npm test -- --run src/domains/export/exportPipeline.test.ts` 通过 1 file / 45 tests；`npm test -- --run --maxWorkers=1` 通过 59 files / 362 tests；`npm run build` 通过，仅有既有 Vite large chunk warning；`git diff --check` 通过；`npm run tauri:build:app-smoke` 通过。

### 未完成项

- macOS 文件树删除到系统废纸篓已通过真实桌面 smoke；Windows 废纸篓、Finder / Explorer 拖拽、Option / Alt 原路径和文件动作剩余分支仍需真实桌面 smoke。系统剪贴板图片粘贴、链接补全/诊断、表格、列表、模板、大纲和选区统计已有 macOS 真实 `.app` smoke，但 Windows 剪贴板和 Windows 写作效率桌面路径未验证。
- 预览真实 viewport drift、单次输入 / undo、键盘跳转、重媒体显示和 System Events 键盘突发输入已补 macOS `.app` 证据；仍缺 30 秒人工输入、帧率和 CPU 量化，不能宣称性能基准闭环。
- 本机未安装 Pandoc，真实 BibTeX / CSL citeproc HTML 未验证。
- Apple Developer ID 签名、公证、Windows installer / updater / 文件关联仍是发布环境阻塞。

### 结论

当前状态已经满足新版 goal 的停止条件 2：本机可执行 checkpoint 已推进到只剩外部 / 人工阻塞。自动化 proxy 和 macOS 真实 `.app` smoke 已覆盖较多核心分支；下一步最有价值的是在具备对应环境后补真实桌面验证、Pandoc citeproc、签名公证和 Windows 发布链路。产品全量仍不满足“无剩余必需工作”，不能把它说成所有任务全部完成。
