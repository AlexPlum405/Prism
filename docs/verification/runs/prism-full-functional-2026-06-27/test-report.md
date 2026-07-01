# Prism 全功能测试报告

日期：2026-06-27
App：/Applications/Prism.app
Bundle ID：com.prism.editor.v1
版本：1.4.1
测试工作区：/tmp/prism-full-functional-test-workspace
测试用例来源：docs/verification/prism-full-functional-test-cases.md

## 总体结论

测试继续推进，并在 2026-06-29 恢复了真实 `/Applications/Prism.app` + Computer Use 验证。旧结论“Computer Use 不可用、真实 App 完全不可测”不再成立：本轮真实窗口中已验证编辑/预览/分栏、快速打开、全文搜索、替换、设置六个分区、完整主菜单、文件树菜单、帮助弹窗、知识面板、图表预览、任务列表与脚注等功能。

截图落盘权限也已恢复，本轮统一保存真实 Prism 窗口/屏幕状态，避免再次误抓其他显示器。当前 manifest 中登记了 245 条真实 Prism/导出产物/Finder/安装版复测证据，覆盖 `screenshots/15-computer-use-real-app/` 以及后续安装版专项截图目录。

2026-06-29 继续补测文件类型与导出：Markdown fixture 可正常打开；但真实 App 通过系统路径打开 JSON/SQL/TXT 会进入空白白屏窗口，`PRISM-FF-008` 已从 browser mock Pass 改为真实 App Fail。错误文档 preflight 已真实阻断 HTML 导出；干净 Markdown fixture 的 HTML/PDF/PNG/DOCX 四种真实导出已完成基础验收，PNG 保持 `极致 4x` 输出为 `4160x4800`，DOCX 通过 zip 结构和 `textutil` 正文提取校验。

2026-06-29 追加复杂图表导出补测：`real-complex-diagrams-export.md` 覆盖 Mermaid、PlantUML、Markmap、本地 SVG、表格和数学公式；HTML/PDF/PNG/DOCX 均通过真实 Prism 导出并生成产物。PNG 为 `4108x11072`，保持 4x 宽度；PDF 为 2 页 A4；DOCX 为有效 Office Open XML 且包内含图表与公式媒体。该补测发现 PlantUML 顶部 `Prism` 节点文字在预览与导出中缺失，以及 PDF 孤立标题分页问题。真实 App 中 `Shift+F12` 可打开 Web Inspector，DevTools 用例从 browser mock 未覆盖修正为真实 App Pass；打印用例真实复测失败，`Cmd+P` 和文件菜单均未暴露打印；帮助菜单的 Markdown 参考外链已打开 Chrome 参考页面，剩余帮助外链尚待继续复测。

`P0-STARTUP-002` 的历史“进程存在但窗口数为 0”问题已通过 2026-06-30 窗口生命周期专项重新验证：红色关闭按钮后窗口数变为 0，`open -a /Applications/Prism.app` 可恢复为 1 个窗口。启动/新窗口默认指南按 `P0-STARTUP-003` 单独跟踪，并已在 2026-06-30 追加冷启动与 `File > 新建窗口` 安装版复测。

Playwright 浏览器 + Tauri IPC mock 截图仍保留为前端补充证据，可用于视觉参考和宣传素材初筛，但不能替代真实 Tauri WebView / macOS App 验证。报告中凡标注 browser mock 的 Pass，都需要与真实 App 证据区分。

2026-06-29 20:53 曾因 macOS 图形会话锁屏暂停 UI 测试，记录见 `logs/computer-use-real-app/screen-locked-blocker-2026-06-29.log`；该问题属于执行环境历史阻塞，不是 Prism 产品问题。2026-06-30 后真实 App 复测已恢复。

2026-06-30 09:34 图形会话已解锁，Computer Use 对 Prism 恢复可读。本轮继续补测帮助外链：Markdown 参考、GitHub、反馈入口可打开对应页面；`Prism 迁移帮助` 打开 GitHub `File not found`，新增 `P1-HELP-002`。

2026-06-30 继续补测状态栏、设置、文件树、诊断、大文件保护、自动保存和基础编辑命令：状态栏工作区菜单、文档树/列表切换、设置 > 写作 > 显示行号热更新、文件树展开/右键菜单/排序入口、图片诊断弹窗、大文件警告与取消、自动保存落盘均通过真实 App 验证。新增失败项：Typography 排版诊断入口未渲染（`P0-DIAGNOSTICS-002`），基础编辑区选区复制没有写入系统剪贴板并阻塞多格式复制（`P0-EDITOR-004`）。

2026-06-30 追加补测块格式、段落/章节操作、表格工具栏、表格排序/TSV 复制、图片插入/粘贴、Front Matter 覆盖导出和外部修改冲突。块格式、块级操作、表格浮动工具栏与表格 TSV/排序通过真实 UI 验证；图片文件选择插入通过但剪贴板图片粘贴失败（`P0-EDITOR-005`）；Front Matter 覆盖导出的 title/author 生效但 `export.toc` 未生成目录（`P0-EXPORT-006`）；dirty 状态下外部修改没有弹出冲突处理入口（`P0-FILE-003`）。

2026-06-30 恢复快照用例完成真实验证：为 `real-recovery.md` 写入专用恢复 JSON 后，重启 Prism 弹出“恢复文档”弹窗，显示文档名、路径、快照时间以及“丢弃快照 / 恢复这个版本”按钮；点击恢复后编辑器载入快照内容并显示“已恢复本地快照”toast。恢复测试后已清理专用快照并恢复 fixture 初始内容。

2026-06-30 开始推进 P1 文件/工作区用例：当前文档从文件树重复打开通过，界面保持同一可见文档和高亮状态；dirty guard 用例未能稳定制造前置条件，输入探针后自动保存先于文件切换完成，因此记录为 Blocked，后续需通过关闭自动保存或注入保存延迟专项复测。

2026-06-30 继续补测编辑器横向滚动：新增长行 fixture，关闭自动换行后长行保持单行溢出，按 End 可把视口移动到行尾，状态栏列号到 `5:485`；测试后已恢复自动换行。

2026-06-30 补测预览链接点击：wiki link、相对 Markdown link、外链均可见；但 wiki link 和相对 Markdown link 单击只产生 hover/下划线，不触发打开，双击才会打开目标文档。新增 `P1-PREVIEW-005`，`PRISM-FF-114/115` 标记为 Fail。

