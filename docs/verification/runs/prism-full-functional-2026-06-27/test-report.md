# Prism 全功能测试报告

日期：2026-06-27
App：/Applications/Prism.app
Bundle ID：com.prism.editor.v1
版本：1.4.1
测试工作区：/tmp/prism-full-functional-test-workspace
测试用例来源：docs/verification/prism-full-functional-test-cases.md

## 总体结论

测试继续推进，并在 2026-06-29 恢复了真实 `/Applications/Prism.app` + Computer Use 验证。旧结论“Computer Use 不可用、真实 App 完全不可测”不再成立：本轮真实窗口中已验证编辑/预览/分栏、快速打开、全文搜索、替换、设置六个分区、完整主菜单、文件树菜单、帮助弹窗、知识面板、图表预览、任务列表与脚注等功能。

截图落盘权限也已恢复，本轮统一保存真实 Prism 窗口/屏幕状态，避免再次误抓其他显示器。当前 `screenshots/15-computer-use-real-app/` 内有 195 张真实 Prism/导出产物/Finder 截图，并已全部登记到 `manifest.json` 的 `computerUseRealAppEvidence`。

2026-06-29 继续补测文件类型与导出：Markdown fixture 可正常打开；但真实 App 通过系统路径打开 JSON/SQL/TXT 会进入空白白屏窗口，`PRISM-FF-008` 已从 browser mock Pass 改为真实 App Fail。错误文档 preflight 已真实阻断 HTML 导出；干净 Markdown fixture 的 HTML/PDF/PNG/DOCX 四种真实导出已完成基础验收，PNG 保持 `极致 4x` 输出为 `4160x4800`，DOCX 通过 zip 结构和 `textutil` 正文提取校验。

2026-06-29 追加复杂图表导出补测：`real-complex-diagrams-export.md` 覆盖 Mermaid、PlantUML、Markmap、本地 SVG、表格和数学公式；HTML/PDF/PNG/DOCX 均通过真实 Prism 导出并生成产物。PNG 为 `4108x11072`，保持 4x 宽度；PDF 为 2 页 A4；DOCX 为有效 Office Open XML 且包内含图表与公式媒体。该补测发现 PlantUML 顶部 `Prism` 节点文字在预览与导出中缺失，以及 PDF 孤立标题分页问题。真实 App 中 `Shift+F12` 可打开 Web Inspector，DevTools 用例从 browser mock 未覆盖修正为真实 App Pass；打印用例真实复测失败，`Cmd+P` 和文件菜单均未暴露打印；帮助菜单的 Markdown 参考外链已打开 Chrome 参考页面，剩余帮助外链尚待继续复测。

`P0-STARTUP-002` 保留为窗口生命周期待复测问题：此前从临时文件切回默认指南后曾出现“进程存在但窗口数为 0”的状态；但本轮开始时真实 Prism 窗口已恢复，可继续执行 UI 测试。后续需要单独设计非破坏性启动/新窗口复测，不再把它当作当前测试会话的活动阻塞。

Playwright 浏览器 + Tauri IPC mock 截图仍保留为前端补充证据，可用于视觉参考和宣传素材初筛，但不能替代真实 Tauri WebView / macOS App 验证。报告中凡标注 browser mock 的 Pass，都需要与真实 App 证据区分。

2026-06-29 20:53 后续 UI 测试暂停在执行环境层面：macOS 图形会话已锁屏，`ioreg` 显示 `CGSSessionScreenIsLocked=Yes`，Computer Use 对 Prism/Finder/Chrome 均返回 `cgWindowNotFound`。这不是 Prism 产品问题，已记录到 `logs/computer-use-real-app/screen-locked-blocker-2026-06-29.log`；当前已有旧 `caffeinate` 进程仅防系统睡眠，尝试在锁屏状态下新建 `caffeinate -dims` 未能保持运行，状态记录见 `logs/computer-use-real-app/caffeinate-ui-test.status`。继续真实 UI 测试前需要先人工解锁图形会话。

