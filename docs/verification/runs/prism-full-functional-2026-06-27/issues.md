# Prism 全功能测试问题记录

日期：2026-06-27
App：/Applications/Prism.app
Bundle ID：com.prism.editor.v1
版本：1.4.1
测试工作区：/tmp/prism-full-functional-test-workspace

> 本轮只测试、不修复。所有问题按功能域分组记录；没有问题的功能域暂不列入。

## 记录格式

- 严重度：P0/P1/P2/P3
- 用例 ID：
- 触发动作：
- 问题表现：
- 预期表现：
- 复现稳定性：
- 截图/证据：
- 备注：

## 2026-06-30 修复批次更新

- 已打包并替换 `/Applications/Prism.app`；安装包身份为 `com.prism.editor.v1`，包含 Markdown 文档图标和 `Resources/Initial` 首启文档资源。
- `npm run tauri:build:app-smoke` 通过，构建产物 smoke 覆盖启动、诊断、Quick Open、保存、导出菜单、设置和复杂导出产物。
- `PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs` 通过，安装版 smoke 覆盖 `.markdown` 中文/空格路径、JSON、SQL、TXT、Markdown 启动不白屏，ERROR 状态栏诊断可打开，Quick Open 可打开目标文件，基础编辑保存和 HTML/PDF/PNG/DOCX 复杂导出产物通过。
- 本批次不能直接把历史全功能截图 Fail 改为 Pass；下面各问题的原始复现证据保留。后续要按原用例逐条重拍真实 UI 截图后再更新单项状态。

## 启动与窗口

### P0-STARTUP-001 原生 Prism/Tauri 均无法创建可见窗口

- 严重度：P0
- 用例 ID：PRISM-FF-001、PRISM-FF-002、PRISM-FF-003、PRISM-FF-004、PRISM-FF-005、PRISM-FF-006
- 触发动作：
  1. 结束 `/Applications/Prism.app/Contents/MacOS/app` 后执行 `open -b com.prism.editor.v1`。
  2. 执行 `open -b com.prism.editor.v1 /tmp/prism-full-functional-test-workspace/Examples/Prism Markdown 语法指南.md`。
  3. 通过 AppleScript 发送 `Cmd+Shift+N`、点击 Window 菜单中的 `Prism` 项。
  4. 使用临时可见窗口配置运行 `npx tauri dev --config docs/verification/runs/prism-full-functional-2026-06-27/tauri.visible-test.conf.json`。
- 问题表现：
  - Prism 进程存在，系统菜单栏存在，但 Accessibility 层显示 `application process "app"` 的窗口数为 0。
  - 前台进程一直保持为 `EasyConnect`，`tell application id "com.prism.editor.v1" to activate` 无法把 Prism 带到前台。
  - 主菜单退化为系统默认项：File 只剩 `Close Window/Close All`，没有新建、打开、保存、导出等 Prism 自定义命令。
- 预期表现：启动后直接显示 Prism 主窗口，加载 `/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md` 或显式打开的文件；新建窗口命令可创建窗口。
- 复现稳定性：本轮多次稳定复现；安装包与开发版 Tauri 均复现。2026-06-27 15:03 追加复核时，`tell application id "com.prism.editor.v1" to activate` 后前台仍为 `EasyConnect`，Accessibility 仍显示 `app frontmost=false windows=0 visible=true`。
- 截图/证据：
  - `screenshots/00-pipeline/PRISM-PIPELINE-relaunch.png`
  - `screenshots/00-pipeline/PRISM-PIPELINE-visible-dev.png`
  - `screenshots/00-pipeline/PRISM-PIPELINE-native-window-recheck.png`
  - `screenshots/00-pipeline/PRISM-PIPELINE-native-window-recheck-150348.png`
  - `logs/relaunch.log`
  - `logs/visible-dev-window-check.log`
  - `logs/menu-enumeration.log`
  - `logs/native-window-recheck-*.log`
- 备注：当前会话只有 Computer Use skill 文档，没有可调用的读屏/点击 MCP；项目 AGENTS 同时要求不要默认走工具发现。当前无法完成真正的 Computer Use 原生窗口全量测试；后续截图使用 Playwright + Tauri IPC mock 作为前端补充证据，不替代原生窗口验证。

### P0-STARTUP-001 复测更新：原生窗口与 Computer Use 已恢复可测

- 严重度：记录更新
- 用例 ID：PRISM-FF-001、PRISM-FF-002、PRISM-FF-003、PRISM-FF-004、PRISM-FF-005、PRISM-FF-006
- 触发动作：
  1. 2026-06-29 使用 Computer Use `list_apps` 确认 `/Applications/Prism.app` 正在运行。
  2. 使用 Computer Use `get_app_state` 读取 `Prism` 窗口。
  3. 使用 Computer Use 点击 `编辑 / 分栏 / 预览`、窗口内菜单、设置弹窗和文档区域。
- 问题表现：
  - 旧记录中的“原生窗口不可见、Computer Use 不可用”在本轮不再成立。
  - 当前真实 App 可见，AX 可读到 WebView、文件树、模式切换按钮、菜单、编辑区、预览 heading/list/link、状态栏和导出按钮。
- 预期表现：保留当前可测状态；后续报告不应继续把原生启动作为当前 P0 阻塞。
- 复现稳定性：本轮稳定可读、可点击。
- 截图/证据：
  - Computer Use 实时截图：编辑态、预览态、分栏态、设置弹窗、菜单、图表区域均在本轮工具结果中可见。
  - `screenshots/15-computer-use-real-app/PRISM-CU-036-split-plantuml-markmap-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-040-menu-file-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-050-settings-general-window.png`
  - `logs/computer-use-real-app/screencapture-D1.err`
  - `logs/computer-use-real-app/screencapture-D2.err`
- 备注：截图文件落盘另见 `P1-PLATFORM-001`。

### P0-STARTUP-002 从临时文件切回默认指南后 Prism 进入无窗口状态

- 严重度：P0
- 用例 ID：PRISM-FF-002、PRISM-FF-003、PRISM-FF-004、PRISM-FF-005
- 触发动作：
  1. 通过真实 `/Applications/Prism.app` 打开 `/tmp/prism-cu-functional/task-checkbox-test.md`，切到预览态并点击任务复选框。
  2. 使用 `open -b com.prism.editor.v1 '/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md'` 尝试切回默认指南文档。
  3. 使用 Computer Use 读取 `Prism` 窗口，并用 System Events 检查底层 `app` 进程窗口数。
  4. 复核 `open /Applications/Prism.app`、`Cmd+Shift+N`、`Cmd+N`、`open -n /Applications/Prism.app`、`open -n -b com.prism.editor.v1 <md file>`。
  5. 用临时 `HOME=/tmp/prism-clean-home-for-window-test` 直接执行 `/Applications/Prism.app/Contents/MacOS/app`，排除真实用户配置污染。
  6. 对无窗口进程执行 `sample`，并枚举系统菜单。
- 问题表现：
  - Prism 进程仍存在且系统进程名为 `app`，但 Accessibility 显示 `windows=0`。
  - Computer Use 返回 `cgWindowNotFound`，无法继续读屏、点击或截图具体窗口。
  - 新实例启动后也出现多个 `/Applications/Prism.app/Contents/MacOS/app` 进程，但每个进程窗口数都是 0。
  - 快捷键 `Cmd+Shift+N` 与 `Cmd+N` 均未创建新窗口。
  - 临时 HOME 启动会复制首启文档、生成临时配置，但仍然 `windows=0`，说明不是用户真实 Prism 配置损坏导致。
  - 进程采样显示主线程在 AppKit event loop 中等待事件，WebKit 线程存在，未崩溃。
  - 无窗口状态下系统菜单退化为默认菜单：`File` 只有 `Close Window / Close All`，没有 Prism 自定义的新建、打开、保存、导出等菜单。
  - 源码/配置侧线索：`src-tauri/tauri.conf.json` 中主窗口 `visible: false`，macOS 依赖 `Reopen/Opened` 事件调用 `show_main_window`；当前测试中 `activate/reopen/open file` 均未让隐藏窗口显示。
- 预期表现：切换打开文件或重启后应始终显示 Prism 主窗口；如果恢复上次工作区失败，也应直接打开默认 Prism 指南文档，不应留下无窗口进程。
- 复现稳定性：2026-06-29 本轮真实 App 复现一次，随后多种恢复方式均未恢复窗口。
- 截图/证据：
  - `logs/computer-use-real-app/windowless-after-file-switch.log`
  - `logs/computer-use-real-app/direct-executable-launch.log`
  - `logs/computer-use-real-app/direct-clean-home-launch.log`
  - `logs/computer-use-real-app/windowless-sample.txt`
- 备注：原 `PRISM-CU-099-windowless-after-file-switch.png` 已归档到 `logs/computer-use-real-app/invalid-d1-screenshots-20260629/`，属于抓错显示器的测试证据，不再作为 manifest 截图。该问题在历史测试后半段阻止继续使用 Computer Use；本轮 16:49 以后真实窗口已恢复，需专项复测确认是否仍可复现。

#### 2026-06-29 13:29 复核

- 触发动作：清理 Prism 测试进程后执行 `open /Applications/Prism.app`，等待 2 秒，再用 System Events 和 Computer Use 读取窗口状态。
- 问题表现：`/Applications/Prism.app/Contents/MacOS/app` 进程存在，System Events 显示 `frontmost=false windows=0`；Computer Use 对 `/Applications/Prism.app` 返回 `cgWindowNotFound`。
- 结论：该复核当时阻塞成立；但本轮 16:49 以后真实 Prism 窗口已恢复，当前测试不再被该问题阻塞。窗口生命周期仍需作为独立 P0 风险复测。

### P0-STARTUP-003 启动/新窗口没有直接打开默认 Prism 指南

- 严重度：P0
- 用例 ID：PRISM-FF-001
- 用户影响：用户每次启动或新建窗口后看到空正文和“未命名”，无法直接进入内置示例文档；这也不符合首启文档体验设计。
- 触发动作：
  1. 启动或激活真实 `/Applications/Prism.app`。
  2. 观察窗口左侧文件树、标题栏和正文区域。