2026-07-01 修复并复测 `P1-PREVIEW-005`：`PreviewPane` 对内部 wiki/local Markdown 文档链接增加 `pointerup` 首击兜底，并抑制同一 anchor 随后的 click 重复导航。`PreviewPane/SplitView` 相关测试通过 2 个测试文件 / 61 条；`npm run build` 通过；macOS `.app` 已重新打包并替换 `/Applications/Prism.app`。真实安装版复测确认 `relative target` 和 `real-wiki-target` 均单击一次打开目标文档，`PRISM-FF-114/115` 改为 Pass。证据见 `screenshots/30-installed-preview-link-click-single/`、`logs/computer-use-real-app/preview-link-single-click-postfix-20260701.log` 和 `logs/unit-tests/preview-link-pointerup-20260701.log`。

2026-07-01 批量闭环历史 P0 Fail：依据既有安装版 post-fix 证据，把默认指南启动/新窗口、系统打开文本文件、外部修改冲突、基础剪贴板、图片粘贴、默认指南诊断、Typography 诊断、反链/图谱和设置六分区相关用例从历史 Fail 改为 Pass。此次不新增源码改动，只同步 manifest/report 状态；显式 URL 打开文件/文件夹和图表渲染保真仍保持 Fail，等待专项验证。

2026-07-01 继续闭环图表历史 Fail：真实 `/Applications/Prism.app` 复杂图表复测已证明 Mermaid 和 Markmap 在预览中完整可见，导出产物中也保留图像内容；早期 browser mock 的 transform NaN 控制台噪音不再作为真实 App 当前 Fail。`PRISM-FF-042/044` 改为 Pass。PlantUML 仍保持 Fail，因为真实证据 `PRISM-CU-124/137/139-P1` 仍显示顶部 `Prism` 节点文字缺失。

2026-07-01 补齐显式 URL 启动自动化验收：新增 `?folder=` 覆盖，确认 `openPrismWindow({ folderPath })` 会编码含空格/中文的目录，`useBootstrap` 会优先解码、授权目录、加载文件树并 reveal 窗口；既有 `?file=` 覆盖同步复跑通过。`src/hooks/useBootstrap.test.tsx` 与 `src/lib/openWindow.test.ts` 通过 2 个测试文件 / 18 条测试，`PRISM-FF-005/006` 改为 Pass。证据见 `logs/unit-tests/explicit-url-bootstrap-20260701.log`。

2026-07-01 修复 PlantUML `rectangle Prism` 缺字：`plantuml-little` 真实 SVG 中 `g.entity[data-qualified-name="Prism"]` 只有矩形没有文字，导致预览和导出一起复用空白节点。修复在离线主路径 SVG 后处理阶段补回缺失 entity label，并保持 `plantuml-little` 布局和导出复用。验证通过：`src/hooks/useBootstrap.test.tsx`、`src/lib/openWindow.test.ts`、`src/domains/editor/components/plantUml.test.ts`、`src/domains/export/exportPipeline.test.ts` 共 4 个文件 / 90 条测试；`node scripts/run-plantuml-png-regression.mjs` 同时覆盖 MiaoYan 人物关系图和 Prism Relationship PNG 回归；`npm run build` 通过；`npm run tauri:build -- --bundles app` 产出 `.app` 后仅因缺 updater 私钥在签名阶段失败，已用产物替换 `/Applications/Prism.app` 并截图确认安装版预览中 `Prism` 节点文字可见。`PRISM-FF-043` 改为 Pass。证据见 `screenshots/31-plantuml-regression/PRISM-CU-300-plantuml-png-regression-pass.png`、`screenshots/31-plantuml-regression/PRISM-CU-301-installed-plantuml-prism-label-pass.png`、`logs/unit-tests/url-plantuml-export-20260701.log` 和 `logs/plantuml-regression/plantuml-png-regression-20260701.log`。

2026-07-01 同步 `PRISM-FF-119 / P1-SEARCH-001` 工作区搜索安装版复测状态：既有证据显示 `Cmd+Shift+F` 直接打开“全文搜索 工作区”面板，搜索 `NeedleWorkspaceTerm` 返回根目录和子目录两个命中，回车可打开 `notes/secondary-search-target.md`；manifest 已由历史 Fail 改为 Pass。证据见 `screenshots/24-installed-workspace-search-menu-smoke/01-workspace-search-results.png`、`screenshots/24-installed-workspace-search-menu-smoke/02-workspace-search-result-opened.png` 和 `PRISM-CU-258/259/260`。

2026-07-01 复验 `PRISM-FF-095/104/125`：重新执行 `npm run tauri:build:app-smoke`，备份并替换 `/Applications/Prism.app`，再用真实安装版完成文件属性、打开主题目录和复杂 PDF 分页避切复测。`文件 > 文件属性` 已弹出名称/路径/类型/大小/时间信息；设置 > 外观 > 打开主题目录已显示成功 toast 且 Finder 窗口包含 `themes`；真实覆盖导出的 `real-complex-diagrams-export.pdf` 为 2 页 A4，第 1 页 Mermaid/PlantUML 完整，第 2 页 Markmap 标题与图表同页，表格和数学公式未被分页切半。三项均改为 Pass。证据见 `screenshots/32-installed-p1-fix-retest/` 和 `logs/computer-use-real-app/p1-fix-installed-retest-20260701.md`。

2026-07-01 闭环 `PRISM-FF-142/143`：修复打印快捷键和帮助迁移指南外链。`Cmd+P` 现在保留给系统打印，快速打开迁移到 `Cmd+Shift+P`，默认 Tauri capability 增加 `core:webview:allow-print`；真实安装版复测确认文件菜单显示 `打印 ⌘P`，按 `Cmd+P` 打开 macOS 系统打印 sheet，截图后已取消未打印。迁移指南短期改指当前已存在的 `codex/prism-full-optimization` 分支页面，Chrome 标题不再是 File not found。两项均改为 Pass。证据见 `screenshots/33-installed-print-help-retest/` 和 `logs/computer-use-real-app/print-help-installed-retest-20260701.md`。

2026-07-01 同步 `PRISM-FF-110 / P1-EDITOR-006` 安装版复测状态：既有证据 `PRISM-CU-256/257` 显示选中两行正文后，右键菜单剪切/复制/链接可用，继续执行 `块级源码操作 > 选区转警告提示块` 后，选区原地变为 warning callout，保存后的磁盘文件只有一个 warning callout，未在文末追加空块。manifest 已从历史 Fail 改为 Pass。