2026-06-30 09:34 图形会话已解锁，Computer Use 对 Prism 恢复可读。本轮继续补测帮助外链：Markdown 参考、GitHub、反馈入口可打开对应页面；`Prism 迁移帮助` 打开 GitHub `File not found`，新增 `P1-HELP-002`。

2026-06-30 继续补测状态栏、设置、文件树、诊断、大文件保护、自动保存和基础编辑命令：状态栏工作区菜单、文档树/列表切换、设置 > 写作 > 显示行号热更新、文件树展开/右键菜单/排序入口、图片诊断弹窗、大文件警告与取消、自动保存落盘均通过真实 App 验证。新增失败项：Typography 排版诊断入口未渲染（`P0-DIAGNOSTICS-002`），基础编辑区选区复制没有写入系统剪贴板并阻塞多格式复制（`P0-EDITOR-004`）。

2026-06-30 追加补测块格式、段落/章节操作、表格工具栏、表格排序/TSV 复制、图片插入/粘贴、Front Matter 覆盖导出和外部修改冲突。块格式、块级操作、表格浮动工具栏与表格 TSV/排序通过真实 UI 验证；图片文件选择插入通过但剪贴板图片粘贴失败（`P0-EDITOR-005`）；Front Matter 覆盖导出的 title/author 生效但 `export.toc` 未生成目录（`P0-EXPORT-006`）；dirty 状态下外部修改没有弹出冲突处理入口（`P0-FILE-003`）。

2026-06-30 恢复快照用例完成真实验证：为 `real-recovery.md` 写入专用恢复 JSON 后，重启 Prism 弹出“恢复文档”弹窗，显示文档名、路径、快照时间以及“丢弃快照 / 恢复这个版本”按钮；点击恢复后编辑器载入快照内容并显示“已恢复本地快照”toast。恢复测试后已清理专用快照并恢复 fixture 初始内容。

2026-06-30 开始推进 P1 文件/工作区用例：当前文档从文件树重复打开通过，界面保持同一可见文档和高亮状态；dirty guard 用例未能稳定制造前置条件，输入探针后自动保存先于文件切换完成，因此记录为 Blocked，后续需通过关闭自动保存或注入保存延迟专项复测。

2026-06-30 继续补测编辑器横向滚动：新增长行 fixture，关闭自动换行后长行保持单行溢出，按 End 可把视口移动到行尾，状态栏列号到 `5:485`；测试后已恢复自动换行。

2026-06-30 补测预览链接点击：wiki link、相对 Markdown link、外链均可见；但 wiki link 和相对 Markdown link 单击只产生 hover/下划线，不触发打开，双击才会打开目标文档。新增 `P1-PREVIEW-005`，`PRISM-FF-114/115` 标记为 Fail。

2026-06-30 补测渲染错误 action：非法 Mermaid 在预览态显示可读错误块、源码行号和“跳到源码”按钮；点击后界面切到分栏，编辑侧光标定位到 Mermaid 错误源码附近，状态栏显示 `7:1`。`PRISM-FF-113` 标记为 Pass。

2026-06-30 补测预览源码 flash：点击预览侧错误块“跳到源码”后，编辑区可稳定定位到 Mermaid 源码附近，但 Computer Use 点击返回与截图延迟无法稳定捕捉短暂高亮动画。`PRISM-FF-116` 标记为 Blocked，后续需用录屏或可控动画时长专项复测。

2026-06-30 补测图片诊断异步更新：缺失图片路径触发 `ERROR 1`；把 Markdown 图片路径改成已存在 PNG 后，`ERROR` 不重启即可消失，`PRISM-FF-112` 标记为 Pass。附带发现：如果只把缺失图片文件补到原路径而不改 Markdown 内容，诊断不会自动刷新，新增 `P2-DIAGNOSTICS-003`。

2026-06-30 复核导出产物：`real-complex-diagrams-export.html` 通过 Chrome `file://` 离线打开，结构检查无远程或相对资产引用，Mermaid/PlantUML/Markmap/本地 SVG/表格/数学区域可见；本地 SVG 资源显示为内联图片。复杂 PNG 导出尺寸为 `4108x11072`，顶部/中段/底部切片未见明显拼接白缝或底部裁切。`PRISM-FF-123/124/129` 标记为 Pass。