- 问题表现：左侧已显示 `/Users/Alex/Documents/Prism` 文件树，但正文区域为空，标题为“未命名”，没有直接打开 `Examples/Prism Markdown 语法指南.md`。
- 预期表现：启动和新建窗口应直接打开用户目录下的 Prism 文件夹，并默认展示 `Examples/Prism Markdown 语法指南.md`；如 macOS 授权需要等待，也应授权通过后再显示文档窗口。
- 复现稳定性：2026-06-30 真实 App + Computer Use 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-218-startup-default-guide-not-opened-window.png`
- 建议修复方向：收敛启动 bootstrap 与新窗口逻辑，避免先创建空文稿；在默认 Prism 目录存在时优先打开指南文档并同步文件树选中态。
- 验收标准：冷启动、新建窗口、恢复窗口三条路径均直接展示指南文档；标题栏显示指南文件名，正文不出现空指引页或“未命名”空文稿。
- 修复进展：2026-06-30 源码已修复默认窗口路径：`openNewWindow` 不再把当前 workspace folder 固定传给新窗口，默认新窗口交给 bootstrap 打开 Prism 初始目录和指南；bootstrap 在已有 currentDocument 时仍 reveal native window。`useBootstrap`、`fileActions`、`openWindow` 相关测试通过。安装版 smoke 已通过默认启动路径，证据见 `screenshots/16-installed-app-smoke/00-launch-markdown-chinese-space.png`、`screenshots/16-installed-app-smoke/01-launch-source.png` 和 `logs/app-smoke-installed-20260630/report.json`；新建窗口仍需按原用例单独复测。

## 文件与工作区

### P0-FILE-001 默认指南文档自带链接诊断 ERROR

- 严重度：P0
- 用例 ID：PRISM-FF-002、PRISM-FF-038、PRISM-FF-049、PRISM-FF-051
- 触发动作：通过测试 mock 打开 `Examples/Prism Markdown 语法指南.md`，查看状态栏并点击 `ERROR 1`。
- 问题表现：状态栏显示 `ERROR 1`；诊断弹窗显示目录链接 `#文本格式` 未找到标题锚点。
- 预期表现：默认/首启指南文档不应自带 ERROR；目录链接应全部可解析，避免导出 preflight 被误拦截。
- 复现稳定性：稳定复现。
- 截图/证据：
  - `screenshots/06-diagnostics/PRISM-FF-049-case-49.png`
  - `screenshots/06-diagnostics/PRISM-FF-051-heading-table-render-heading-table-render.png`
  - `logs/elements-startup.json`
- 备注：这与用户此前反馈“正常预览的指南文档不应显示错误”一致。
- 修复进展：2026-06-30 源码回归已覆盖打包资源 `src-tauri/resources/Initial/Examples/Prism Markdown 语法指南.md`：新增测试确认目录中的同文档链接不会产生 `missing-heading` 诊断，尤其是 `#文本格式`。当前仓库资源和用户目录 `/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md` 均包含对应 `## 文本格式` 标题；待换包后用真实状态栏逐项复测是否仍显示 `ERROR 1`。

### P0-FILE-002 真实 App 通过系统打开 JSON/SQL/TXT 会进入空白白屏窗口

- 严重度：P0
- 用例 ID：PRISM-FF-008
- 触发动作：
  1. 使用真实 `/Applications/Prism.app` 打开测试 fixture `real-open-markdown.md`，确认 Markdown 文档可正常进入编辑态。
  2. 在 Prism 已有窗口状态下执行 `open -b com.prism.editor.v1 real-open-json.json`。
  3. 退出 Prism 后分别冷启动执行 `open -b com.prism.editor.v1 real-open-json.json`、`real-open-sql.sql`、`real-open-txt.txt`。
- 问题表现：
  - Markdown fixture 可正常打开，状态栏显示 `Markdown 文稿`。
  - JSON/SQL/TXT 均出现空白白屏窗口，无标题、无编辑区、无状态栏，也无法验证普通文本模式。
  - 打开 JSON 时曾出现多个 Prism 窗口重叠，其中白屏窗口与原 Markdown 窗口同时存在，说明不是单纯截图抓错窗口。
- 预期表现：`.json`、`.sql`、`.txt` 应进入普通文本编辑模式；状态栏显示文本类型；Markdown 专属预览/图谱/导出能力应禁用或显示清楚原因。
- 复现稳定性：2026-06-29 真实 App 多次复现，包含已有窗口打开与冷启动打开。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-100-open-markdown-file-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-101-open-json-file-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-102-open-json-second-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-104-cold-open-json-file-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-105-cold-open-sql-file-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-106-cold-open-txt-file-window.png`
- 备注：browser mock 中 Text Document 通过结果不代表真实 `/Applications/Prism.app` 的系统打开路径。
- 修复进展：2026-06-30 源码已修复启动 listener 与 bootstrap 的竞争路径：运行期 `file-opened` listener 不再抢冷启动 pending files，bootstrap 在文档已由启动 listener 打开时仍会 reveal native window。已补 `useBootstrap` / `useAppFileActionsModel` 回归测试并通过；重新打包替换 `/Applications/Prism.app` 后，安装版 smoke 已通过 JSON/SQL/TXT 启动不白屏，证据见 `screenshots/16-installed-app-smoke/00b-launch-json.png`、`screenshots/16-installed-app-smoke/00c-launch-sql.png`、`screenshots/16-installed-app-smoke/00d-launch-txt.png` 和 `logs/app-smoke-installed-20260630/report.json`。

### P0-FILE-003 外部修改冲突未弹出处理入口

- 严重度：P0
- 用例 ID：PRISM-FF-015
- 触发动作：
  1. 打开专用 fixture `fixtures/computer-use-real-app/real-conflict.md`。
  2. 第一次从终端向磁盘文件追加外部内容，观察 Prism 聚焦后的行为。
  3. 第二次先在 Prism 编辑器中输入 `Local unsaved edit before disk mutation.`，制造本地 dirty 状态。
  4. 再从终端向同一文件追加 `Second external mutation while Prism is dirty.`，等待 10 秒。
- 问题表现：
  - 第一次外部追加后，Prism 直接把外部新增行读入编辑器，没有冲突提示。
  - 第二次在 dirty 状态下发生外部修改后，仍没有出现冲突弹窗或冲突状态入口。
  - 编辑器最终同时包含本地行和外部行，并恢复为已保存状态。
- 预期表现：本地未保存内容与磁盘外部修改同时存在时，应出现冲突状态和处理弹窗，不应静默合并为已保存状态；用户应能选择保留本地、加载磁盘或另存。
- 复现稳定性：2026-06-30 真实 `/Applications/Prism.app` + Computer Use 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-187-conflict-baseline-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-188-conflict-not-shown-auto-merged-window.png`
  - `logs/computer-use-real-app/external-conflict-check.log`
- 备注：该测试只操作本次 verification fixture，不涉及用户真实文档。
- 修复进展：2026-06-30 源码已强化 `useExternalFileChangeMonitor`：检查时读取当前 store 中最新的 dirty/snapshot 状态，dirty 文档新增 1 秒快速冲突巡检，并在页面重新可见时触发检查。相关外部修改、autosave 和冲突弹窗单测通过；待换包后用 `real-conflict.md` 真实复测。

### P1-FILE-004 Prism 内缺少文件属性/信息入口

- 严重度：P1
- 用例 ID：PRISM-FF-095
- 触发动作：
  1. 在真实 `/Applications/Prism.app` 中打开测试工作区文件 `real-wiki-target.md`。
  2. 在文件树当前文件上打开右键菜单。
  3. 打开主窗口“文件”菜单。
- 问题表现：
  - 文件树右键菜单只提供打开、在新窗口中打开、重命名、创建副本、删除、复制文件路径、在访达中显示。
  - 主“文件”菜单只提供新建文稿、打开文件、打开文件夹、最近打开、保存、另存为、在访达中显示、设置、关闭文稿。
  - 没有属性/信息/显示简介类入口，用户无法在 Prism 内查看当前文件名称、完整路径、类型、大小、创建/修改时间等信息。
- 预期表现：Prism 应提供可发现的文件属性入口，至少能显示名称、路径、类型、大小、创建时间、修改时间，并允许复制路径。
- 复现稳定性：2026-06-30 真实 App + Computer Use 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-210-file-tree-context-menu-no-properties-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-211-file-menu-no-properties-action-window.png`
- 建议修复方向：在文件树右键菜单或“文件”菜单加入“显示简介/文件信息”，复用已有文件元数据读取能力；如果仅保留系统 Finder 信息，也应在 Prism 中明确入口和反馈。
- 验收标准：从文件树或主菜单能打开属性面板，显示名称、完整路径、类型、大小、创建时间、修改时间；关闭面板后不改变当前文档。

## 标题栏、状态栏与窗口壳

### P1-PLATFORM-001 当前 shell 进程无法把真实 App 截图落盘

- 严重度：P1
- 用例 ID：真实 App 全功能截图批次
- 触发动作：
  1. Prism 窗口可见且 Computer Use 可读屏后，执行 `screencapture -x`、`screencapture -x -D 1`、`screencapture -x -D 2`、`screencapture -x -R0,0,800,600`。
  2. 尝试用 Swift `ScreenCaptureKit` 对 Prism 窗口截图。
- 问题表现：
  - `screencapture` 返回 `could not create image from display` 或 `could not create image from rect`。
  - `ScreenCaptureKit` 返回 `SCStreamErrorDomain Code=-3801`，描述为用户拒绝了应用程序、窗口、显示器捕捉的 TCC。
  - Computer Use 工具本身能看到窗口截图，但当前没有可直接保存该截图到仓库文件的暴露接口。
- 预期表现：测试执行环境应能保存真实 Prism 窗口截图到 `screenshots/15-computer-use-real-app/`，供宣传动图素材使用。
- 复现稳定性：本轮稳定复现。
- 截图/证据：
  - `logs/computer-use-real-app/screencapture-D1.err`
  - `logs/computer-use-real-app/screencapture-D2.err`
  - 终端输出：`用户拒绝了应用程序、窗口、显示器捕捉的TCC`
- 备注：需要给当前执行截图命令的宿主进程授予 macOS“屏幕录制”权限，或提供 Computer Use 截图落盘接口。该问题阻止“截图文件”交付，但不阻止本轮通过 Computer Use 实时读屏继续做功能验证。

### P1-PLATFORM-001 复测更新：截图落盘权限已恢复，改用窗口级截图

- 严重度：记录更新
- 用例 ID：真实 App 全功能截图批次
- 触发动作：2026-06-29 在 Prism 真实窗口可见时，先用 CoreGraphics 枚举 Prism 窗口 id `3505`，再执行 `screencapture -x -l 3505 <png>`。
- 问题表现：窗口级截图命令成功生成 PNG，典型尺寸为 `2424x1744`；当前 `screenshots/15-computer-use-real-app/` 下有 79 张 `PRISM-CU-*.png`。
- 预期表现：后续真实 UI 状态可继续按功能命名截图落盘。
- 复现稳定性：本轮稳定生成窗口级截图。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-036-split-plantuml-markmap-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-083-file-tree-file-context-menu-window.png`
- 备注：此前 `3456x2234` 的 D1 整屏误截图已移动到 `logs/computer-use-real-app/invalid-d1-screenshots-20260629/`，不进入 manifest。