2026-07-01 同步 `PRISM-FF-140/141` 安装版复测状态：既有证据 `PRISM-CU-261..267` 显示 `Cmd+M` 和 `Window > 最小化` 均可让窗口进入 `AXMinimized=true`，`open -a` 可恢复为单窗口且未最小化，`Window > 缩放` 可改变窗口尺寸，红色关闭按钮后窗口数变为 0，再次打开恢复为 1 个窗口。两项从历史 Fail 改为 Pass。

2026-07-01 闭环 `PRISM-FF-091 / P1-MENU-002`：`PRISM-CU-260` 已证明安装版 macOS `File` 菜单暴露新建、打开文件、打开文件夹、快速打开、保存、另存为、在访达中显示和关闭文稿等核心入口；复跑 `src/lib/openDocumentFlow.test.ts` 与 `src/lib/fileActions.test.ts` 通过 2 个测试文件 / 24 条测试，覆盖当前窗口已有文档时菜单打开新文件会进入新窗口的策略。该项改为 Pass。

2026-07-01 闭环 `PRISM-FF-136/166`：真实安装版复测确认中文 locale 下 Prism 自绘菜单、侧栏、状态栏与设置中心均显示中文；设置中心 AX 树可读容器、关闭按钮、设置分类、六个分区按钮、heading、文本标签和 pop up button。复跑 i18n/Settings/CommandPalette/ShortcutPanel 批次通过 3 个测试文件 / 25 条测试，覆盖三语 translation key 完整性、auto locale fallback、document lang 更新和设置基础 aria 状态。两项均改为 Pass。证据见 `screenshots/34-installed-i18n-a11y-retest/01-settings-zh-cn-ax-visible.png`、`logs/computer-use-real-app/i18n-a11y-installed-retest-20260701.md` 和 `logs/unit-tests/i18n-a11y-shell-20260701.log`。

2026-07-01 闭环 `PRISM-FF-132`：导出成功 toast 的“打开”和“显示位置”动作点击后不再自动关闭，且导出成功动作 toast 显示时间延长至 15 秒。复跑导出 toast/命令注册/导出命令集成测试通过 3 个测试文件 / 39 条断言；`npm run build`、`npm run tauri:build:app-smoke` 和安装版 smoke 均通过。真实 `/Applications/Prism.app` 复测确认 HTML 导出成功 toast 显示两个动作；点击“打开”后 Google Chrome 打开本地 HTML 产物；再次导出后点击“显示位置”，Finder 打开 `Examples` 并选中 `Prism Markdown 语法指南.html`。该项从 Blocked 改为 Pass。证据见 `screenshots/35-installed-export-open-actions-retest/`、`logs/computer-use-real-app/export-open-actions-installed-retest-20260701.md` 和 `logs/unit-tests/export-open-actions-toast-20260701.log`。

2026-07-01 闭环 `PRISM-FF-026`：编辑区普通复制不再只写纯文本，而是写入 Markdown 源文本 `text/plain` 和渲染后的 `text/html`；`copyPlain` / `copyMd` 继续保持纯 Markdown 文本语义，显式 `copyHtml` 在缺少 rich clipboard API 时回退 HTML 源码。复跑富复制/编辑命令/右键命令集成测试通过 4 个测试文件 / 53 条测试；`npm run build`、`npm run tauri:build:app-smoke` 均通过，并已替换 `/Applications/Prism.app`。真实安装版打开 `rich-copy-multi-format.md` 后执行 `Cmd+A` / `Cmd+C`，Swift 读取 `NSPasteboard` 直接确认存在 `public.html`、`Apple HTML pasteboard type`、`public.utf8-plain-text` 和 `NSStringPboardType`；plain text 保留 Markdown 源文本，HTML 包含 `<strong>`、`href` 和 `<table>`。该项从 Blocked 改为 Pass，P0 Blocked 清零。证据见 `screenshots/36-blocked-burn-down/PRISM-FF-026-copy-installed-app.png`、`logs/blocked-burn-down-20260701/prism-ff-026-copy-installed-app.log`、`logs/unit-tests/rich-copy-multi-format-20260701.log` 和 `logs/app-smoke-blocked-burn-down-20260701/report.json`。

2026-07-01 降噪 `PRISM-FF-092`：旧真实安装版复测无法稳定制造“点击文件树切换时仍 dirty”的前置条件，因为自动保存先于切换完成。本轮不伪造成真实 UI 弹窗复测，改用代码级自动化补证据：`workspace-navigation` 策略明确启用 `dirtyGuard`，`DirtyDocumentSwitchModal` 暴露保存、另存为、放弃改动、取消四个动作，文件动作 contract 覆盖 cancel/discard/save/saveAs 以及保存前发现外部磁盘变化进入 conflict。复跑 4 个测试文件 / 32 条测试通过，该项从 Blocked 改为 Pass/code-verified。证据见 `logs/unit-tests/dirty-guard-switch-20260701.log`，旧真实时序阻塞日志仍保留为 `logs/computer-use-real-app/dirty-guard-switch-check.log`。

2026-07-02 降噪 `PRISM-FF-094`：修复空状态“打开文件夹”按钮的授权失败路径。`grantWorkspaceDirectoryScope` 失败时现在显示全局 error toast，不继续调用 `loadFolderTree`，不打开新窗口，并保持 `workspace.rootPath=null` 与空文件树，避免半加载工作区状态。该场景通过 mock 授权拒绝覆盖，不真实拒绝 macOS 用户目录权限、不污染真实目录；命令面板/菜单 `openFolder` 路径继续由 workspace command 与 registry 测试覆盖。复跑 3 个测试文件 / 41 条测试通过；`npm run build`、`npm run tauri:build:app-smoke`、替换后的 `/Applications/Prism.app` smoke 均通过。该项从 Blocked 改为 Pass/code-verified。证据见 `logs/unit-tests/folder-authorization-failure-20260702.log` 和 `logs/app-smoke-folder-authorization-failure-20260702/report.json`。

2026-07-02 降噪 `PRISM-FF-135`：修复设置保存失败不可见的问题。`saveSettings` 捕获持久化异常后现在发出全局 error toast，标题为设置保存失败，正文保留 native 错误原因；异常仍被吞掉，避免设置中心或调用方崩溃。该场景通过 mock `settings_write_failed` 覆盖，不修改真实 app data 权限、不污染用户配置；测试确认内存中的设置变更保留、不会误走 legacy `writeTextFile` fallback，且 toast payload 可读。复跑 4 个测试文件 / 35 条测试通过；`npm run build`、`npm run tauri:build:app-smoke` 均通过。该项从 Blocked 改为 Pass/code-verified。证据见 `logs/unit-tests/settings-persistence-failure-20260702.log` 和 `logs/app-smoke-settings-persistence-failure-20260702/report.json`。