2026-06-30 复核 DOCX 导出：`real-complex-diagrams-export.docx` 可在 WPS 打开，Mermaid/PlantUML 以图像显示，Table And Math 表格横向铺满页面内容宽度；OOXML 表格宽度为 `9866 dxa`，两列各 `4933 dxa`；inline math 与 block math 在 WPS 中可见，无乱码方框。`PRISM-FF-126/127/128` 标记为 Pass。

2026-06-30 补测文件属性信息：文件树右键菜单和主“文件”菜单均未暴露属性/信息/显示简介入口，用户无法在 Prism 内查看当前文件名称、完整路径、类型、大小、创建/修改时间。新增 `P1-FILE-004`，`PRISM-FF-095` 标记为 Fail。

2026-06-30 补测主题目录打开：设置 > 外观中“打开主题目录”按钮可见，但通过可访问性点击和坐标点击后均没有打开 Finder，也没有 toast 反馈。新增 `P1-SETTINGS-003`，`PRISM-FF-104` 标记为 Fail。

2026-06-30 补测关系图谱交互：`real-wiki-target.md` 可打开关系图谱，显示当前文档与 `Link Click Fixture` 入链；搜索不存在节点显示“没有可显示的关系”；点击 `Link Click Fixture` 后焦点和右侧详情切换，并扩展显示相对链接和 wiki 链接目标；拖拽尝试后布局保持稳定。`PRISM-FF-121` 标记为 Pass。

2026-06-30 继续补测启动默认指南、Selection callout、工作区搜索回退、图谱 fallback 可观测性、导出取消/后台状态/成功动作、外部文件打开同步工作区、原生 File 菜单、文件树创建副本和新建文件夹。新增失败项：启动/新窗口未直接打开 `Examples/Prism Markdown 语法指南.md`（`P0-STARTUP-003`）、Selection callout 丢失当前选区（`P1-EDITOR-006`）、选区右键菜单剪切/复制/链接 disabled（`P1-EDITOR-007`）、工作区全文搜索入口不可达（`P1-SEARCH-001`）、原生 File 菜单缺少 Prism 核心文件入口（`P1-MENU-002`）。新增通过项：外部 Markdown 打开会同步工作区、文件树创建副本、工作区菜单新建文件夹、导出取消和后台导出状态。

2026-06-30 收尾补测剩余可安全执行项：新增文件 `real-index-incremental-20260630.md` 后，不重启 App 重新激活可在文件树看到新文件，`PRISM-FF-117` 标记 Pass，但即时刷新仍需后续关注；真实导出 `real-links-click.pdf` 成功，平台 PDF capture 可用，但 PDF 内没有 `/URI`、`/Annots`、`/Link`，`PRISM-FF-122` 标记 Fail；Finder 中 `.md` 文件显示 Markdown 文档图标，`PRISM-FF-146` 标记 Pass；macOS 最小化、缩放和 close/reopen 生命周期未按标准行为变化，`PRISM-FF-140/141` 标记 Fail。删除、重命名父文件夹、用户主题包、字体导入、设置错误、断网、Worker/内存/超大工作区等需要破坏性操作、真实平台或注入故障的项目均标记 Blocked，并写明原因。

2026-06-30 源码修复批次已覆盖本轮 P0/P1 中的启动/系统打开文本文件、dirty 外部修改冲突、Typography 入口、基础剪贴板、图片粘贴、Selection callout、选区右键、工作区搜索、原生 macOS File 菜单和窗口菜单路径。自动化验证已通过：相关 Vitest 批次 17 个文件 / 190 条断言通过，`cargo check` 通过，`npm run build` 通过，`git diff --check` 通过。由于尚未重新打包替换 `/Applications/Prism.app` 并做真实 UI 复测，统计中的真实 App Fail 数暂不改为 Pass，相关 issue 记录为“源码已修复，待换包回归”。

## 执行统计