## 编辑器与表格

### P1-EDITOR-001 文档搜索关闭后命中高亮残留

- 严重度：P1
- 用例 ID：PRISM-FF-022、PRISM-FF-059、PRISM-FF-060
- 触发动作：
  1. 在真实 Prism 分栏模式下按 `Cmd+F`。
  2. 点击搜索框并输入 `Markdown`。
  3. 确认搜索条显示 `1/5`，编辑区和预览区出现绿色高亮。
  4. 按 `Escape` 关闭搜索条，再点击正文空白处。
- 问题表现：
  - 搜索条消失，但编辑区和预览区中的绿色命中高亮仍然保留。
  - 选区浮动格式工具条也保持在编辑区上方，第二次 `Escape` 后仍未关闭。
  - 触发 `编辑 > 替换` 后，替换浮层可打开；但关闭替换面板后，右上角替换浮层、搜索高亮、选区工具条会跨文档属性/链接/反链/帮助弹窗继续残留。
  - 在预览模式下触发替换可正确自动切回分栏并打开替换面板，但残留状态仍未清理。
- 预期表现：关闭搜索后应清除搜索命中高亮；选区工具条应在 Escape 或失焦后消失，避免用户误以为搜索仍处于激活态。
- 复现稳定性：本轮真实 App 多次复现。
- 截图/证据：Computer Use 实时截图显示 `Markdown` 命中 `1/5` 与关闭后残留高亮。
- 备注：中文关键词 `精卫` 在 Computer Use 输入路径下没有进入搜索框，本轮暂按自动化输入法限制处理，不单独归为产品缺陷。

### P1-EDITOR-002 文档搜索与全文搜索可同时叠加显示

- 严重度：P1
- 用例 ID：PRISM-FF-022、PRISM-FF-059、PRISM-FF-060
- 触发动作：
  1. 使用 `Cmd+F` 打开文档内搜索并搜索 `Markdown`。
  2. 通过 `导航 > 全文搜索` 打开工作区全文搜索。
- 问题表现：
  - 全文搜索面板正常出现，并能按 `Prism` 过滤工作区结果。
  - 右上角文档内搜索条没有自动关闭，两个搜索 UI 同时显示。
  - `Esc` 关闭全文搜索后，文档搜索条、命中高亮和选区工具条仍残留。
- 预期表现：打开全文搜索时应收起文档内搜索，或明确管理两者层级与焦点；关闭任一搜索模式后应恢复干净阅读/编辑状态。
- 复现稳定性：本轮真实 App 复现一次。
- 截图/证据：Computer Use 实时截图可见全文搜索浮层与右上角文档搜索条同时存在。
- 备注：`Cmd+Shift+F` 在 Computer Use 路径下先触发了文档搜索，随后通过菜单可打开全文搜索；需用人工键盘复核快捷键本身是否也存在路由问题。

### P0-EDITOR-003 预览态任务列表复选框真实可点击并写回文件

- 严重度：记录更新
- 用例 ID：PRISM-FF-029、PRISM-FF-038
- 触发动作：
  1. 创建临时文件 `/tmp/prism-cu-functional/task-checkbox-test.md`，内容包含 `- [ ] preview checkbox target` 与 `- [x] already done`。
  2. 用真实 Prism 打开临时文件并切到预览模式。
  3. 点击第一个未完成任务复选框。
  4. 等待自动保存后读取临时文件。
- 问题表现：预览态复选框从未勾选变为勾选，标题栏短暂显示未保存；自动保存后文件内容变为 `- [x] preview checkbox target`。
- 预期表现：这与用户期望一致：任务列表勾选发生在预览态，并写回 Markdown 源文件。
- 复现稳定性：本轮真实 App 复现一次。
- 截图/证据：
  - `/tmp/prism-cu-functional/task-checkbox-test.md`
- 备注：这是通过项记录，用于覆盖此前“预览态不能勾选”的回归风险。此前对应整屏截图已因抓错显示器归档到 `logs/computer-use-real-app/invalid-d1-screenshots-20260629/`，不再作为 manifest 证据。

### P0-EDITOR-004 真实编辑区复制/粘贴链路未把选区写入系统剪贴板

- 严重度：P0
- 用例 ID：PRISM-FF-025
- 触发动作：
  1. 打开 `fixtures/computer-use-real-app/real-editing-commands.md`。
  2. 在编辑器中输入 `Gamma line inserted for undo redo verification.`。
  3. 按 `Cmd+Z` 和 `Cmd+Shift+Z` 验证撤销/重做。
  4. 选择 `Alpha line for copy paste testing.`，确认选区格式工具条显示。
  5. 按 `Cmd+C` 后检查系统剪贴板是否包含选中文本。
  6. 将光标放到文档末尾，按 `Cmd+V` 尝试粘贴。
- 问题表现：
  - 撤销/重做均可生效。
  - 选区工具条可见，说明编辑器识别了文本选区。
  - `Cmd+C` 后系统剪贴板不包含 `Alpha line for copy paste testing.`。
  - `Cmd+V` 触发系统 `Paste` 菜单，但没有把 Alpha 行插入到文档中。
- 预期表现：复制应把当前选区写入系统剪贴板；粘贴应在光标处插入剪贴板文本；剪切、复制、粘贴、全选等基础编辑命令应与系统文本编辑器行为一致。
- 复现稳定性：2026-06-30 真实 `/Applications/Prism.app` + Computer Use 复测一次。由于剪贴板属于系统态，建议后续再用人工键盘做一次确认。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-165-editing-undo-removes-inserted-line-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-166-editing-redo-restores-inserted-line-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-167-editing-selection-toolbar-copy-state-window.png`
  - `logs/computer-use-real-app/editing-copy-clipboard-check.log`
- 备注：日志只记录“剪贴板是否包含预期 Alpha 行”的布尔结果，没有保存用户原剪贴板内容。
- 修复进展：2026-06-30 源码已把 `copy/cut/paste/pastePlain` 改为直接读取 CodeMirror selection 并写入/读取系统剪贴板；`cut` 写剪贴板后删除选区，`paste` 在光标处插入文本并更新光标。`editorCommandAdapter` 与 `EditorPane.integration` 回归测试通过；待真实 App 人工键盘/Computer Use 复测系统剪贴板。

### P0-EDITOR-005 图片剪贴板粘贴未进入资产管线

- 严重度：P0
- 用例 ID：PRISM-FF-033
- 触发动作：
  1. 打开专用 fixture `fixtures/computer-use-real-app/real-image-insert.md`。
  2. 通过 `插入 > 图片` 选择 `fixtures/computer-use-real-app/assets/prism-qa-image.png`，确认 Prism 插入 Markdown 图片并在预览中显示。
  3. 使用系统剪贴板写入同一张 PNG 图片数据。
  4. 在编辑器中按 `Cmd+V`，再点击系统浮出的 `Paste` 菜单。
  5. 检查文档 Markdown 和 `assets/real-image-insert/` 是否新增第二张图片资源。
- 问题表现：
  - 文件选择插入图片路径通过：Prism 复制资源到 `assets/real-image-insert/image-20260630-112608.png`，并插入 Markdown 图片语法。
  - 剪贴板粘贴失败：系统剪贴板已确认包含 PNG 数据，但 `Cmd+V` 后没有新增 Markdown 图片，也没有新增第二个 assets 文件。
- 预期表现：从系统剪贴板粘贴图片应走同一资产管线，复制到当前文档资源目录并在光标位置插入 Markdown 图片语法，预览立即显示。
- 复现稳定性：2026-06-30 真实 `/Applications/Prism.app` + Computer Use 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-177-insert-image-menu-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-178-insert-image-open-dialog-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-179-insert-image-markdown-inserted-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-180-image-paste-no-second-asset-window.png`
  - `logs/computer-use-real-app/image-paste-check.log`
- 备注：图片插入位置落在文档开头，可能与自动化光标落点有关，本轮不单独作为产品缺陷记录。
- 修复进展：2026-06-30 源码已让图片剪贴板检测同时支持 `clipboardData.items` 和 `clipboardData.files`，粘贴运行时也从两条路径提取图片 File。`editorClipboardController` / `editorClipboardRuntime` 回归测试通过；待换包后用系统 PNG 剪贴板真实复测资产管线。

### P1-EDITOR-006 Selection callout 丢失当前选区

- 严重度：P1
- 用例 ID：PRISM-FF-110
- 用户影响：用户想把已有段落转换为 callout 时，原选区没有被包装，反而在文末生成空 callout，容易破坏文档结构并造成内容操作不可信。
- 触发动作：
  1. 打开 `fixtures/computer-use-real-app/real-selection-callout.md`。
  2. 选中两行正文。
  3. 右键打开编辑区上下文菜单。
  4. 选择 `块级源码操作 > 选区转警告提示块`。
- 问题表现：Prism 没有把选中内容包装为 warning callout，而是在文末追加：
  ```md
  > [!WARNING]
  >
  ```