2026-07-02 降噪 `PRISM-FF-138`：补充 Error Boundary 专项注入异常测试。测试组件在 render 阶段抛出 `Injected render failure`，`AppErrorBoundary` 捕获后显示 `role=alert` fallback、`Prism 渲染失败` 标题、说明文本、错误消息和 component stack，证明渲染异常不会白屏。本轮不在真实 App 暴露崩溃开关。复跑 4 个测试文件 / 8 条测试通过。该项从 Blocked 改为 Pass/code-verified。证据见 `logs/unit-tests/error-boundary-injected-render-20260702.log`。

2026-07-02 降噪 `PRISM-FF-162`：用 `WorkerFactory` mock 补充 Markdown 预览 Worker 降级专项证据。测试覆盖无 Worker 环境主线程渲染、Worker runtime error 后释放 pending 并降级、Worker 回包 error 后用原请求主线程重渲染，同时确认富内容和三语 front matter 文案一致。本轮不在真实 App 暴露禁用 Worker 开关。复跑 1 个测试文件 / 14 条测试通过。该项从 Blocked 改为 Pass/code-verified。证据见 `logs/unit-tests/markdown-worker-fallback-20260702.log`。

2026-06-30 补测渲染错误 action：非法 Mermaid 在预览态显示可读错误块、源码行号和“跳到源码”按钮；点击后界面切到分栏，编辑侧光标定位到 Mermaid 错误源码附近，状态栏显示 `7:1`。`PRISM-FF-113` 标记为 Pass。

2026-06-30 补测预览源码 flash：点击预览侧错误块“跳到源码”后，编辑区可稳定定位到 Mermaid 源码附近，但 Computer Use 点击返回与截图延迟无法稳定捕捉短暂高亮动画。`PRISM-FF-116` 标记为 Blocked，后续需用录屏或可控动画时长专项复测。

2026-06-30 补测图片诊断异步更新：缺失图片路径触发 `ERROR 1`；把 Markdown 图片路径改成已存在 PNG 后，`ERROR` 不重启即可消失，`PRISM-FF-112` 标记为 Pass。附带发现：如果只把缺失图片文件补到原路径而不改 Markdown 内容，诊断不会自动刷新，新增 `P2-DIAGNOSTICS-003`。

2026-06-30 复核导出产物：`real-complex-diagrams-export.html` 通过 Chrome `file://` 离线打开，结构检查无远程或相对资产引用，Mermaid/PlantUML/Markmap/本地 SVG/表格/数学区域可见；本地 SVG 资源显示为内联图片。复杂 PNG 导出尺寸为 `4108x11072`，顶部/中段/底部切片未见明显拼接白缝或底部裁切。`PRISM-FF-123/124/129` 标记为 Pass。

2026-06-30 复核 DOCX 导出：`real-complex-diagrams-export.docx` 可在 WPS 打开，Mermaid/PlantUML 以图像显示，Table And Math 表格横向铺满页面内容宽度；OOXML 表格宽度为 `9866 dxa`，两列各 `4933 dxa`；inline math 与 block math 在 WPS 中可见，无乱码方框。`PRISM-FF-126/127/128` 标记为 Pass。

2026-06-30 补测文件属性信息：文件树右键菜单和主“文件”菜单均未暴露属性/信息/显示简介入口，用户无法在 Prism 内查看当前文件名称、完整路径、类型、大小、创建/修改时间。新增 `P1-FILE-004`，`PRISM-FF-095` 标记为 Fail。

2026-06-30 补测主题目录打开：设置 > 外观中“打开主题目录”按钮可见，但通过可访问性点击和坐标点击后均没有打开 Finder，也没有 toast 反馈。新增 `P1-SETTINGS-003`，`PRISM-FF-104` 标记为 Fail。

2026-06-30 补测关系图谱交互：`real-wiki-target.md` 可打开关系图谱，显示当前文档与 `Link Click Fixture` 入链；搜索不存在节点显示“没有可显示的关系”；点击 `Link Click Fixture` 后焦点和右侧详情切换，并扩展显示相对链接和 wiki 链接目标；拖拽尝试后布局保持稳定。`PRISM-FF-121` 标记为 Pass。

2026-06-30 继续补测启动默认指南、Selection callout、工作区搜索回退、图谱 fallback 可观测性、导出取消/后台状态/成功动作、外部文件打开同步工作区、原生 File 菜单、文件树创建副本和新建文件夹。新增失败项：启动/新窗口未直接打开 `Examples/Prism Markdown 语法指南.md`（`P0-STARTUP-003`）、Selection callout 丢失当前选区（`P1-EDITOR-006`）、选区右键菜单剪切/复制/链接 disabled（`P1-EDITOR-007`）、工作区全文搜索入口不可达（`P1-SEARCH-001`）、原生 File 菜单缺少 Prism 核心文件入口（`P1-MENU-002`）。新增通过项：外部 Markdown 打开会同步工作区、文件树创建副本、工作区菜单新建文件夹、导出取消和后台导出状态。

2026-06-30 收尾补测剩余可安全执行项：新增文件 `real-index-incremental-20260630.md` 后，不重启 App 重新激活可在文件树看到新文件，`PRISM-FF-117` 标记 Pass，但即时刷新仍需后续关注；真实导出 `real-links-click.pdf` 成功，平台 PDF capture 可用；Finder 中 `.md` 文件显示 Markdown 文档图标，`PRISM-FF-146` 标记 Pass；macOS 最小化、缩放和 close/reopen 生命周期未按标准行为变化，`PRISM-FF-140/141` 标记 Fail。删除、重命名父文件夹、用户主题包、字体导入、设置错误、断网、Worker/内存/超大工作区等需要破坏性操作、真实平台或注入故障的项目均标记 Blocked，并写明原因。

2026-07-01 修正 `PRISM-FF-122 / P1-EXPORT-007` PDF 链接注释验收：原 `strings` 检查没有发现 `/URI`、`/Annots`、`/Link`，但该方式会漏掉压缩或间接对象。改用 `pdf-lib` 解析真实导出产物 `real-links-click.pdf` 后，确认第 1 页有 1 个 `/Subtype /Link` 注释，URI 为 `https://github.com/AlexPlum405/Prism`；外链注释实际存在，wiki link 和相对 Markdown link 按当前安全策略不生成外部 URI。已补 native WebKit PDF + 页眉页脚保留 URI annotation 单测，`PRISM-FF-122` 改为 Pass。证据见 `logs/computer-use-real-app/pdf-link-annotations-pdf-lib-20260701.log` 和 `logs/unit-tests/export-pdf-link-annotations-20260701.log`。

