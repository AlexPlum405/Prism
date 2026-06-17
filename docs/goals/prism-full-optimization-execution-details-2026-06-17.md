# Prism full-run optimization execution details

> 本文件是 `docs/goals/prism-full-optimization-goal-2026-06-17.md` 的本地执行细则。复制 `/goal` 时保持 goal 本体简短；执行时必须读取本文件、计划文档和领域文档。

## 1. 必读上下文

执行 goal 前必须读取：

- `AGENTS.md`
- `CONTEXT.md`
- `docs/adr/`
- `docs/reviews/prism-multi-perspective-review-2026-06-16.md`
- `docs/plans/prism-optimization-plan-2026-06-17.md`
- `docs/verification/prism-preview-full-render-performance-2026-06-12.md`
- `package.json`
- `src/domains/editor/`
- `src/domains/workspace/`
- `src/domains/commands/`
- `src/domains/export/`
- `src/domains/themes/`
- `src/styles/`
- `src-tauri/tauri.conf.json`
- 当前 `git status --short --branch` 和 `git diff`

如涉及 Tauri 配置、文件关联、平台 UI 规范或外部竞品事实，只查官方/一手资料或本地已安装 app，不凭空补细节。

## 2. 全局目标

在一个 full-run 中完成 `docs/plans/prism-optimization-plan-2026-06-17.md` 定义的 P0、P1、P2 全部优化项，并为每个优化项完成详细验证、证据记录、提交和推送。

继承当前已验证文档基线提交 `550ff87d4b28f2351a2c38b92ce7705a624660c6`，不要从头重做评审；只处理尚未闭环的实现、验证、截图/证据和文档缺口。优化计划本身由提交 `34601027558390fe2c068dc7721c44cd00ab1d4b` 固化。

P3 只作为暂不做清单保持文档化，不实现 AI、云同步、协作、插件市场、重型图谱或完整 block editor。

## 3. 范围边界

- 必须实现计划中的 `P0-01`、`P0-02`、`P0-03`、`P1-01` 到 `P1-07`、`P2-01` 到 `P2-11`。
- 必须保持 Prism 的 Markdown-first 单活动文档写作器定位，不把 Prism 做成知识库工作台、Notion 替代品、通用代码 IDE、AI 写作平台或云协作工具。
- 必须遵守 ADR-0006 的 Prism 跨平台写作器气质，以及 ADR-0007 的 Markdown Document / Text Document 分层。
- Text Document 第一批支持范围是 `.txt`、`.text`、`.sql`、`.json`、`.jsonc`、`.yaml`、`.yml`、`.toml`、`.xml`、`.csv`、`.tsv`、`.log`、`.ini`、`.conf`、`.env`。
- 常见源码文件如 `.js`、`.ts`、`.tsx`、`.py`、`.rs`、`.go`、`.java`、`.c`、`.cpp`、`.css`、`.html` 不进入默认文件关联、默认工作区索引或产品承诺。
- 关系图谱按钮只在当前 Markdown Document 存在文档链接关系时显示；Text Document、普通外部 HTTP/mailto 链接、无出链/无反链文档不触发。
- 视觉/UI 优化不是换皮：必须用截图、fixture、token、动效规则或可复现 smoke 验收，不用“更现代”“更高级”等主观词作为验收。
- 不做无关重构，不覆盖无关脏改，不 reset/checkout/revert 用户改动；如果工作树出现无关脏改，先说明并避开。
- 若发现计划和代码事实冲突、验收标准不准确或某项需要调整，先显式更新 goal，说明改了什么、为什么改，再继续。

## 4. Git 规则

1. 开始时确认 `main` 与 `origin/main` 同步且工作树干净；若不干净，先审查 diff 并只处理与本 goal 相关的变更。
2. 从最新 `main` 创建或切换到 `codex/prism-full-optimization` 分支。若分支已存在，先检查其 diff 和远端状态，不覆盖已有工作。
3. 每完成一个优化项，必须更新验证记录，运行该项相关验证，提交并推送一次安全 checkpoint。提交信息用中文，格式建议为 `feat: ...`、`fix: ...`、`test: ...`、`docs: ...`。
4. 每个 phase 结束时再跑一轮阶段级验证并提交推送。
5. 最终汇报所有 commit hash、push 状态、未验证风险和后续真机验证需求。