- 预期表现：应保留选区原文，并把选区整体转换为 warning callout，不应移动到文末或生成空块。
- 复现稳定性：2026-06-30 真实 App + Computer Use 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-219-selection-callout-appended-empty-window.png`
- 建议修复方向：检查块级源码操作拿到的选区范围与 CodeMirror transaction；命令执行前应优先读取当前 selection，并用 replacement 包装选区。
- 验收标准：多行选区、单行选区、空选区三种路径分别有明确行为；非空选区转换后原文完整保留且只改动选区区域。
- 修复进展：2026-06-30 源码已在 selection callout picker 打开前保存原始 CodeMirror selection，用户点击具体 callout 类型前恢复 selection，避免焦点变化导致丢选区。`EditorPane.integration.test.tsx` 已覆盖焦点变更后仍包装原选区；待真实 App 复测。

### P1-EDITOR-007 选区右键菜单剪切/复制/链接仍 disabled

- 严重度：P1
- 用例 ID：PRISM-FF-009、PRISM-FF-010、PRISM-FF-110
- 用户影响：用户选中文字后右键菜单无法直接执行常见编辑动作，和系统文本编辑器习惯不一致，也会影响链接插入和格式化效率。
- 触发动作：
  1. 在真实编辑器中选中正文。
  2. 右键打开编辑区上下文菜单。
  3. 观察剪切、复制、链接等菜单项状态。
- 问题表现：选区工具条按钮可见，但右键菜单中的剪切/复制/链接仍处于 disabled 状态。
- 预期表现：存在非空选区时，剪切、复制、创建链接等选区相关动作应启用；无选区时才禁用需要选区的动作。
- 复现稳定性：2026-06-30 Selection callout 复测同轮观察到一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-219-selection-callout-appended-empty-window.png`
- 建议修复方向：统一 selection toolbar 与 context menu 的选区状态来源，避免右键打开菜单时 selection 被清空或菜单状态读取滞后。
- 验收标准：选中文字后右键菜单显示可用的剪切/复制/链接动作；动作执行结果与快捷键一致。
- 修复进展：2026-06-30 源码已放宽右键 selection 判断：`posAtCoords === null` 或点击落在 selection 边界附近时不折叠选区；编辑器上下文菜单动作优先走本地 inline/source block/table/basic command。已补右键菜单剪切/复制/链接启用态和复制写剪贴板集成测试；待真实 App 复测。

## 预览渲染

### P1-PREVIEW-003 目录锚点点击只更新 URL hash，不滚动到目标段落

- 严重度：P1
- 用例 ID：PRISM-FF-038、PRISM-FF-047
- 触发动作：
  1. 在真实 Prism 分栏模式下点击预览目录中的 `图表 (Mermaid、PlantUML、Markmap)`。
  2. 观察 URL 与左右编辑/预览滚动位置。
- 问题表现：
  - WebView URL 变为 `#图表`。
  - 左右内容仍停留在目录附近，没有滚动到“图表”段落。
- 预期表现：点击目录链接后应滚动到对应 heading，并保持编辑/预览同步位置。
- 复现稳定性：本轮真实 App 复现一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-033-anchor-click-hash-no-scroll-window.png`
- 备注：后续通过手动滚动可到达图表区域；Mermaid、PlantUML、Markmap 在真实 App 中均可见渲染。
- 修复进展：2026-06-30 源码已为预览标题生成稳定 heading `id`，并在预览点击同文档 `#anchor` 链接时滚动到当前预览容器内的目标标题，不再只依赖 WebView URL hash。已补 `markdownToHtml` heading id 测试和 `PreviewPane` 中文 hash 滚动测试；待换包后用真实指南目录点击复测。

### P0-PREVIEW-001 图表渲染在浏览器补充验证中出现 WASM/Mermaid/Markmap 布局错误

- 严重度：P0
- 用例 ID：PRISM-FF-042、PRISM-FF-044
- 触发动作：通过 Playwright + Tauri IPC mock 打开指南文档，切到预览模式并滚动到图表区域。
- 问题表现：
  - console 反复出现 `Error: <g> attribute transform: Expected number, "translate(NaN,NaN) scale(...)"`。
  - Mermaid 与 Markmap 在截图中可见，但存在渲染层错误日志，不满足“无渲染错误”的通过标准。
- 预期表现：Mermaid、Markmap 均离线稳定渲染，不能出现 NaN transform 或布局错误。
- 复现稳定性：本轮 Playwright mock 多次复现。
- 截图/证据：
  - `screenshots/05-preview-rendering/PRISM-FF-042-mermaid-mermaid.png`
  - `screenshots/05-preview-rendering/PRISM-FF-044-markmap-markmap.png`
  - `logs/playwright-console.log`
- 备注：由于原生 Tauri 窗口不可见，暂未确认该问题在真实 WebView 中是否完全一致。

### P0-PREVIEW-002 PlantUML 预览渲染失败

- 严重度：P0
- 用例 ID：PRISM-FF-043
- 触发动作：通过 Playwright + Tauri IPC mock 打开指南文档，切到预览模式并滚动到 PlantUML 区域。
- 问题表现：
  - PlantUML 区域直接显示 `PlantUML render failed`。
  - 错误内容为 `WebAssembly.instantiate(): expected magic word 00 61 73 6d, found 3c 21 44 4f`。
  - 这会导致图表宣传截图出现失败块，也会影响后续导出保真验证。
- 预期表现：PlantUML/puml 在离线环境中以真实 SVG 完整渲染，不依赖在线服务，不显示源码或失败块。
- 复现稳定性：本轮 Playwright mock 稳定复现。
- 截图/证据：
  - `screenshots/05-preview-rendering/PRISM-FF-043-plantuml-plantuml.png`
  - `logs/playwright-console.log`
- 备注：当前证据来自 browser mock；原生窗口恢复后需用 `/Applications/Prism.app` 复测。

### P0-PREVIEW-002 复测更新：真实 App 中 PlantUML 已渲染

- 严重度：记录更新
- 用例 ID：PRISM-FF-043、PRISM-FF-044
- 触发动作：
  1. 2026-06-29 在真实 `/Applications/Prism.app` 中打开 `/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md`。
  2. 切到分栏模式，滚动到图表区域。
- 问题表现：
  - 真实 App 右侧预览中 `精卫与山海关系图` 已显示 PlantUML 图，不是空白、源码或失败块。
  - `精卫填海思维导图` 也显示 Markmap 图。
  - `精卫填海流程图` 显示 Mermaid 图。
- 预期表现：真实 App 与本轮观察一致，三类图表均可离线渲染。
- 复现稳定性：本轮真实 App 复现一次。
- 截图/证据：Computer Use 实时截图中可见 Mermaid、PlantUML、Markmap 渲染图。
- 备注：browser mock 中的 PlantUML/WASM 失败不应继续当作真实 App 当前缺陷；导出产物是否完全复用屏幕预览仍需另测。

### P1-PREVIEW-004 PlantUML 预览与导出缺失节点文字

- 严重度：P1
- 用例 ID：PRISM-FF-043、PRISM-FF-071、PRISM-FF-072、PRISM-FF-073、PRISM-FF-074
- 触发动作：
  1. 在真实 `/Applications/Prism.app` 中打开 `fixtures/computer-use-real-app/real-complex-diagrams-export.md`。
  2. 切到预览模式，滚动到 `PlantUML Relationship`。
  3. 依次导出 HTML/PDF/PNG/DOCX，并检查导出产物。
- 问题表现：
  - PlantUML 图不再是空白或失败块，但顶部 `rectangle Prism` 节点显示为空白矩形，节点文字 `Prism` 缺失。
  - PNG、PDF、DOCX 均复用了这个结果；导出未比预览少节点，但把预览中的文字缺失一起带入了导出。
  - DOCX 包内 PlantUML 媒体图同样缺失 `Prism` 文本。
- 预期表现：PlantUML 节点应完整渲染所有节点文字；导出应复用屏幕预览，但不能复用错误或丢失文本的图表结果。
- 复现稳定性：2026-06-29 真实 App 预览、PNG、PDF、DOCX 各复现一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-124-complex-diagrams-preview-plantuml-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-137-complex-export-png-plantuml-crop.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-139-complex-export-pdf-page-1.png`
  - `fixtures/computer-use-real-app/real-complex-diagrams-export.png`
  - `fixtures/computer-use-real-app/real-complex-diagrams-export.pdf`
  - `fixtures/computer-use-real-app/real-complex-diagrams-export.docx`
  - `logs/computer-use-real-app/export-artifact-validation.log`
- 备注：当前 fixture 使用 `rectangle Prism`。若 Prism 的 PlantUML 渲染器对该语法生成空标签，应在渲染层兼容，或在诊断中提示用户使用显式别名语法。

### P1-PREVIEW-005 预览链接需要双击才会打开

- 严重度：P1
- 用例 ID：PRISM-FF-114、PRISM-FF-115
- 触发动作：
  1. 打开专用 fixture `fixtures/computer-use-real-app/real-links-click.md`。
  2. 切到预览态，确认 wiki link、相对 Markdown link、外链均显示为蓝色链接。
  3. 单击 `real-wiki-target` wiki link。
  4. 双击同一个 wiki link。
  5. 回到链接 fixture 后，单击 `relative target` 相对 Markdown link。
  6. 双击同一个相对 Markdown link。
- 问题表现：
  - 单击 wiki link 只出现 hover/下划线状态，仍停留在 `real-links-click.md`。
  - 双击 wiki link 后才打开 `real-wiki-target.md`。
  - 单击相对 Markdown link 也只出现 hover/下划线状态，仍停留在 `real-links-click.md`。
  - 双击相对 Markdown link 后才打开 `real-relative-target.md`。
- 预期表现：预览态链接应符合常规阅读器行为，普通单击即可打开对应 wiki/Markdown/外部链接；不应要求用户双击。
- 复现稳定性：2026-06-30 真实 `/Applications/Prism.app` + Computer Use 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-194-preview-links-baseline-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-195-wiki-link-opened-target-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-196-relative-link-opened-target-window.png`
  - `logs/computer-use-real-app/preview-link-click-check.log`
- 备注：外链在本轮只确认可见，未继续打开浏览器；因为 wiki/相对链接的单击行为已经稳定不符合预期，足以记录该交互缺陷。

## 诊断

### P1-DIAGNOSTICS-001 图片诊断与排版诊断未被自动化稳定触发

- 严重度：P1
- 用例 ID：PRISM-FF-050、PRISM-FF-052、PRISM-FF-070
- 触发动作：
  1. 通过 browser mock 打开 `notes/broken-links.md`。
  2. 切换到预览模式，尝试点击状态栏 `ERROR` 诊断入口。
  3. 打开 `notes/typography-issues.md`，尝试通过排版/typography 入口打开排版诊断。