2026-07-01 修复 `PRISM-FF-078 / P0-EXPORT-006` Front Matter 嵌套导出覆盖：原解析器只读取顶层 `toc/template/paper/margin`，导致 fixture 中的 `export.toc: true` 被忽略。源码已同时支持嵌套 `export.template/export.paper/export.margin/export.toc`，并将 `export.margin: narrow` 兼容映射为 `compact`。重新打包替换 `/Applications/Prism.app` 后，真实安装版导出 `real-frontmatter-export.md` 通过：HTML 产物包含 `prism-export-toc` nav、`#front-matter-export-fixture` 和 `#section-one` 锚点。证据见 `PRISM-CU-275`、`screenshots/29-installed-frontmatter-export-toc-smoke/` 和 `logs/computer-use-real-app/frontmatter-export-html-check-20260701.log`。

2026-07-01 闭环 `PRISM-FF-012/086 / P0-COMMAND-001` 新建文稿命令验收：当前产品语义是 `new` 在当前文档目录或工作区根目录触发 `newFile`，没有目标目录时提示“当前没有打开的工作区”，不会创建内存 Untitled，也不会打开新窗口。复跑 `src/domains/commands/registry.test.ts` 和 `src/domains/commands/categories/fileCommands.test.ts` 通过 2 个测试文件 / 40 条断言，旧 Fail 改为 Pass。证据见 `logs/unit-tests/command-new-registry-20260701.log`。

2026-06-30 源码修复批次已覆盖本轮 P0/P1 中的启动/系统打开文本文件、dirty 外部修改冲突、Typography 入口、基础剪贴板、图片粘贴、Selection callout、选区右键、工作区搜索、原生 macOS File 菜单和窗口菜单路径。自动化验证已通过：相关 Vitest 批次 17 个文件 / 190 条断言通过，`cargo check` 通过，`npm run build` 通过，`git diff --check` 通过。随后已分批重新打包替换 `/Applications/Prism.app` 并补充安装版真实 UI 复测；历史 Fail 证据保留为 pre-fix 记录，修复后 Pass 证据以 `PRISM-CU-*` delta 追加。

2026-06-30 追加 `P0-FILE-003` dirty 外部修改冲突专项回归：第一次安装版复测 `PRISM-CU-247` 仍复现静默合并，定位为 snapshot 不完整或未变化时外部监测提前 return，内容基线兜底未执行。随后源码新增 `lastSavedContent` 内容基线，dirty 外部监测和 auto-save 保存前均用磁盘内容与基线比对兜底；重新打包替换 `/Applications/Prism.app` 后，`PRISM-CU-249` 真实 UI 复测确认出现“文件冲突”弹窗，提供重新加载、另存为、覆盖三个处理入口，编辑区保留本地未保存内容。验证通过：文档安全 Vitest 3 文件 / 26 条断言、`npm run build`、干净 worktree `npm run tauri:build:app-smoke`、替换后的 `PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs`。

2026-06-30 追加 `P0-DIAGNOSTICS-002` 排版诊断入口安装版复测：打开 `real-typography-diagnostics.md` 后，状态栏显示“排版”入口，点击后入口变为 `TYPO 14` 并打开“排版提示”面板；AX 树显示 14 个排版提示，覆盖间距、标点、连续空行和标题层级跳级，并提供逐条定位动作。证据见 `PRISM-CU-250/251`。

2026-06-30 追加 `P0-EDITOR-004` 剪贴板链路安装版复测：重新打包替换 `/Applications/Prism.app` 后，真实 UI 复测 `Cmd+C`、`Cmd+V`、`Cmd+X` 全链路通过。`PRISM-CU-252` 确认复制选区后系统 `pbpaste` 返回 Alpha 行；`PRISM-CU-253` 确认粘贴在光标处插入第二条 Alpha 行并保存到磁盘；`PRISM-CU-254` 确认剪切 Beta 行后系统剪贴板返回 Beta 行，编辑器和保存后的磁盘文件均已移除 Beta 行。复测过程中未再出现 Prism 自己保存被误判为外部文件冲突的弹窗；该 race 已补源码回归测试、重新打包并通过安装版 smoke。

2026-06-30 追加 `P0-EDITOR-005` 图片剪贴板粘贴安装版复测：重新打包替换 `/Applications/Prism.app` 后，真实 UI 复测系统 PNG 剪贴板粘贴通过。系统剪贴板含 `PNGf` 数据，安装版 Prism 中执行 `Cmd+V` 并点击 macOS `Paste` 菜单后，编辑器插入 Markdown 图片语法，磁盘生成 `assets/real-image-paste-retest-20260630224136/image-20260630-224213.png`。证据见 `PRISM-CU-255` 和 `screenshots/22-installed-image-paste-smoke/02-image-paste-after-installed-fix.png`。

2026-06-30 追加 `P1-EDITOR-006/007` 选区菜单与 callout 安装版复测：真实 UI 中选中两行正文后，右键点击选中文字，`剪切`、`复制`、`链接` 菜单项均为可用状态；继续选择 `块级源码操作 > 选区转警告提示块` 后，选区原地变为 warning callout，保存后的磁盘文件只包含一个 warning callout，未在文末追加空块。证据见 `PRISM-CU-256/257` 和 `screenshots/23-installed-selection-context-smoke/`。

2026-06-30 追加 `P1-SEARCH-001` 与 `P1-MENU-002` 安装版复测：`Cmd+Shift+F` 直接打开“全文搜索 工作区”面板，输入 `NeedleWorkspaceTerm` 后显示根文件和子目录文件两个命中，回车可打开子目录文件；macOS 系统菜单栏 `File` 已显示新建、打开文件、打开文件夹、快速打开、保存、另存为、在访达中显示和关闭文稿等核心入口。证据见 `PRISM-CU-258/259/260` 和 `screenshots/24-installed-workspace-search-menu-smoke/`。

2026-06-30 追加 `P1-WINDOW-001/002` 安装版复测：重新打包替换 `/Applications/Prism.app` 后，`Cmd+M` 和 `Window > 最小化` 均能让当前窗口进入 `AXMinimized=true`，`Window > 缩放` 将窗口从 `1100x760` 改为 `1496x852`；红色关闭按钮后窗口数变为 `0`，再次 `open -a /Applications/Prism.app` 恢复为 `1` 个窗口且未最小化。证据见 `PRISM-CU-261` 到 `PRISM-CU-267`、`screenshots/25-installed-window-lifecycle-smoke/` 和 `logs/computer-use-real-app/window-lifecycle-installed-retest-20260630.md`。