- 总用例：168
- P0：88
- P1：56
- P2：16
- P3：8
- Pass：94
- Fail：44
- Blocked：30
- Not Run：0
- P0 执行：Pass 58 / Fail 29 / Blocked 1 / Not Run 0
- P1 执行：Pass 29 / Fail 14 / Blocked 13 / Not Run 0
- P2 执行：Pass 5 / Fail 0 / Blocked 11 / Not Run 0
- P3 执行：Pass 2 / Fail 1 / Blocked 5 / Not Run 0
- 当前截图文件总数：326
- Manifest 真实 Computer Use 截图引用：195
- Pipeline/环境证据截图：9
- 真实 Computer Use 截图：195（`screenshots/15-computer-use-real-app/`）
- 单元/集成测试批次：5
- 单元/集成测试文件通过：53
- 单元/集成测试断言通过：484
- 单元/集成测试失败执行：2（同一条失败在批量与单独复跑中各出现一次）
- 唯一单元失败：1
- 原生 macOS app 窗口验证：当前恢复可测；最小化、缩放、close/reopen 生命周期已真实复测并记录失败
- 浏览器 mock 补充截图：已执行，用于保留前端视觉证据和宣传素材初筛
- Windows/Linux 真机验证：未执行，保持 Blocked，不伪造结果

## 截图与证据

- 截图目录：screenshots/
- 导出产物：exports/
- 日志目录：logs/
- Manifest：manifest.json
- 问题记录：issues.md
- 测试辅助脚本：run-ui-screenshots.mjs
- 临时 Tauri 可见窗口配置：tauri.visible-test.conf.json
- 原生启动日志：logs/relaunch.log、logs/visible-dev-window-check.log、logs/menu-enumeration.log
- 原生复核日志：logs/native-window-recheck-*.log，历史无窗口复核为 `logs/native-window-recheck-150348.log`
- 真实 Computer Use 截图：screenshots/15-computer-use-real-app/
- 真实 Computer Use 历史无窗口阻塞日志：logs/computer-use-real-app/windowless-after-file-switch.log
- 无窗口进程采样：logs/computer-use-real-app/windowless-sample.txt
- 直接启动日志：logs/computer-use-real-app/direct-executable-launch.log、logs/computer-use-real-app/direct-clean-home-launch.log
- 真实导出产物校验日志：logs/computer-use-real-app/export-artifact-validation.log
- 屏幕锁定阻塞日志：logs/computer-use-real-app/screen-locked-blocker-2026-06-29.log
- 防睡眠状态记录：logs/computer-use-real-app/caffeinate-ui-test.status
- 浏览器 mock 日志：logs/playwright-console.log、logs/playwright-body-start.txt、logs/elements-startup.json
- 2026-06-30 安装版 smoke 报告：logs/app-smoke-installed-20260630/report.json
- 2026-06-30 安装版 smoke 截图：screenshots/16-installed-app-smoke/

## 2026-06-30 修复批次状态

- 已重新打包并替换 `/Applications/Prism.app`，Info.plist 身份为 `com.prism.editor.v1`，版本 `1.4.1`，Markdown 文档图标资源和 `Resources/Initial` 均在安装包内。
- `npm run tauri:build:app-smoke` 已通过，覆盖构建产物的启动、诊断、Quick Open、保存、导出菜单、设置中心和复杂导出产物。
- `PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs` 已通过，覆盖真实安装版 `.markdown` 中文/空格路径、JSON、SQL、TXT、Markdown 启动不白屏、ERROR 状态栏诊断、Quick Open、基础编辑保存、导出菜单、设置中心、HTML/PDF/PNG/DOCX 复杂导出产物。
- 原始全功能截图中的 Fail 不直接改写为 Pass；本节只证明安装版 smoke 覆盖的路径已经回归通过。剩余 P0/P1 项仍需按原 manifest 用例逐项真实 UI 复测后再改状态。

## 最高优先级问题