## 5. 全局证据要求

- 新建或持续更新 `docs/verification/prism-full-optimization-run-2026-06-17.md`。
- 每个优化项完成后都要在验证记录中写清楚：优化项 ID、变更摘要、涉及文件、风险等级、执行的验证命令、命令结果、截图/人工 smoke 证据路径、未验证风险、对应 commit hash。
- 如果某项因为环境限制无法完整验证，不得标记为完全完成；必须写明替代证据、残余风险和需要在哪个平台补验。
- UI/视觉项必须尽量提供截图、fixture 或 computed style 证据；无法跨平台真机验证时，至少记录当前平台截图和 Windows/Linux 待补验风险。

## 6. 可并行只读子 agent

可并行派生只读子 agent，但主线程负责最终实现、冲突处理和合并。

- 子 agent A dedicated goal：`/goal 在 /Users/Alex/AI/project/Prism 中，从测试与验证视角审查 docs/plans/prism-optimization-plan-2026-06-17.md。只读不改代码。输出每个 P0/P1/P2 优化项对应的现有测试、缺失测试、建议验证命令、是否需要 app smoke、是否需要截图。`
- 子 agent B dedicated goal：`/goal 在 /Users/Alex/AI/project/Prism 中，从视觉/UI 与跨平台美学视角审查当前 src/styles、src/domains/themes、shell/statusbar/command UI。只读不改代码。输出 P2-01 到 P2-11 的截图 fixture、token、动效、品牌、图标验收建议。`
- 子 agent C dedicated goal：`/goal 在 /Users/Alex/AI/project/Prism 中，从 Tauri、文件关联、默认 app 打开、DocumentProfile 工程可行性视角审查 src-tauri、file actions、bootstrap、workspace index。只读不改代码。输出 P0-02、P1-01、P1-02 的实现风险和验证矩阵。`

## 7. Phase 0：启动、分支、验证矩阵

1. 读取计划和当前代码，建立实施清单，映射每个优化项到具体文件、测试和风险等级。
2. 新建 `docs/verification/prism-full-optimization-run-2026-06-17.md`，写入初始环境、分支、基线 commit、Node/Rust/Tauri 信息和计划映射。
3. 派生必要的只读子 agent，等待关键输入后再进入高风险实现。

## 8. Phase 1：P0 写作链路

### P0-01 全局快捷键输入框豁免

- 实现 `isEditableTarget` 或等价 guard，豁免 `input`、`textarea`、`select`、`contenteditable` 和 CodeMirror 已处理事件。
- 验证：至少跑 `npm test -- --run src/app/useAppShortcuts.test.tsx`。
- 新增或更新测试覆盖输入框内 `Cmd/Ctrl+A/C/V/Z/F/H` 不触发 app command，正文编辑器快捷键不回退，Escape 等全局行为仍可用。
- 记录证据、commit、push。

### P0-02 默认 app 打开与启动 smoke

- 建默认 app 打开/启动参数 smoke 矩阵，覆盖 `.md/.markdown`、中文路径、空格路径、多文件、最后会话恢复与显式启动文件冲突。
- 若能脚本化，扩展 `scripts/run-app-smoke.mjs` 或相关测试；若当前环境无法覆盖 Windows/Linux，记录当前平台结果和跨平台未验证风险。
- 验证：至少跑 `npm test -- --run src/hooks/useBootstrap.test.tsx src/lib/openWindow.test.ts`。
- 涉及 Tauri app 行为时跑 `npm run tauri:build:app-smoke` 或说明为何无法运行。
- 记录证据、commit、push。

### P0-03 真实 Tauri WebView 长文档性能基准

