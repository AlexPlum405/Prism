# Prism Rust Core Modernization Goal Prompt

```text
/goal 在 /Users/Alex/AI/project/Prism 中，按 docs/prism-rust-core-modernization-implementation-plan.md 完成 Prism Rust Core Modernization。

开始前先读：AGENTS.md、CONTEXT.md、docs/adr/、docs/prism-rust-core-modernization-implementation-plan.md、docs/verification/、当前 git status 和 git diff。当前工作树可能有小熊猫图标与设置中心白屏修复等未提交改动；必须先识别并避开无关脏改，不要 reset、checkout、revert 或覆盖它们。

目标：把 Prism 调整为“React / CodeMirror 负责编辑器、预览、设置中心、菜单、状态栏、弹窗、主题 CSS、用户交互；Rust / Tauri 负责文件系统、工作区索引、搜索、反链/图谱数据、导出任务、PDF capture、资源读取、系统集成、错误诊断”的架构。保持当前妙言风格、单文档单窗口、本地优先 Markdown 写作器定位，不做 Rust 原生 UI 重写，不移除 WebView，不重写 CodeMirror。

执行方式：full-run，但必须按计划文件的 Phase 0-10 分阶段推进。每个 phase 开始前汇报本阶段目标、影响文件、风险等级、验证命令；每个可独立闭环的 checkpoint 实现后更新必要 docs/verification 证据，运行对应验证，单独提交并 push，然后进入下一阶段。不要把无关脏改混入提交；需要提交时只 stage 本阶段相关文件。

实现原则：先建 seam，再迁实现；先让旧实现挂到新 interface 后面，再切 Rust implementation；每个 Rust 化能力至少保留一个发布周期的 TypeScript fallback，除非该能力只能由系统层实现。Rust command 必须返回结构化错误；前端业务代码逐步停止直接 import Tauri fs/dialog/opener/core，改走 src/platform/tauri adapters。

范围边界：只做计划文件中的架构 Rust 化和必要前端瘦身。不要做插件市场、云同步、移动端、实时协作、数据库式 Properties、AI 写作平台、视觉换皮、菜单入口重排或无关导出格式扩展。不要改变现有编辑/分栏/预览、导出按钮、专注模式按钮、文件树、设置中心入口。

验证分层：文档阶段只跑 git diff --check；前端 adapter/model 改动跑相关 Vitest + npm run build + git diff --check；Rust command 改动跑 cd src-tauri && cargo test、cargo check，再跑 npm run build + git diff --check；文件安全、工作区索引、导出链路按计划文件中的专项测试矩阵执行；只有文件关联、窗口生命周期、Tauri capabilities、native PDF capture、安装器/updater/签名/打包变化才跑真实 app smoke 或 app bundle 构建。跳过重验证时必须说明已由哪些证据覆盖。

完成条件：计划文件 Phase 0-10 全部完成；docs/verification 中有每阶段证据；相关测试、cargo check/test、npm run build、git diff --check 通过；必要真实 app smoke 已执行或说明签名凭据导致的非功能性阻塞；所有阶段 commit 已 push；最终汇报阶段清单、关键文件、验证证据、剩余风险、commit hash 和 push 状态。

暂停条件：需要产品/架构确认、破坏性 git 操作、签名/发布凭据、生产发布权限、Windows 实机验证或无法绕开的平台能力缺失时暂停并说明当前已完成内容、阻塞原因和下一步最小动作。
```