2026-06-30 追加 `P0-FILE-002` 系统打开文本类文件安装版截图复测：安装版 smoke 已通过 JSON/SQL/TXT 启动不白屏，并归档正式截图 `PRISM-CU-268/269/270`。截图分别覆盖 `data.json`、`query.sql`、`plain.txt`，report 中 lastSession filePath 与目标文件一致。

2026-06-30 追加 `P0-STARTUP-003` 启动/新窗口默认指南安装版复测：冷启动 `/Applications/Prism.app` 后只有 1 个窗口，AX 文本包含 `Examples` 和 `# 📖 Prism Markdown 语法指南`；点击系统菜单 `File > 新建窗口` 后窗口数变为 2，两个窗口的 AX 文本均包含默认指南内容，未出现“未命名”空文稿。证据见 `PRISM-CU-271/272`、`screenshots/27-installed-startup-guide-smoke/` 和 `logs/computer-use-real-app/startup-new-window-guide-installed-retest-20260630.md`。

2026-06-30 追加 `P0-KNOWLEDGE-001/002` 反链与关系图谱安装版复测：打开 `fixtures/computer-use-real-app/real-wiki-target.md` 后，`导航 > 反向链接` 可列出 `Link Click Fixture` 来源、片段 `Open [[real-wiki-target]] from preview.` 和行列号 `7:6`；状态栏 `查看关系图谱 (⌥⌘G)` 按钮可打开图谱弹窗，当前文档范围显示 `Real Wiki Target`、`real-links-click`、`real-links-click (副本)` 3 个节点，`Real Wiki Target` 为 `0 出 / 2 入`。证据见 `PRISM-CU-273/274` 和 `screenshots/28-installed-backlinks-graph-smoke/`；旧 `PRISM-FF-055/056/057` 与 `PRISM-CU-044/072` 失败截图保留为历史 pre-fix 证据。

## 执行统计

- 总用例：168
- P0：88
- P1：56
- P2：16
- P3：8
- Pass：145
- Fail：0
- Blocked：23
- Not Run：0
- P0 执行：Pass 88 / Fail 0 / Blocked 0 / Not Run 0
- P1 执行：Pass 48 / Fail 0 / Blocked 8 / Not Run 0
- P2 执行：Pass 5 / Fail 0 / Blocked 11 / Not Run 0
- P3 执行：Pass 4 / Fail 0 / Blocked 4 / Not Run 0
- 当前截图文件总数：434
- Manifest 真实 Computer Use 截图引用：245
- Pipeline/环境证据截图：9
- 真实 Computer Use/安装版 UI 截图：246（`screenshots/15-computer-use-real-app/`、`screenshots/17-installed-anchor-search-smoke/`、`screenshots/18-installed-conflict-smoke/`、`screenshots/19-installed-typography-smoke/`、`screenshots/20-installed-editor-clipboard-smoke/`、`screenshots/22-installed-image-paste-smoke/`、`screenshots/23-installed-selection-context-smoke/`、`screenshots/24-installed-workspace-search-menu-smoke/`、`screenshots/25-installed-window-lifecycle-smoke/`、`screenshots/26-installed-file-types-smoke/`、`screenshots/27-installed-startup-guide-smoke/`、`screenshots/28-installed-backlinks-graph-smoke/`、`screenshots/29-installed-frontmatter-export-toc-smoke/`、`screenshots/30-installed-preview-link-click-single/`、`screenshots/32-installed-p1-fix-retest/`、`screenshots/33-installed-print-help-retest/`、`screenshots/34-installed-i18n-a11y-retest/`、`screenshots/35-installed-export-open-actions-retest/`、`screenshots/36-blocked-burn-down/`）
- 单元/集成测试批次：22
- 单元/集成测试文件通过：104
- 单元/集成测试断言通过：1260
- 单元/集成测试失败执行：0
- 唯一单元失败：0
- 原生 macOS app 窗口验证：当前恢复可测；最小化、缩放、close/reopen 生命周期已按 `PRISM-CU-261..267` 安装版证据闭环为 Pass
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
- 2026-06-30 搜索事件修复后安装版 smoke 报告：logs/app-smoke-installed-search-event-fix-20260630/report.json
- 2026-06-30 安装版锚点与搜索复测截图：screenshots/17-installed-anchor-search-smoke/
- 2026-06-30 安装版剪贴板复测截图：screenshots/20-installed-editor-clipboard-smoke/
- 2026-06-30 保存 race 修复后安装版 smoke 报告：logs/app-smoke-installed-saving-race-fix-20260630/report.json
- 2026-06-30 保存 race 修复后安装版 smoke 截图：screenshots/21-installed-app-smoke-saving-race-fix/
- 2026-06-30 图片剪贴板修复后安装版 smoke 报告：logs/app-smoke-installed-image-paste-fix-20260630/report.json
- 2026-06-30 图片剪贴板安装版复测截图：screenshots/22-installed-image-paste-smoke/
- 2026-06-30 选区菜单与 callout 安装版复测截图：screenshots/23-installed-selection-context-smoke/
- 2026-06-30 工作区全文搜索与原生 File 菜单安装版复测截图：screenshots/24-installed-workspace-search-menu-smoke/
- 2026-07-01 预览链接单击修复后安装版复测截图：screenshots/30-installed-preview-link-click-single/
- 2026-07-01 预览链接单击修复后安装版复测日志：logs/computer-use-real-app/preview-link-single-click-postfix-20260701.log
- 2026-07-01 预览链接 pointerup 单测日志：logs/unit-tests/preview-link-pointerup-20260701.log
- 2026-07-01 P1 修复复测截图：screenshots/32-installed-p1-fix-retest/
- 2026-07-01 P1 修复复测日志：logs/computer-use-real-app/p1-fix-installed-retest-20260701.md、logs/computer-use-real-app/real-complex-pdf-postfix-pdfinfo-20260701.log、logs/computer-use-real-app/real-complex-pdf-postfix-stat-20260701.log
- 2026-07-01 打印与帮助外链修复后安装版复测截图：screenshots/33-installed-print-help-retest/
- 2026-07-01 打印与帮助外链修复后安装版复测日志：logs/computer-use-real-app/print-help-installed-retest-20260701.md
- 2026-07-01 i18n 与无障碍基础安装版复测截图：screenshots/34-installed-i18n-a11y-retest/
- 2026-07-01 i18n 与无障碍基础安装版复测日志：logs/computer-use-real-app/i18n-a11y-installed-retest-20260701.md、logs/unit-tests/i18n-a11y-shell-20260701.log
- 2026-07-01 导出打开产物动作安装版复测截图：screenshots/35-installed-export-open-actions-retest/
- 2026-07-01 导出打开产物动作安装版复测日志：logs/computer-use-real-app/export-open-actions-installed-retest-20260701.md、logs/unit-tests/export-open-actions-toast-20260701.log、logs/app-smoke-installed-ff132-20260701/report.json