- 新增真实 app/WebView 性能 harness 或扩展现有 app smoke，加载 1MB/3MB Markdown fixture。
- 指标至少包含打开、切换预览、DOM commit 或可观测替代指标、滚动响应、搜索首字响应、右键菜单、源码定位、UI 可操作延迟。
- 输出 JSON 或 Markdown 表格到 `docs/verification/`，记录机器、系统、WebView、构建模式。
- 验证：保留并跑 `PRISM_PREVIEW_BENCH=1 npm test -- --run src/domains/editor/components/PreviewPane.performance.test.tsx --reporter verbose`；同时跑新增真实 WebView harness 或说明阻塞。
- 记录证据、commit、push。

## 9. Phase 2：P1 高频路径和可靠反馈

### P1-01 统一打开文件策略

- 抽 `openDocumentPolicy` / `openDocumentFlow` 或等价模块，集中类型授权、大小提醒、dirty guard、新窗口/同窗口规则、workspace sync。
- 菜单、文件树、最近文件、快速打开、系统打开必须共享可测试策略。
- 验证：至少跑 `npm test -- --run src/lib/fileActions.test.ts src/domains/commands/categories/fileCommands.test.ts`；必要时补 `useBootstrap` 和 `openWindow` 测试。
- 记录证据、commit、push。

### P1-02 DocumentProfile 落地

- 引入 Markdown Document / Text Document profile 判断，并在文件关联、打开对话框、启动参数、保存/另存、索引、快速打开、全文搜索中统一使用。
- Text Document 支持 `.txt,.text,.sql,.json,.jsonc,.yaml,.yml,.toml,.xml,.csv,.tsv,.log,.ini,.conf,.env` 的基础打开/编辑/保存/搜索。
- Text Document 不默认触发 Markdown 预览、Markdown 链接诊断、Mermaid/KaTeX、导出保真、页面链接、反链或图谱。
- 验证：至少跑 `npm test -- --run src/lib/fileActions.test.ts src/hooks/useBootstrap.test.tsx`，相关 Rust 层跑 `cargo test`；如改 Tauri 文件关联，跑或记录 `npm run tauri:build:app-smoke`。
- 记录证据、commit、push。

### P1-03 预览搜索节流和渐进高亮

- 对长文档预览搜索增加 debounce、分帧标记或渐进高亮；Next/Prev 再滚动，输入阶段不每键强制滚动。
- 抽独立 highlighter 模块时，验证不会污染复制文本、源码定位和 scroll map。
- 验证：至少跑 `npm test -- --run src/domains/editor/components/SplitView.test.tsx`；如新增性能测试，记录 1MB 搜索首字响应或可重复替代指标。
- 记录证据、commit、push。

### P1-04 preview-only 源码定位 ready 队列

- 增加 `pendingJumpLine` 或等价机制，preview-only 冷启动时等 EditorPane mounted 后 jump 并 flash。
- 快速切换视图、重复右键定位、定位失败都要有可观测行为。
- 验证：至少跑 `npm test -- --run src/domains/editor/components/SplitView.test.tsx`，新增 preview-only 冷启动定位测试。
- 记录证据、commit、push。

### P1-05 状态栏图谱条件显示

- 根据当前 Markdown Document 的出链和工作区反链计算 `hasDocumentRelations` 或等价状态。
- 无关系文档不显示图谱按钮；有出链或反链显示；Text Document 永不触发；普通外部 URL 不触发。
- 索引 loading/unknown 状态要避免明显闪烁或错误显示。
- 验证：至少跑 `npm test -- --run src/domains/workspace/components/StatusBar.test.tsx src/components/shell/CommandPalette.test.tsx`，必要时补 document navigation/link extraction 测试。
- 记录证据、commit、push。

### P1-06 导出诊断产品化

- 统一 preflight 与失败详情，按链接、图片、渲染、锚点、分页/资源、导出阶段分组。
- 诊断必须包含阶段、对象/路径、原因、下一步，尽量可跳源码。
- UI 视觉按 UI-P1 诊断视觉系统验收：可定位但不压过正文，不只显示底层错误。
- 验证：至少跑 `npm test -- --run src/domains/export/preflight.test.ts`；涉及 UI 时补相关 component tests 或 smoke；导出路径改动后跑 `npm run build` 或说明替代验证。
- 记录证据、commit、push。

### P1-07 保存、冲突、导出微反馈统一