- 问题表现：
  - `broken-links.md` 页面能看到 `ERROR 5`，预览区也显示缺失标题、Mermaid render failed 等问题，但自动化没有稳定打开独立诊断弹窗。
  - 本轮没有成功捕获“缺失图片”诊断面板，`PRISM-FF-050-image-diagnostics.png` 只能证明 broken-links 预览区存在错误反馈。
  - 排版诊断入口选择器未找到，没有生成 `PRISM-FF-052` 截图。
- 预期表现：状态栏 ERROR 按钮可稳定打开诊断弹窗；链接、图片、渲染、排版诊断都有明确入口、分组和可截图状态。
- 复现稳定性：browser mock 中稳定未覆盖；原生窗口不可见，暂未能使用真实 app 复测。
- 截图/证据：
  - `screenshots/06-diagnostics/PRISM-FF-050-image-diagnostics.png`
  - `screenshots/06-diagnostics/PRISM-FF-070-export-preflight-errors.png`
  - `logs/click-skip.log`
- 备注：该项同时可能包含测试自动化选择器不足；原生窗口恢复后需要用真实点击复核。

### P0-DIAGNOSTICS-002 Typography 排版诊断入口缺失

- 严重度：P0
- 用例 ID：PRISM-FF-052
- 触发动作：
  1. 在本次测试 fixture 中创建并打开 `real-typography-diagnostics.md`。
  2. 文档包含中文与英文/数字之间缺少空格、中文语境半角标点、标题层级跳级、连续空行等排版问题。
  3. 观察状态栏和可点击按钮，尝试找到“排版提示 / Typography”入口。
- 问题表现：
  - 状态栏只显示字数、光标位置、`Markdown 文稿`、专注模式和导出按钮。
  - 没有出现排版提示按钮，因此用户无法打开 `TypographyDiagnosticsPanel`。
  - 源码复核显示 `StatusBarProps` 声明了 `typographyIssueCount`、`typographyIssueTitle`、`onTypographyDiagnosticsClick`，`WorkspaceController` 也传入了这些 props，但 `StatusBar` 函数组件没有解构这些字段，也没有渲染对应按钮。
- 预期表现：排版建议不应默认计入 `ERROR`，但应有明确、可发现、可点击的入口；点击后打开“排版提示”面板，展示类型、位置、原因和处理动作。
- 复现稳定性：2026-06-30 真实 `/Applications/Prism.app` + Computer Use 复测一次，稳定缺失。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-161-typography-diagnostics-entry-missing-window.png`
  - `fixtures/computer-use-real-app/real-typography-diagnostics.md`
  - `src/domains/workspace/components/StatusBar.tsx`
- 备注：这不是选择器问题。图片/链接诊断同轮真实复测可通过 `ERROR 3` 直接打开，见 `PRISM-CU-160`；缺失范围收敛到 Typography 入口未渲染。
- 修复进展：2026-06-30 源码已在 `StatusBar` 解构并渲染 Typography 入口：Markdown 文档下显示 `TYPO n` 或 `排版`，并且不计入 `ERROR`；纯文本文档隐藏。`StatusBar.test.tsx` 和 `useDocumentDiagnosticsModel` 相关测试通过；待换包后真实点击排版面板复测。

### P2-DIAGNOSTICS-003 补齐缺失图片文件后诊断不自动刷新

- 严重度：P2
- 用例 ID：PRISM-FF-112
- 触发动作：
  1. 打开专用 fixture `real-image-diagnostics-async.md`，其中图片引用 `diagnostic-target-20260630.png`。
  2. 确认该图片文件不存在，状态栏显示 `ERROR 1`。
  3. 在同目录创建真实 PNG 文件 `diagnostic-target-20260630.png`。
  4. 等待约 7 秒，再观察状态栏。
- 问题表现：
  - 文件系统中目标 PNG 已存在且可读。
  - Prism 状态栏仍显示 `ERROR 1`，Help 仍提示同一路径图片未找到。
  - 只有继续把 Markdown 图片路径改成另一个已存在文件后，诊断才会重新计算并消失。
- 预期表现：当缺失图片文件被补到原引用路径后，图片诊断应通过文件监听或后台重扫异步清除；用户不应必须重新编辑 Markdown 内容。
- 复现稳定性：2026-06-30 真实 `/Applications/Prism.app` + Computer Use 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-200-image-diagnostics-missing-error-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-201-image-diagnostics-file-created-still-error-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-202-image-diagnostics-fixed-cleared-window.png`
  - `fixtures/computer-use-real-app/real-image-diagnostics-async.md`
- 建议修复方向：图片诊断除了监听 Markdown 内容变化，也应监听相关本地资源路径的创建/变更事件，或在窗口获得焦点、导出前、状态栏点击前触发轻量重校验。
- 验收标准：引用路径对应文件从不存在变为存在后，不重启、不修改 Markdown，状态栏 `ERROR` 在合理时间内自动消失；导出前 preflight 也不再阻断该图片。

## 链接、反链与图谱

### P0-KNOWLEDGE-001 反链面板未显示测试工作区中存在的反链

- 严重度：P0
- 用例 ID：PRISM-FF-055
- 触发动作：
  1. 测试工作区中保留 `notes/backlink-source.md`，内容链接到 `../Examples/Prism Markdown 语法指南.md`。
  2. 打开 `Examples/Prism Markdown 语法指南.md`。
  3. 执行反链入口并截图。
- 问题表现：反链面板打开后显示 `Current document has no backlinks`，没有列出 `notes/backlink-source.md`。
- 预期表现：反链面板列出所有指向当前文档的来源文件、片段和行号。
- 复现稳定性：browser mock 稳定复现；原生窗口未能验证。
- 截图/证据：
  - `screenshots/07-knowledge/PRISM-FF-055-backlinks-panel.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-072-knowledge-backlinks-empty-window.png`
  - `/tmp/prism-full-functional-test-workspace/notes/backlink-source.md`
- 备注：2026-06-29 真实 `/Users/Alex/Documents/Prism` 工作区中也能打开反链面板，但当前指南文档显示空状态；该真实截图只能证明空状态 UI 可见，不能证明测试工作区反链索引问题已解决。

### P0-KNOWLEDGE-002 关系图谱入口未能打开图谱面板

- 严重度：P0
- 用例 ID：PRISM-FF-056、PRISM-FF-057
- 触发动作：
  1. 打开包含 `[[linked-note]]`、目录链接、外链的指南文档。
  2. 尝试通过状态栏图谱按钮选择器和 `showRelationGraph` 命令打开关系图谱。
- 问题表现：
  - 自动化未找到 `图谱/Relation` 相关可点击按钮。
  - 执行 `showRelationGraph` 后未出现 Relation Graph 面板，截图仍停留在普通预览页。
  - 2026-06-29 真实 App 复测时，`导航` 菜单中的 `关系图谱` 直接显示为 disabled。
- 预期表现：当前文档存在链接关系时状态栏显示图谱按钮，点击后打开图谱面板，展示节点、边、当前文档高亮。
- 复现稳定性：browser mock 稳定复现；原生窗口未能验证。
- 截图/证据：
  - `screenshots/07-knowledge/PRISM-FF-056-graph-button-visible.png`
  - `screenshots/07-knowledge/PRISM-FF-057-relation-graph-panel.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-044-menu-navigation-graph-disabled-window.png`
  - `logs/click-skip.log`
- 备注：不能把现有 `PRISM-FF-057` 截图当作图谱通过证据，它只是失败后的底层预览页。

## 命令、搜索与快捷键

### P0-COMMAND-001 `new` 命令未触发当前窗口新建文稿逻辑

- 严重度：P0
- 用例 ID：PRISM-FF-012、PRISM-FF-086
- 触发动作：
  1. 运行 `npm test -- --run src/domains/commands/registry.test.ts`。
  2. 观察 `command registry > runs enabled commands and skips disabled commands`。
- 问题表现：
  - 测试执行 `await runCommand('new', context)` 后，期望 `createNewDocument` 被调用 1 次。
  - 实际 `createNewDocument` 调用次数为 0。
  - 同一失败在批量测试和单独复跑中稳定复现。
- 预期表现：`new` 命令应在当前窗口/当前工作区触发新建文稿逻辑；禁用的 `save` 命令不应触发保存路径请求。
- 复现稳定性：稳定复现。
- 截图/证据：
  - `logs/unit-tests/export-settings-theme-commands.log`
  - `logs/unit-tests/registry-rerun.log`
  - `src/domains/commands/registry.test.ts:1500`
- 备注：这与用户之前指出“文件 > 新建文稿”和“新建窗口”语义重复/混淆的问题相关。本轮只记录，不修复。
- 修复进展：2026-06-30 测试口径已修正为当前产品语义：`new` 不再创建内存中的 Untitled 文稿，而是在当前文档目录或工作区根目录触发 `newFile`；无目标目录时提示“当前没有打开的工作区”，不会误触保存路径请求。`fileCommands` 与 `registry` 测试通过。

### P1-COMMAND-002 自绘菜单/上下文菜单对 Escape 关闭响应不一致

- 严重度：P1
- 用例 ID：PRISM-FF-085、PRISM-FF-091、PRISM-FF-092
- 触发动作：
  1. 打开顶部 `帮助` 自绘菜单后按 `Escape`。
  2. 在文件树文件夹上右键打开上下文菜单后按 `Escape`。
  3. 对比快速打开、文档属性、文档链接、反向链接、快捷键、关于等弹窗的 `Escape` 行为。
- 问题表现：
  - 快速打开、属性、链接、反链、快捷键、关于弹窗可以用 `Escape` 关闭。
  - 顶部自绘菜单在本轮仍出现 `Escape` 不关闭的情况，例如文件菜单按 `Escape` 后仍停留在菜单状态，需要点击其他菜单或外部区域切换。
  - 2026-06-29 后续复测中文件树文件夹右键菜单可以通过 `Escape` 关闭，因此当前问题范围收窄为顶部自绘菜单关闭一致性。