## 导出保真专项

- 专项索引：export-fidelity-special.md
- 当前结论：HTML、PDF、PNG、DOCX 基础导出和复杂导出主链路均为 Pass；Mermaid、PlantUML、Markmap、本地 SVG、表格、数学公式已纳入复杂 fixture 验收。
- PDF 分页避切：`PRISM-FF-125` 已通过真实安装版复测，证据见 `screenshots/32-installed-p1-fix-retest/05-real-complex-pdf-page-1.png`、`screenshots/32-installed-p1-fix-retest/05-real-complex-pdf-page-2.png` 和 `logs/computer-use-real-app/p1-fix-installed-retest-20260701.md`。
- PlantUML 离线渲染与 PNG 裁切：`PRISM-FF-043` 已通过 `plantuml-little` 回归和安装版截图复核，证据见 `screenshots/31-plantuml-regression/` 和 `logs/plantuml-regression/plantuml-png-regression-20260701.log`。
- DOCX 表格/公式/图表：`PRISM-FF-126/127/128` 已通过 WPS 视觉打开和 OOXML 检查，证据见 `screenshots/15-computer-use-real-app/PRISM-CU-208-docx-wps-diagrams-page-window.png`、`PRISM-CU-209-docx-wps-table-math-page-window.png` 和 `logs/computer-use-real-app/docx-complex-inspection.log`。
- 剩余导出风险：`PRISM-FF-153/156` Windows/Linux 导出、`PRISM-FF-164` 导出大图内存仍为 Blocked，不伪造验证。

## 2026-06-30 修复批次状态

- 已重新打包并替换 `/Applications/Prism.app`，Info.plist 身份为 `com.prism.editor.v1`，版本 `1.4.1`，Markdown 文档图标资源和 `Resources/Initial` 均在安装包内。
- `npm run tauri:build:app-smoke` 已通过，覆盖构建产物的启动、诊断、Quick Open、保存、导出菜单、设置中心和复杂导出产物。
- `PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs` 已通过，覆盖真实安装版 `.markdown` 中文/空格路径、JSON、SQL、TXT、Markdown 启动不白屏、ERROR 状态栏诊断、Quick Open、基础编辑保存、导出菜单、设置中心、HTML/PDF/PNG/DOCX 复杂导出产物。
- 最新安装版 smoke `logs/app-smoke-installed-image-paste-fix-20260630/report.json` 已通过，截图归档在 `screenshots/22-installed-image-paste-smoke/`。
- 原始全功能截图中的 Fail 不直接改写为 Pass；本节只证明安装版 smoke 覆盖的路径已经回归通过。剩余 P0/P1 项仍需按原 manifest 用例逐项真实 UI 复测后再改状态。

## 2026-06-30 锚点与默认指南诊断修复

- 已补默认指南资源回归：`src-tauri/resources/Initial/Examples/Prism Markdown 语法指南.md` 的目录链接不再产生 `missing-heading` 诊断，覆盖此前 `#文本格式` 误报。
- 已修预览目录锚点：Markdown 预览标题生成稳定 `id`，点击同文档 `#anchor` 会滚动到预览内目标标题。
- 已通过 `npm test -- --run src/lib/markdownToHtml.test.ts src/domains/editor/extensions/linkDiagnostics.test.ts src/domains/editor/components/PreviewPane.test.tsx`。
- 已通过 `npm run build`。
- 已重新打包并替换 `/Applications/Prism.app` 后完成真实 UI 复测：`PRISM-CU-239` 确认默认指南状态栏无 `ERROR`，`PRISM-CU-241` 确认点击目录“图表”后滚动到图表段落。

## 2026-06-30 文档搜索状态修复

- 已修文档搜索关闭后预览高亮残留：关闭搜索会取消预览搜索任务、清理 `.preview-search-match`、重置 query/count/current，并向编辑器发送空搜索 query。
- 已修全文搜索与文档搜索叠加：workspace/rootPath 搜索事件会先收起文档内搜索。
- 安装版复测时额外发现真实 `Cmd+Shift+F` 命令路径仍直接打开全局搜索、未广播 workspace 搜索事件，导致 `PRISM-CU-244` 中两个搜索 UI 仍叠加。
- 已补 `workspaceSearch` 命令事件广播，重新打包替换 `/Applications/Prism.app`；`PRISM-CU-245` 确认全文搜索打开时文档搜索条自动消失。
- 已通过 `npm test -- --run src/domains/commands/registry.test.ts src/domains/editor/components/SplitView.test.tsx`、`npm run build`、`npm run tauri:build:app-smoke` 和替换后的 `PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs`。
- 选区浮动工具条残留不在本批搜索修复范围内，仍作为单独残余风险跟踪。

## 2026-06-30 外部修改冲突修复

- 已补文档内容基线：打开/保存文档时记录 `lastSavedContent`，用于 snapshot 不完整或无法可靠判断时的冲突兜底。
- 已修 dirty 外部修改监测提前返回：snapshot 判定未变化时，dirty 文档仍会读取磁盘内容并与内容基线比对。
- 已修 auto-save 保存前兜底：保存前先 inspect 当前磁盘 snapshot；若原始 snapshot 不完整，则读取磁盘内容与基线比对，确认未变后再用最新 snapshot 写入。
- 已修自保存 race：外部修改监测在 `inspect` 后重新读取当前文档状态；如果检查期间文档进入 `saving` 或 `conflict`，不把 Prism 自己的写盘提升为外部冲突。
- 安装版复测 `PRISM-CU-247` 保留了修复前静默合并失败证据；重新打包替换后 `PRISM-CU-249` 确认冲突弹窗和三个处理入口可见。
- 已通过 `npm test -- --run src/domains/document/hooks/useExternalFileChangeMonitor.test.tsx src/domains/document/hooks/useAutoSave.test.tsx src/domains/document/store.test.ts`、`npm run build`、`npm run tauri:build:app-smoke` 和替换后的 `PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs`；最新安装版剪贴板复测过程中未再出现自保存误报冲突。