- 文件名区域承担保存中、未保存、保存失败、冲突等状态；状态栏不重复保存状态。
- 导出中、导出成功、导出失败、取消状态遵循一致持留规则：导出中可见，成功短暂消失，失败保留且可点详情。
- 验证：跑相关 store/UI tests，至少 `npm test -- --run src/lib/fileActions.test.ts`；如新增 titlebar/statusbar tests 一并执行。
- 记录证据、commit、push。

## 10. Phase 3：P2 视觉/UI 与体验质量

### P2-01 默认阅读排版调优

- 建 preview typography fixture，覆盖标题、正文、列表、表格、引用、代码块、Callout/Toggle、KaTeX、Mermaid、暗色模式。
- 在截图基准后评估并调优正文列宽、字号、段距、标题层级、代码块、表格和暗色对比。不要只凭主观描述改 CSS。
- 验证：至少跑 `npm test -- --run src/domains/themes/themeContract.test.ts`，并生成/记录 1200/1440/1920 宽度截图或说明当前截图能力缺口。
- 记录证据、commit、push。

### P2-02 token 语义审计

- 审计 `src/styles/tokens.css`、`src/styles/miaoyan.css`、theme contract 和相关 CSS override。
- 文档化 token 层级：历史 token、当前功能 token、主题 token、组件局部变量。先审计和约束新用法，不做大爆炸重命名。
- 验证：`git diff --check`，必要时跑相关 theme tests；新增文档需 `rg` 检查关键术语。
- 记录证据、commit、push。

### P2-03 迁移帮助页

- 写 Typora / 妙言 / MarkText 迁移帮助，只列 Prism 已实现或本轮完成的能力，不承诺未实现功能。
- 覆盖三态模型、快捷键、主题、导出、默认 app、Markdown/Text Document 文件模型。
- 验证：文档检查 + 快捷键/命令注册测试；若引用外部竞品事实，只使用官方/一手资料并附链接。
- 记录证据、commit、push。

### P2-04 命令面板信息架构

- 整理命令面板分组：文件、当前文档、导出、诊断、链接、设置。
- 快速打开、全文搜索、索引降级状态必须清晰，不让低频能力常驻打扰。
- 验证：至少跑 `npm test -- --run src/components/shell/CommandPalette.test.tsx`，必要时补 workspace index 降级测试。
- 记录证据、commit、push。

### P2-05 主题截图回归

- 为默认主题和内置主题建立同一 fixture 截图或可审查输出；保留用户主题 CSS 安全校验。
- 验证：至少跑 `npm test -- --run src/domains/themes/themeContract.test.ts src/domains/themes/themeCss.test.ts`，并记录截图路径/缺口。
- 记录证据、commit、push。

### P2-06 跨平台壳与控件密度审计

- 审计标题栏、侧栏、状态栏、视图切换、菜单/浮层密度，确保主结构跨平台一致，平台差异只留在系统 chrome、系统菜单和文件管理器措辞。
- 能截图就保存截图；不能覆盖 Windows/Linux 真机时，记录当前平台截图和待补验项。
- 验证：截图审查 + `git diff --check`；涉及 UI 组件时跑相关 component tests。
- 记录证据、commit、push。

### P2-07 微反馈与动效节奏统一

- 统一 hover、active、popover、toast、搜索命中、定位源码、保存/导出状态反馈；尊重 `prefers-reduced-motion`。
- 动效时长和 easing 应来自 token 或统一常量，不让各组件散落魔法数字。
- 验证：相关 UI tests + 手工 smoke；必要时补 Playwright 截图/视频或 reduced-motion 测试。
- 记录证据、commit、push。

### P2-08 品牌与空状态收口

- 梳理 app icon 使用、空文档、About、欢迎/帮助入口和导出页可选品牌露出。
- 表达本地写作、完整预览、可信导出，不把 Prism 包装成 AI/云/协作产品，也不只依赖“像妙言”。
- 验证：文档检查 + 截图审查；如改 i18n，跑相关 tests 或 build。
- 记录证据、commit、push。

### P2-09 斜杠菜单第一版