- 预期表现：所有菜单/浮层都应支持一致的 `Escape` 关闭行为；右键菜单应能点击外部或 Escape 无副作用关闭。
- 复现稳定性：本轮真实 App 复现一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-040-menu-file-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-081-file-tree-folder-context-menu-window.png`
- 备注：这影响键盘用户和自动化测试稳定性。

### P1-SEARCH-001 工作区全文搜索入口不可达

- 严重度：P1
- 用例 ID：PRISM-FF-119
- 用户影响：用户无法从常见快捷键或菜单进入全工作区搜索，只能看到文档内查找或快速打开文件，长文档库中查找内容效率明显下降。
- 触发动作：
  1. 打开真实 Prism 测试工作区文档。
  2. 按 `Cmd+Shift+F`。
  3. 按 `Cmd+P` 查看快速打开。
  4. 检查原生 macOS `Edit` 菜单是否有工作区全文搜索入口。
- 问题表现：
  - `Cmd+Shift+F` 打开文档内查找浮层，不是工作区全文搜索。
  - `Cmd+P` 只显示快速打开文件搜索和“原生索引”状态，没有全文搜索模式。
  - 原生菜单中也没有可见的工作区全文搜索入口。
- 预期表现：应提供稳定的工作区全文搜索入口，结果包含文件名、命中片段和打开动作；快捷键口径不应和文档内查找混淆。
- 复现稳定性：2026-06-30 真实 App + Computer Use 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-220-workspace-search-shortcut-opens-document-find-window.png`
- 建议修复方向：明确 Quick Open 与 Workspace Search 的命令、快捷键和菜单入口；如果暂时不支持全文搜索，应在测试口径和 UI 中降级说明。
- 验收标准：一个公开入口可打开工作区全文搜索；输入 fixture 中存在的词后显示跨文件命中列表，回车或点击可打开对应文件位置。
- 修复进展：2026-06-30 源码已修复 `Cmd+Shift+F` 被文档内搜索抢占的问题，并让文件树 `searchInFolder` 发 `workspace` 搜索事件，由 `useAppAuxiliaryModalsModel` 打开全局搜索模式；`SplitView` 会忽略带 `rootPath` 的 workspace 搜索事件。相关 `SplitView` 和 auxiliary modal 单测通过；待真实 App 复测快捷键、文件树入口和结果打开。

## 导出

### P0-EXPORT-001 基础导出、preflight 与复杂产物导出已覆盖，仍有图表/分页保真缺陷

- 严重度：P0
- 用例 ID：PRISM-FF-070、PRISM-FF-071、PRISM-FF-072、PRISM-FF-073、PRISM-FF-074
- 触发动作：
  1. 打开 `real-export-preflight-broken.md`，触发 2 条缺失链接与 1 条缺失图片诊断。
  2. 点击状态栏 `ERROR 3`，确认诊断弹窗可直接打开。
  3. 2026-06-29 追加使用真实 `/Applications/Prism.app` 打开 `real-open-markdown.md`，从 Prism 内置导出对话框依次导出 HTML/PDF/PNG/DOCX 到测试 fixture 目录。
  4. 在错误文档中选择 `导出为 HTML`，观察导出 preflight 阻断。
  5. 2026-06-29 追加使用真实 `/Applications/Prism.app` 打开 `real-complex-diagrams-export.md`，覆盖 Mermaid、PlantUML、Markmap、本地 SVG、表格和数学公式，并导出 HTML/PDF/PNG/DOCX。
- 问题表现：
  - 错误文档状态栏显示 `ERROR 3`，点击后可直接打开文档诊断弹窗。
  - 选择 `导出为 HTML` 后没有进入导出文件对话框，而是显示 `HTML 导出预检未通过，发现 3 个需要先处理的问题`。
  - preflight 阻断后目录中未生成 `real-export-preflight-broken.html`。
  - 干净 Markdown fixture 的 HTML/PDF/PNG/DOCX 真实导出已通过基础验收。
  - HTML 产物存在且包含正文、任务列表和 Mermaid SVG/CSS。
  - PDF 产物为 1 页 A4 PDF，`pdftotext` 可读出正文和 Mermaid 节点文本。
  - PNG 产物为 `4160x4800`，符合 `极致 4x` 导出，没有降到 1x。
  - DOCX 产物为标准 Office Open XML，`unzip -t` 无错误，`textutil` 可提取正文，包内包含图表媒体资源。
  - 复杂图表 fixture 的 HTML/PDF/PNG/DOCX 均生成成功；PNG 为 `4108x11072`，符合 4x 宽度；PDF 为 2 页 A4；DOCX 为标准 Office Open XML 且包内包含 Mermaid、PlantUML、Markmap、本地 SVG 和公式媒体资源。
  - 复杂图表导出暴露 `P1-PREVIEW-004`：PlantUML 顶部 `Prism` 节点文字在预览和导出中缺失。
  - 复杂 PDF 暴露 `P2-EXPORT-002`：`Markmap Mind Map` 标题留在第 1 页页底，实际图表从第 2 页开始，存在孤立标题。
  - 长文档分页、DOCX 在 WPS 中的视觉还原和超长大图分片仍未完成真实验收。
- 预期表现：导出前检查应在导出动作前给出可读诊断；真实导出产物应复用屏幕预览结果，HTML/PDF/PNG/DOCX 均需要打开产物验收。
- 复现稳定性：错误文档 preflight、干净 Markdown fixture 四格式导出、复杂图表 fixture 四格式导出本轮各执行一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-119-export-preflight-broken-error-status-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-120-export-preflight-broken-diagnostics-popover-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-121-export-preflight-broken-export-menu-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-122-export-preflight-broken-html-blocked-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-108-export-menu-real-markdown-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-109-export-html-dialog-preflight-pass-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-112-export-pdf-dialog-preflight-pass-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-114-export-png-dialog-4x-preflight-pass-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-116-export-word-dialog-preflight-pass-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-118-export-complete-returned-to-editor-window.png`
  - `fixtures/computer-use-real-app/real-open-markdown.html`
  - `fixtures/computer-use-real-app/real-open-markdown.pdf`
  - `fixtures/computer-use-real-app/real-open-markdown.png`
  - `fixtures/computer-use-real-app/real-open-markdown.docx`
  - `screenshots/15-computer-use-real-app/PRISM-CU-128-complex-export-menu-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-129-complex-export-html-dialog-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-131-complex-export-pdf-dialog-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-133-complex-export-png-dialog-4x-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-135-complex-export-word-dialog-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-137-complex-export-png-plantuml-crop.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-139-complex-export-pdf-page-1.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-139-complex-export-pdf-page-2.png`
  - `fixtures/computer-use-real-app/real-complex-diagrams-export.html`
  - `fixtures/computer-use-real-app/real-complex-diagrams-export.pdf`
  - `fixtures/computer-use-real-app/real-complex-diagrams-export.png`
  - `fixtures/computer-use-real-app/real-complex-diagrams-export.docx`
  - `logs/computer-use-real-app/export-artifact-validation.log`
- 备注：复杂图表导出已经覆盖；后续应继续用用户指南级长文档验证分页、WPS 视觉和超长 PNG 分片。

### P0-EXPORT-006 Front Matter export.toc 未覆盖导出目录

- 严重度：P0
- 用例 ID：PRISM-FF-078
- 触发动作：
  1. 打开专用 fixture `fixtures/computer-use-real-app/real-frontmatter-export.md`，该文档 Front Matter 中包含导出覆盖配置。
  2. 在 `设置 > 导出` 中确认“允许 Front matter 覆盖导出”默认为关闭。
  3. 打开该开关后导出 HTML。
  4. 检查生成的 `fixtures/computer-use-real-app/real-frontmatter-export.html`。
  5. 测试后恢复 `frontMatterOverrides=false`。
- 问题表现：
  - HTML 产物包含 `<title>Front Matter Export Override Title</title>`。
  - HTML 产物包含 `<meta name="author" content="Prism QA">`。
  - 但 `export.toc: true` 没有生成实际目录；产物中只有 `.prism-export-toc` CSS，正文直接从 H1 开始。
- 预期表现：开启 Front Matter 覆盖导出后，`title`、`author`、`toc` 等字段应按同一 schema 生效；`export.toc: true` 应生成实际目录内容。
- 复现稳定性：2026-06-30 真实 `/Applications/Prism.app` + Computer Use 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-181-frontmatter-export-source-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-182-frontmatter-export-menu-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-183-frontmatter-html-export-dialog-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-184-frontmatter-override-setting-off-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-185-frontmatter-override-setting-on-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-186-frontmatter-html-export-complete-window.png`
  - `fixtures/computer-use-real-app/real-frontmatter-export.html`
  - `logs/computer-use-real-app/frontmatter-export-html-check.log`
- 备注：本轮仅记录真实导出结果，不修改导出逻辑。

### P2-EXPORT-002 PDF 导出存在孤立标题分页

- 严重度：P2
- 用例 ID：PRISM-FF-072
- 触发动作：
  1. 在真实 Prism 中打开 `real-complex-diagrams-export.md`。
  2. 选择 `导出 > 导出为 PDF`，保持默认 A4 和极致 4x。
  3. 用 `pdftoppm` 将生成的 PDF 渲染为页面截图。
- 问题表现：第 1 页页底出现 `Markmap Mind Map` 标题，但实际 Markmap 图表从第 2 页开始；标题和内容被分页分离。
- 预期表现：PDF 导出应避免孤立标题，至少保持标题与后续图表在同一页，或在上一页空间不足时整体移到下一页。
- 复现稳定性：2026-06-29 真实导出复现一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-139-complex-export-pdf-page-1.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-139-complex-export-pdf-page-2.png`
  - `fixtures/computer-use-real-app/real-complex-diagrams-export.pdf`
- 备注：该问题不影响文件生成，但会降低导出 PDF 的阅读质量和宣传素材可用性。

### P1-EXPORT-007 PDF 导出没有保留链接注释

- 严重度：P1
- 用例 ID：PRISM-FF-122
- 用户影响：PDF 里外链、相对链接和 wiki link 都变成纯文本，读者无法点击跳转，文档交付能力下降。
- 触发动作：
  1. 打开 `fixtures/computer-use-real-app/real-links-click.md`。
  2. 通过真实 Prism 执行 `导出 > 导出为 PDF`。
  3. 检查生成的 `real-links-click.pdf` 元数据、文本和原始字符串。
- 问题表现：
  - PDF 成功生成，`mdls` 显示 1 页 `com.adobe.pdf`。
  - `strings real-links-click.pdf` 中没有 `/URI`、`/Annots` 或 `/Link`。
  - `pdftotext` 只能提取链接显示文字，例如 `Prism repository`，没有可点击链接目标。
- 预期表现：外链应在 PDF 中保留为安全的可点击链接注释；内部锚点和本地路径应按安全策略处理，不能静默全部丢失。
- 复现稳定性：2026-06-30 真实 App + Computer Use 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-238-pdf-link-export-complete-window.png`
  - `fixtures/computer-use-real-app/real-links-click.pdf`
  - `logs/computer-use-real-app/pdf-link-annotations-20260630.log`