1. P0-FILE-001：默认指南文档打开后自带 `ERROR 1`，目录链接 `#文本格式` 缺失 heading。
2. P0-FILE-002：真实 App 通过系统打开 JSON/SQL/TXT 会进入空白白屏窗口。2026-06-30 安装版 smoke 已覆盖 JSON/SQL/TXT 不白屏，待原用例截图复测后更新状态。
3. P0-KNOWLEDGE-001：反链面板未显示测试工作区中存在的反链。
4. P0-KNOWLEDGE-002：关系图谱入口在当前文档下禁用/未能打开图谱面板。
5. P0-STARTUP-003：启动/新窗口没有直接打开默认 Prism 指南，而是显示空正文和“未命名”。2026-06-30 安装版 smoke 已覆盖启动默认文档，待原用例截图复测后更新状态。
6. P0-FILE-003：dirty 状态下外部修改未弹出冲突处理入口，直接静默合并为已保存。
7. P0-DIAGNOSTICS-002：Typography 排版诊断入口未渲染，用户无法打开排版提示面板。
8. P0-EDITOR-004：真实编辑区复制/粘贴链路未把选区写入系统剪贴板，阻塞多格式复制验收。
9. P0-EDITOR-005：图片剪贴板粘贴未进入资产管线，无法从剪贴板直接插入图片。
10. P1-MENU-002：原生 macOS File 菜单缺少 Prism 核心文件入口。

## 本轮新增有效截图覆盖