- 只做标准 Markdown/HTML 片段插入，例如 table、mermaid、callout、template 等，不做 Notion block editor。
- 键盘可操作，Esc/Enter 行为明确，不在预览触发。
- 验证：新增 editor extension tests；必要时跑 `npm test -- --run src/domains/editor/components/SplitView.test.tsx` 或相关 EditorPane tests。
- 记录证据、commit、push。

### P2-10 选区浮动工具栏第一版

- 仅源码编辑区触发，使用 CodeMirror 坐标；不在预览触发，不遮挡输入，不破坏选区。
- 覆盖加粗、斜体、链接等最小格式化，不做重型块编辑器。
- 验证：新增 EditorPane tests/manual smoke；如无现成测试 harness，记录手工步骤和截图。
- 记录证据、commit、push。

### P2-11 图标规范

- 建立 Prism icon spec：16/20px grid、线宽、圆角、hover/active、状态色、tooltip 规则。
- 暂不要求替换全部手写 SVG，但新增图标必须按规范，不混风格、不抖动。
- 验证：文档检查 + 截图审查；如改图标组件，跑相关 UI tests。
- 记录证据、commit、push。

## 11. Phase 4：P3 暂不做和总收口

- 确认 AI 自动写作、云同步、实时协作、插件市场、Notion 式数据库属性、Obsidian 式重型图谱、完整 block editor 仍保持暂不做或仅保留重评条件。
- 更新 README/帮助/计划中必要的 Not-now 说明，避免和已实现功能冲突。
- 跑最终验证并整理证据。

## 12. 验证分层

每个优化项完成后必须跑该项最小相关测试、`git diff --check`，并更新 `docs/verification/prism-full-optimization-run-2026-06-17.md`。

每个 phase 结束后跑阶段级验证：

- Phase 1：`npm test -- --run src/app/useAppShortcuts.test.tsx src/hooks/useBootstrap.test.tsx src/lib/openWindow.test.ts`，以及可行的 `npm run tauri:build:app-smoke`。
- Phase 2：`npm test -- --run src/lib/fileActions.test.ts src/domains/commands/categories/fileCommands.test.ts src/domains/editor/components/SplitView.test.tsx src/components/shell/CommandPalette.test.tsx src/domains/export/preflight.test.ts`，涉及 Rust 时跑 `cargo test`。
- Phase 3：`npm test -- --run src/domains/themes/themeContract.test.ts src/domains/themes/themeCss.test.ts src/components/shell/CommandPalette.test.tsx`，加截图/fixture/手工 smoke 证据。

最终必须跑：

- `git status --short --branch`
- `git diff --check`
- 所有新增/修改相关测试
- `npm run build`
- 如文件关联、Tauri、启动链路、真实 app smoke 被改动，跑 `npm run tauri:build:app-smoke`；如果无法运行，写明原因、已覆盖证据和残余风险。

测试失败必须先修复再继续；不得把失败测试当作已完成验收。

## 13. 完成条件

- P0、P1、P2 所有优化项均已实现或有明确环境阻塞说明；不能实现的项必须先显式更新 goal 并说明为什么不应继续。
- 每个优化项都有验证记录、命令结果、证据路径、未验证风险和 commit hash。
- `docs/verification/prism-full-optimization-run-2026-06-17.md` 完整记录全程。
- 最终工作树干净，所有 checkpoint 已推送到远端分支。
- 最终汇报：分支名、所有 commit hash、push 状态、执行过的验证命令、失败后已修复的问题、未验证风险、需要用户真机验证的项目。

## 14. 暂停条件

- 需要 destructive git 操作，例如 reset/checkout/revert/覆盖用户改动。
- 需要用户确认会改变产品定位的取舍，例如把 Prism 改成 AI/云/协作/IDE/知识库工作台。
- 需要证书、私钥、账号、付费闭源资料或生产凭据。
- Windows/Linux 真机验证是唯一能继续判定的条件，且当前环境无法提供；此时写明已完成的替代验证和待补验矩阵。
- 某个关键测试或构建连续三次因同一外部环境问题失败，且无法通过本地修复推进。