- 建议修复方向：检查 PDF 导出路径是否把 preview DOM 中的 `<a href>` 传给 PDF 渲染器；若使用截图/打印管线，需要显式生成 PDF link annotations。
- 验收标准：导出的 PDF 中外链包含 `/Subtype /Link` 和 `/URI`，点击可打开目标；相对链接和 wiki link 有明确安全策略并可测试。

## 设置、主题与字体

### P1-SETTINGS-002 设置弹窗视觉可用但 AX 语义树未暴露弹窗控件

- 严重度：P1
- 用例 ID：PRISM-FF-077、PRISM-FF-079、PRISM-FF-080、PRISM-FF-081、PRISM-FF-082、PRISM-FF-083、PRISM-FF-084
- 触发动作：
  1. 在真实 App 中通过 `文件 > 设置` 打开设置中心。
  2. 使用 Computer Use `get_app_state` 读取窗口 AX 树。
  3. 通过坐标点击切换 `通用 / 写作 / 外观 / 导出 / 引用 / 文件` 六个设置分区。
- 问题表现：
  - 视觉上六个设置分区均可用，右侧内容显示正常。
  - 但 AX 树仍主要暴露底层文档内容，未语义化列出设置弹窗内的 tab、select、toggle、slider、button、input 等控件。
  - Computer Use 只能靠坐标点击操作设置项，无法稳定按控件名称定位。
  - 外观页“内容主题”下拉在视觉上可展开，但通过 AX/Computer Use 无法稳定按选项名确认选择；本轮改用 `视图 > 主题` 完成主题切换验证。
- 预期表现：设置弹窗应作为 dialog/modal 暴露，内部控件有可读名称、角色和状态，支持辅助功能与自动化测试。
- 复现稳定性：本轮真实 App 稳定复现。
- 截图/证据：Computer Use 实时截图中设置弹窗可见；同一工具输出的 AX 树没有对应弹窗控件。
- 真实视觉截图：
  - `screenshots/15-computer-use-real-app/PRISM-CU-050-settings-general-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-051-settings-writing-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-052-settings-appearance-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-053-settings-export-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-055-settings-citations-pandoc-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-056-settings-files-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-093-settings-theme-dropdown-window.png`
- 备注：旧的 `P0-SETTINGS-001 设置弹窗右侧内容区域空白` 只适用于 browser mock，不代表真实 App 当前状态。

### P1-SETTINGS-003 打开主题目录按钮无可见结果

- 严重度：P1
- 用例 ID：PRISM-FF-104
- 触发动作：
  1. 在真实 `/Applications/Prism.app` 中打开 `文件 > 设置`。
  2. 切换到“外观”分区。
  3. 点击“打开主题目录”按钮。
  4. 等待并检查 Finder 窗口列表。
- 问题表现：
  - “打开主题目录”按钮在外观设置中可见。
  - 通过可访问性按钮点击一次、坐标点击一次后，仍停留在设置弹窗。
  - 没有 Finder 窗口打开，也没有 toast 或错误反馈。
- 预期表现：点击后应打开 Finder 到用户主题目录；如果目录创建或打开失败，应显示明确错误 toast 和路径信息。
- 复现稳定性：2026-06-30 真实 App + Computer Use 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-212-settings-appearance-open-theme-directory-entry-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-213-settings-open-theme-directory-no-finder-window.png`
  - `logs/computer-use-real-app/open-theme-directory-window-list.log`
- 建议修复方向：检查“打开主题目录”按钮绑定的 Tauri command 是否执行，失败时捕获并 toast；成功时确保通过系统 opener/Finder 打开目录并把目录路径写入日志。
- 验收标准：点击按钮后 Finder 前台或后台出现用户主题目录窗口；窗口列表能看到 Finder；失败路径显示 toast，不静默。

### P1-THEME-001 切换内容主题后滚动位置可能跳变

- 严重度：P1
- 用例 ID：PRISM-FF-101、PRISM-FF-102、PRISM-FF-158
- 触发动作：
  1. 在真实 Prism 分栏模式中停留在任务列表/脚注附近。
  2. 通过 `视图 > 主题` 依次切换 `Inkstone Light`、`Slate Manual`、`Mono Lab`、`Nocturne Dark`、`Carbon Black`。
  3. 再通过同一路径切回 `MiaoYan`。
- 问题表现：
  - 主题切换主路径可用，配置文件 `~/Library/Application Support/com.prism.editor.v1/config.json` 会同步写入当前 `contentTheme`。
  - 切回 `MiaoYan` 后，编辑/预览内容从任务列表/脚注附近跳到文档末尾的“表情符号与特殊字符 / Footnotes”区域。
  - 这会打断用户在长文档中的当前位置，也会影响连续主题对比或宣传截图录制。
- 预期表现：切换主题后应尽量保持当前编辑/预览滚动位置，至少不应跳到文档末尾。
- 复现稳定性：本轮真实 App 观察到一次，需要专项复测确认是否稳定。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-094-theme-inkstone-light-split-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-095-theme-slate-manual-split-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-096-theme-mono-lab-split-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-097-theme-nocturne-dark-split-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-098-theme-carbon-black-split-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-099-theme-miaoyan-restored-bottom-window.png`
- 备注：本轮仅做真实 App 主题可见性和滚动位置观察；各主题下代码块、公式、表格、图表的逐元素视觉质量仍需继续细测。

### P0-SETTINGS-001 复测更新：真实 App 设置内容不是空白

- 严重度：记录更新
- 用例 ID：PRISM-FF-077、PRISM-FF-079、PRISM-FF-080、PRISM-FF-081、PRISM-FF-082、PRISM-FF-083、PRISM-FF-084
- 触发动作：2026-06-29 在真实 `/Applications/Prism.app` 中打开设置中心，依次查看六个分区。
- 问题表现：真实 App 中设置内容正常显示。
- 已验证分区：
  - 通用：界面语言、默认视图、快捷键显示。
  - 写作：显示行号、自动保存、自动保存策略、编辑器字体/字号/行高。
  - 外观：内容主题、主题管理、预览字体/字号、导入字体。
  - 导出：导出模板、PDF 纸张、Front matter 覆盖、目录、PDF 边距、页码、页眉页脚。
  - 引用：Pandoc 路径、检测、参考文献文件、CSL 样式文件、引用导出状态。
  - 文件：启动时恢复上次窗口、最近文档数量、清空最近文档。
- 预期表现：报告中应把 browser mock 空白归因于 mock/测试环境，而非真实 App 当前缺陷。
- 复现稳定性：本轮真实 App 稳定可见。
- 截图/证据：Computer Use 实时截图可见各设置分区。
- 真实截图：
  - `screenshots/15-computer-use-real-app/PRISM-CU-050-settings-general-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-051-settings-writing-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-052-settings-appearance-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-053-settings-export-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-055-settings-citations-pandoc-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-056-settings-files-window.png`
- 备注：仍存在 `P1-SETTINGS-002` 的可访问性问题。

### P0-SETTINGS-001 设置弹窗右侧内容区域空白

- 严重度：P0
- 用例 ID：PRISM-FF-077、PRISM-FF-079、PRISM-FF-080、PRISM-FF-081、PRISM-FF-082、PRISM-FF-083、PRISM-FF-084、PRISM-FF-104
- 触发动作：
  1. 通过 Playwright + Tauri IPC mock 打开指南文档。
  2. 依次发送 `prism-open-settings` 到 `general`、`writing`、`appearance`、`export`、`citations`、`files`。
  3. 截图设置弹窗。
- 问题表现：
  - 设置弹窗外壳可见，左侧分类可见。
  - 右侧设置内容区域为空白，不能看到语言、默认视图、行号、自动换行、主题、字体、导出、Pandoc、最近文件等具体控件。
  - 自动化进一步点击“显示行号”“打开主题目录”等文本时均超时。
- 预期表现：每个设置分区都应显示对应控件，且可进行修改、保存和持久化验证。
- 复现稳定性：2026-06-29 重跑 browser mock 稳定复现。
- 截图/证据：
  - `screenshots/10-settings-themes/PRISM-FF-080-general-settings.png`
  - `screenshots/10-settings-themes/PRISM-FF-081-writing-settings.png`
  - `screenshots/10-settings-themes/PRISM-FF-082-appearance-settings.png`
  - `screenshots/10-settings-themes/PRISM-FF-083-font-settings.png`
  - `screenshots/10-settings-themes/PRISM-FF-084-files-settings.png`
  - `screenshots/09-export/PRISM-FF-077-export-settings.png`
  - `screenshots/09-export/PRISM-FF-079-pandoc-citations-settings.png`
  - `logs/click-skip.log`
- 备注：此前这些设置用例被错误标为 Pass；本轮视觉抽查后已在 `manifest.json` 中改为 Fail。

### P1-I18N-001 默认中文 locale 下多处 UI 仍显示英文

- 严重度：P1
- 用例 ID：PRISM-FF-085、PRISM-FF-109、PRISM-FF-113、PRISM-FF-136
- 触发动作：
  1. 使用测试默认配置 `locale: zh-CN` 启动 browser mock。
  2. 打开主窗口、Callout picker、设置弹窗和渲染错误 action。
- 问题表现：
  - 主菜单显示 `File/Edit/Insert/Format/Navigate/View/Export/Window/Help`。
  - 侧栏 tab 显示 `Files/Outline`。
  - Callout picker 显示 `Insert Callout`、`Choose a callout style`、`Note/Warning/Tip/Important`。
  - 渲染错误按钮显示 `Jump to Source`。
  - 设置弹窗标题和分区说明也显示英文。