- 文件与工作区：Markdown、JSON/SQL/TXT、Unsupported file、新建文稿、保存状态、文件树基础。
- 编辑与预览：视图模式、编辑搜索、替换、预览搜索、Slash、README 模板、Wiki 补全、表格插入、专注模式、打字机模式。
- 渲染：基础 Markdown、Front Matter、非法 YAML、KaTeX、Mermaid、PlantUML、Markmap、本地图片、安全 HTML、长文档 top/middle/bottom、演示模式。
- 知识与诊断：属性、链接、反链、图谱失败态、当前文档关系图谱交互、大纲、broken-links 错误态。
- 设置与主题：通用、写作、外观、字体、文件、导出、引用/Pandoc、MiaoYan/Inkstone/Slate/Mono/Nocturne/Carbon。
- 2026-06-29/30 补充截图：CodeMirror 编辑态主题、Callout picker、Markdown 列表编辑、渲染错误 action、toast、导出失败诊断 UI、真实 App DevTools、打印入口缺失、帮助 Markdown 参考/GitHub/反馈外链、迁移帮助 404、帮助/更新入口、reduced motion。
- 2026-06-29 真实 Computer Use 补测：编辑/预览/分栏切换、Quick Open、全文搜索、预览态触发替换自动切分栏、文档属性、当前文档链接、反向链接、文件树展开、文件/文件夹右键菜单、快捷键、关于、检查更新、预览态任务列表勾选。
- 2026-06-29 16:50 以后追加真实窗口级截图：PlantUML/Markmap、引用/任务列表/脚注、File/Edit/Insert/Format/Navigation/View/Export/Window/Help 九组菜单、设置六分区、快捷键、关于、检查更新 loading/6 秒后状态、文档属性、当前链接、反链空状态、大纲与大纲搜索、文件树与上下文菜单。
- 2026-06-29 追加真实响应式与主题截图：1024x768、窄窗口、低高度窗口，以及 `MiaoYan / Inkstone Light / Slate Manual / Mono Lab / Nocturne Dark / Carbon Black` 六个内容主题的真实分栏窗口证据。
- 2026-06-29 追加真实文件类型与导出截图：Markdown fixture 打开、JSON/SQL/TXT 白屏失败、HTML/PDF/PNG/DOCX 导出对话框、导出前台任务、导出完成回到编辑态。
- 2026-06-29 追加真实导出 preflight 截图：broken-links fixture 的 `ERROR 3`、诊断弹窗、导出菜单和 HTML preflight 阻断提示。
- 2026-06-29/30 追加复杂图表导出截图：复杂文档 Mermaid/PlantUML/Markmap/本地 SVG/表格/数学公式预览，HTML/PDF/PNG/DOCX 导出对话框、前台任务、PNG/PDF 导出产物视觉证据，HTML 离线自包含打开、本地资源显示、PNG 顶部/中段/底部切片、WPS 打开 DOCX 图表页和表格/公式页。
- 2026-06-29 追加最近文件截图：文件菜单“最近打开”入口和最近文件子菜单列表。
- 2026-06-29 追加视图菜单截图：自动换行入口可见，未发现显示行号入口；行号仍按“设置 > 写作”口径待验收。
- 2026-06-30 追加状态栏与设置截图：工作区菜单、文档列表切换、排序方式子菜单、设置 > 写作 > 显示行号开关、行号开启/恢复、设置 > 外观主题目录入口及点击无 Finder 反馈。
- 2026-06-30 追加诊断与编辑截图：图片/链接 ERROR 诊断弹窗、Typography 入口缺失、11MB 大文件警告、自动保存 dirty/saved 状态、基础撤销/重做、选区工具条与复制失败证据。
- 2026-06-30 追加块/表格/图片/Front Matter/冲突截图：块格式菜单、块级操作右键菜单、表格浮动工具栏、表格更多菜单与排序结果、图片插入路径、图片剪贴板粘贴失败、Front Matter 导出覆盖设置、外部修改冲突未弹出处理入口。
- 2026-06-30 追加恢复快照截图：启动恢复弹窗和恢复后编辑器内容/toast。
- 2026-06-30 追加 P1 文件/工作区截图：重复打开当前文档、dirty guard 被自动保存时序阻塞后的切换结果、文件树右键菜单和主文件菜单缺少属性/信息入口。
- 2026-06-30 追加横向滚动截图：关闭自动换行后按 End 到长行尾部。
- 2026-06-30 追加预览链接、渲染错误 action、源码定位与图片诊断异步截图：链接 fixture 基线、wiki link 双击后目标、相对 Markdown link 双击后目标、预览错误块、跳到源码后的分栏定位、预览源码 flash 未稳定捕捉证据、缺失图片错误、补齐文件但诊断未刷新、修正路径后错误清除。
- 2026-06-30 追加启动/菜单/导出/文件树截图：默认 Prism 指南未打开、Selection callout 丢选区、工作区搜索快捷键回到文档查找、图谱 fallback 状态不可观测、导出取消/成功/后台任务、外部文件打开同步工作区、原生 File 菜单缺少打开入口、文件树创建副本、工作区菜单新建文件夹。
- 2026-06-30 追加收尾截图：窗口最小化/缩放/关闭恢复异常、增量索引新增文件、Finder Markdown 文件图标、链接 fixture PDF 导出完成。
- 2026-06-29 补充单元/集成测试：文件打开/自动保存/冲突/恢复、编辑命令、富复制、块操作、图片、表格、诊断、文件树、导出 preflight、导出设置、命令注册、主题、更新、工作区索引、反链、图谱、i18n、toast、reduced motion。
- 菜单与帮助：File/Edit/Insert/Format/Navigate/View/Export/Window/Help、快捷键、关于、检查更新。
- 布局：1024x768 窄窗口、低高度窗口。

## 未覆盖风险

- 当前真实 App 窗口可测；2026-06-30 安装版 smoke 已覆盖启动默认文档和 JSON/SQL/TXT 不白屏。最小化/缩放/close-reopen 生命周期仍只有源码修复与构建通过证据，待换包后按原窗口生命周期用例单独复测。
- Windows/Linux 用例未执行，已标记 Blocked；需要真机或真实平台环境回填。
- 浏览器 mock 只验证前端渲染与部分交互，不能证明 Tauri command、文件授权、导出、系统菜单和原生窗口生命周期正确。
- 当前 `screenshots/15-computer-use-real-app/` 下的 195 张截图是真实 Prism/导出产物/Finder 截图；其他 browser-mock 截图可用于前端视觉参考和宣传动图素材筛选，但不应作为“真实 app 已通过”的发布证据。
- 导出类用例已完成错误文档 preflight、干净 Markdown fixture 四格式导出、复杂图表 fixture 四格式导出、复杂 DOCX WPS 视觉打开；仍未覆盖用户指南级长文档分页和超长 PNG 分片压力。
- `manifest.json` 中 Not Run 已清零；Blocked 项不是通过，主要对应删除/重命名、权限拒绝、断网、真实 Windows/Linux、注入故障和压力测试。