## 当前剩余 Fail

- 当前 manifest 中 Fail 已清零。剩余非通过项均为 Blocked，主要是破坏性操作、真实 Windows/Linux、断网、权限拒绝、注入故障和压力测试，不伪造结果。

## 本轮新增有效截图覆盖

- 文件与工作区：Markdown、JSON/SQL/TXT、Unsupported file、新建文稿、保存状态、文件树基础。
- 编辑与预览：视图模式、编辑搜索、替换、预览搜索、Slash、README 模板、Wiki 补全、表格插入、专注模式、打字机模式。
- 渲染：基础 Markdown、Front Matter、非法 YAML、KaTeX、Mermaid、PlantUML、Markmap、本地图片、安全 HTML、长文档 top/middle/bottom、演示模式。
- 知识与诊断：属性、链接、反链、图谱失败态、当前文档关系图谱交互、大纲、broken-links 错误态。
- 设置与主题：通用、写作、外观、字体、文件、导出、引用/Pandoc、MiaoYan/Inkstone/Slate/Mono/Nocturne/Carbon。
- 2026-06-29/30 补充截图：CodeMirror 编辑态主题、Callout picker、Markdown 列表编辑、渲染错误 action、toast、导出失败诊断 UI、真实 App DevTools、打印入口缺失、帮助 Markdown 参考/GitHub/反馈外链、迁移帮助 404、帮助/更新入口、reduced motion。
- 2026-07-01 修复后补充截图：文件菜单 `打印 ⌘P`、macOS 系统打印 sheet、迁移指南 GitHub 可读页面。
- 2026-07-01 i18n/AX 补充截图：中文设置中心和可读 AX 基础控件。
- 2026-06-29 真实 Computer Use 补测：编辑/预览/分栏切换、Quick Open、全文搜索、预览态触发替换自动切分栏、文档属性、当前文档链接、反向链接、文件树展开、文件/文件夹右键菜单、快捷键、关于、检查更新、预览态任务列表勾选。
- 2026-06-29 16:50 以后追加真实窗口级截图：PlantUML/Markmap、引用/任务列表/脚注、File/Edit/Insert/Format/Navigation/View/Export/Window/Help 九组菜单、设置六分区、快捷键、关于、检查更新 loading/6 秒后状态、文档属性、当前链接、反链空状态、大纲与大纲搜索、文件树与上下文菜单。
- 2026-06-29 追加真实响应式与主题截图：1024x768、窄窗口、低高度窗口，以及 `MiaoYan / Inkstone Light / Slate Manual / Mono Lab / Nocturne Dark / Carbon Black` 六个内容主题的真实分栏窗口证据。
- 2026-06-29 追加真实文件类型与导出截图：Markdown fixture 打开、JSON/SQL/TXT 白屏失败、HTML/PDF/PNG/DOCX 导出对话框、导出前台任务、导出完成回到编辑态。2026-06-30 追加修复后安装版 JSON/SQL/TXT 不白屏截图。
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
- 2026-06-30 追加安装版锚点与搜索修复截图：默认指南无 ERROR、目录锚点跳到图表段落、预览搜索关闭无高亮残留、全文搜索叠加修复前失败和修复后通过。
- 2026-06-30 追加安装版剪贴板复测截图：复制选区写入系统剪贴板、粘贴插入文本、剪切写入剪贴板并删除正文。
- 2026-06-30 追加安装版图片剪贴板复测截图：系统 PNG 剪贴板粘贴进入资产管线，编辑器插入 Markdown 图片语法并生成 assets 图片文件。
- 2026-06-30 追加安装版选区菜单与 callout 复测截图：选区右键菜单剪切/复制/链接可用，选区转 warning callout 原地生效并保存到磁盘。
- 2026-06-30 追加安装版工作区全文搜索和原生 File 菜单复测截图：`Cmd+Shift+F` 打开全文搜索工作区、关键词命中跨文件结果、回车打开子目录结果文件、macOS File 菜单显示 Prism 核心文件入口。
- 2026-06-29 补充单元/集成测试：文件打开/自动保存/冲突/恢复、编辑命令、富复制、块操作、图片、表格、诊断、文件树、导出 preflight、导出设置、命令注册、主题、更新、工作区索引、反链、图谱、i18n、toast、reduced motion。
- 菜单与帮助：File/Edit/Insert/Format/Navigate/View/Export/Window/Help、快捷键、关于、检查更新。
- 布局：1024x768 窄窗口、低高度窗口。

## 未覆盖风险

- 当前真实 App 窗口可测；2026-06-30 安装版 smoke 已覆盖启动默认文档和 JSON/SQL/TXT 不白屏。最小化/缩放/close-reopen 生命周期已完成源码修复、换包和真实安装版复测，后续只需补更细的全屏/多显示器专项。
- Windows/Linux 用例未执行，已标记 Blocked；需要真机或真实平台环境回填。
- 浏览器 mock 只验证前端渲染与部分交互，不能证明 Tauri command、文件授权、导出、系统菜单和原生窗口生命周期正确。
- 当前 manifest 中登记了 232 条真实 Prism/导出产物/Finder/安装版复测证据；`screenshots/15-computer-use-real-app/`、`screenshots/17-installed-anchor-search-smoke/`、`screenshots/18-installed-conflict-smoke/`、`screenshots/19-installed-typography-smoke/`、`screenshots/20-installed-editor-clipboard-smoke/`、`screenshots/22-installed-image-paste-smoke/`、`screenshots/23-installed-selection-context-smoke/`、`screenshots/24-installed-workspace-search-menu-smoke/`、`screenshots/25-installed-window-lifecycle-smoke/`、`screenshots/26-installed-file-types-smoke/`、`screenshots/27-installed-startup-guide-smoke/`、`screenshots/28-installed-backlinks-graph-smoke/`、`screenshots/29-installed-frontmatter-export-toc-smoke/` 可作为真实 app 证据。其他 browser-mock 截图可用于前端视觉参考和宣传动图素材筛选，但不应作为“真实 app 已通过”的发布证据。
- 导出类用例已完成错误文档 preflight、干净 Markdown fixture 四格式导出、复杂图表 fixture 四格式导出、复杂 DOCX WPS 视觉打开；专项索引见 `export-fidelity-special.md`。仍未覆盖用户指南级长文档分页和连续超长 PNG 内存压力。
- `manifest.json` 中 Not Run 已清零；Blocked 项不是通过，主要对应删除/重命名、权限拒绝、断网、真实 Windows/Linux、注入故障和压力测试。