- 预期表现：中文 locale 下主菜单、侧栏、设置、浮层、错误 action 均应显示中文文案；如果有自动语言策略，也应在 manifest/设置中明确记录当前语言来源。
- 复现稳定性：2026-06-29 browser mock 稳定复现。
- 截图/证据：
  - `screenshots/04-editor/PRISM-FF-109-callout-callout.png`
  - `screenshots/06-diagnostics/PRISM-FF-113-action-action.png`
  - `screenshots/10-settings-themes/PRISM-FF-081-writing-settings.png`
  - `logs/click-skip.log`
- 备注：该问题也导致中文文本定位的自动化步骤失败，例如“显示行号”“查看源码”“简体中文”等选择器找不到。

## 主菜单、帮助与更新

### P1-MENU-002 原生 File 菜单缺少 Prism 核心文件入口

- 严重度：P1
- 用例 ID：PRISM-FF-091
- 用户影响：macOS 用户无法从系统菜单栏执行打开文件、打开文件夹、新建文稿、保存等核心文件操作，也无法验证“打开已有文档时新窗口策略”。
- 触发动作：
  1. 在真实 `/Applications/Prism.app` 中打开一个 Markdown fixture。
  2. 点击 macOS 系统菜单栏 `File`。
  3. 检查可见菜单项。
- 问题表现：原生 `File` 菜单只显示 `Close Window` 和 `Close All`，没有 Prism 自定义的新建、打开、保存、另存为、打开最近等文件操作入口。
- 预期表现：原生 `File` 菜单应暴露核心文件工作流；若 Prism 选择自绘菜单，也要保证系统菜单与自绘菜单语义不冲突，并至少保留 macOS 标准菜单能力。
- 复现稳定性：2026-06-30 真实 App + Computer Use 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-226-native-file-menu-missing-open-entry-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-227-native-file-menu-only-close-window.png`
- 建议修复方向：检查 Tauri/macOS menu 构建逻辑，确保窗口创建后注册完整应用菜单；同时消除“文件 > 新建文稿”和“窗口 > 新建窗口”的语义重复。
- 验收标准：系统菜单栏 `File` 可见新建文稿、打开文件、打开文件夹、最近打开、保存、另存为、关闭文稿等入口；各入口行为与窗口内菜单一致。
- 修复进展：2026-06-30 源码已在 Tauri setup 注册原生 app menu，File/Edit/View/Window/Help 暴露 Prism 核心入口；自定义菜单项通过 Tauri event 桥接到现有前端 `command.run` 逻辑。`useAppCommandContext` 已补 native menu event 回归测试，`cargo check` 通过；待换包后用 macOS 系统菜单真实复测。

### P1-PRINT-001 打印入口未暴露，快捷键无反应

- 严重度：P1
- 用例 ID：PRISM-FF-142
- 触发动作：
  1. 在真实 `/Applications/Prism.app` 窗口打开 `real-complex-diagrams-export.md`。
  2. 按 `Cmd+P`。
  3. 检查是否出现系统打印面板。
  4. 打开窗口内“文件”菜单检查是否存在“打印”入口。
- 问题表现：
  - `Cmd+P` 后未调出系统打印面板，窗口仍停留在当前文档。
  - “文件”菜单只显示新建文稿、打开文件、打开文件夹、最近打开、保存、另存为、在访达中显示、设置、关闭文稿，没有“打印”。
- 预期表现：执行打印应调出系统打印面板，不改变文档内容；如果当前构建不支持打印，也应在菜单或 toast 中明确不可用原因。
- 复现稳定性：2026-06-29 真实 App 复测一次，快捷键与菜单路径均未发现打印入口。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-144-print-file-menu-no-print-window.png`
- 备注：本轮没有点击任何系统打印确认按钮，不会实际打印。

### P1-HELP-001 检查更新缺少可见最终态

- 严重度：P1
- 用例 ID：PRISM-FF-088、PRISM-FF-145
- 触发动作：
  1. 打开 `帮助 > 检查更新`。
  2. 观察底部 toast。
  3. 等待 6 秒后再次读取窗口状态。
- 问题表现：
  - 点击后出现 `正在检查更新...` loading toast。
  - loading toast 消失后没有看到 `已是最新版`、`检查失败` 或 `发现新版本` 等最终结果。
- 预期表现：检查更新必须给出明确最终态，成功、失败、最新版本、可更新都应有可见反馈。
- 复现稳定性：本轮真实 App 连续复测两次，均未观察到最终态。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-062-help-check-update-loading-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-063-help-check-update-after-6s-window.png`
- 备注：不判断网络/更新服务是否可用，只记录 UI 反馈不足。

### P1-HELP-002 Prism 迁移帮助入口打开 GitHub 404

- 严重度：P1
- 用例 ID：PRISM-FF-143
- 触发动作：
  1. 在真实 `/Applications/Prism.app` 中打开帮助菜单。
  2. 点击 `Prism 迁移帮助`。
  3. 观察默认浏览器打开结果。
- 问题表现：
  - Chrome 打开 `https://github.com/AlexPlum405/Prism/blob/main/docs/help/prism-migration-guide.md`。
  - 页面标题为 `File not found`，迁移指南内容不可读。
- 预期表现：迁移帮助入口应打开可读迁移指南，或在文档不存在时隐藏入口/显示明确不可用反馈。
- 复现稳定性：2026-06-30 真实 App + Computer Use 复测一次，稳定打开 404 页面。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-147-help-link-migration-file-not-found-chrome.png`
- 备注：同一轮复测中 `Markdown 参考`、`GitHub`、`反馈` 分别可打开 Markdown Guide、Prism 仓库和 GitHub Issues。

## macOS 平台集成

### P1-WINDOW-001 macOS 最小化和缩放/全屏动作没有生效

- 严重度：P1
- 用例 ID：PRISM-FF-140
- 用户影响：用户点击窗口黄灯、使用 `Cmd+M`、原生 `Window > Minimize` 或缩放/全屏动作时，窗口状态没有按 macOS 标准行为变化，影响多窗口管理和全屏写作。
- 触发动作：
  1. 在真实 `/Applications/Prism.app` 中打开 Markdown 文档。
  2. 尝试通过 `AXMinimized`、交通灯黄灯、`Cmd+M`、原生 `Window > Minimize` 执行最小化。
  3. 尝试执行全屏按钮的 `zoom the window` secondary action。
  4. 读取 `AXMinimized`、on-screen Prism 窗口数并截图。
- 问题表现：
  - `AXMinimized` 设置后仍为 `false`。
  - 原生 `Window > Minimize` 后 `AXMinimized=false`，屏幕上仍有 Prism 窗口。
  - `zoom the window` 后截图尺寸仍为 `2424x1744`，没有明显缩放或全屏变化。
  - `Cmd+M` 没有最小化，还导致当前文档路径切到默认 Prism 指南，快捷键行为异常。
- 预期表现：最小化、恢复、缩放/全屏均应使用 macOS 标准窗口行为；执行后状态可观测，恢复后文档和滚动位置保持。
- 复现稳定性：2026-06-30 真实 App + Computer Use/System Events 复测。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-231-window-restored-after-minimize-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-232-window-restored-after-native-minimize-window.png`
  - `screenshots/15-computer-use-real-app/PRISM-CU-233-window-zoom-action-no-size-change-window.png`
  - `logs/computer-use-real-app/window-lifecycle-20260630.log`
  - `logs/computer-use-real-app/window-lifecycle-native-menu-20260630.log`
- 建议修复方向：检查自定义标题栏与 Tauri/macOS 窗口控制绑定，确保交通灯、原生 Window 菜单和快捷键都调用同一窗口 API；避免编辑器快捷键拦截系统 `Cmd+M`。
- 验收标准：黄灯、`Cmd+M`、`Window > Minimize` 均能最小化；Dock/open 恢复后仍显示同一文档；Zoom/全屏动作改变窗口状态并可恢复。
- 修复进展：2026-06-30 源码已让原生 Window 菜单的最小化、缩放、全屏走 Rust/Tauri 当前 Prism 文档窗口路径，不依赖前端焦点快捷键；macOS close/reopen 生命周期也已扩展到 `main` 和 `prism-*` 文档窗口。`cargo check` 通过；交通灯和系统窗口状态仍需换包后真实复测。

### P1-WINDOW-002 Close Window / reopen 生命周期状态不完整

- 严重度：P1
- 用例 ID：PRISM-FF-141
- 用户影响：用户关闭窗口后再从 Dock 或 `open -a` 回到 Prism，窗口状态可能不是标准恢复路径；多窗口数量和当前文档状态不清晰。
- 触发动作：
  1. 在真实 Prism 窗口执行原生 `Window > Close Window`。
  2. 统计 on-screen Prism 窗口数量。
  3. 执行 `open -a /Applications/Prism.app`。
  4. 再次统计窗口数量并截图。
- 问题表现：
  - 关闭前 on-screen Prism 窗口数为 3。
  - `Close Window` 后降为 2。
  - `open -a` 后仍为 2，没有恢复到关闭前窗口数。
  - 仍能显示一个文档窗口，但 close/reopen 的窗口生命周期状态不完整。
- 预期表现：关闭窗口后 reopen 应恢复主窗口；如果产品只允许单窗口，也应保证窗口数和当前文档状态一致，不留下隐藏/残留窗口。
- 复现稳定性：2026-06-30 真实 App + System Events 复测一次。
- 截图/证据：
  - `screenshots/15-computer-use-real-app/PRISM-CU-234-window-reopened-after-close-window.png`
  - `logs/computer-use-real-app/window-close-reopen-20260630.log`
- 建议修复方向：梳理 Tauri window close/reopen 事件，统一隐藏、关闭、新建主窗口策略；记录/清理内部窗口，避免 Window 菜单和 CGWindowList 出现残留状态。
- 验收标准：`Close Window` 后窗口状态明确；Dock/open reopen 后主窗口出现且只保留预期窗口；当前文档、工作区和标题栏状态一致。
- 修复进展：2026-06-30 源码已将 macOS close/reopen 处理从仅 `main` 窗口扩展到 `main` 与 `prism-*` 文档窗口，关闭时 prevent_close + hide，reopen/opened 时 show/unminimize/focus 首选 Prism 窗口。`cargo check` 通过；待换包后真实复测 on-screen 窗口数量和 Dock reopen。

## Windows/Linux 待真机回填
