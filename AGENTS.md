# Prism 工作指南

## 项目

Tauri 2 + React + TypeScript 的 macOS Markdown 编辑器，Typora 式单文档单窗口，视觉采用**妙言风格**。核心能力（编辑/分栏/预览、自动保存、KaTeX、Mermaid、导出）已实现。

分层：`src/app`（组合与模型）、`src/components`（通用 UI）、`src/domains/*`（按领域切分）、`src/lib`（无 UI 的纯逻辑与 worker）、`src/platform`（Tauri 与事件适配）、`src/styles`（令牌与主题）、`src-tauri`（Rust 侧）。

术语与决策见 `CONTEXT.md`，架构决策见 `docs/adr/`（0001–0008）。`docs/prism-openai-redesign.html` 仅作历史原型，不再是标准。

## 语言

中文交流；文档、规划与 commit message 用中文，代码注释可用英文。

## 红线

- 不 `force push` 共享分支，不对已推送的提交 `--amend`。
- 不提交真实密钥与凭据；只提交占位值，环境配置不入库。
- Tauri API 直连存量 12 处（窗口 / WebView / 事件 / 更新器），不再扩散；新增调用走 `src/platform`。

## 流程

1. **先设计后编码**：新功能与重构走 brainstorming → writing-plans → executing-plans，不跳过设计阶段。
2. **原型对齐**：以现有妙言界面为基准，动手前先读 `CONTEXT.md` 与 `docs/adr/`。
3. **用户裁决**：用户否定即调整，不辩护方案，体验优先。
4. **如实汇报**：未验证不说「完成」，阻塞与不确定直接说。

## 代码

- **分层守界**：`domains` 不反向依赖 `app`/`components`。
- **就近落位**：新逻辑放进对应 domain，不堆进 `App.tsx`；导出与解析等重逻辑放 `src/lib`。
- **类型从严**：不用 `any` 兜底；文件内容、IPC 返回值、外部 HTML 等边界数据先校验再使用。
- **依赖克制**：新增运行时依赖须说明用途与体积，优先复用现有能力（mermaid、katex、docx、pdf-lib、turndown）。
- **注释只解释「为什么」**，不复述代码。

## 提交

- 一提交一件事，不混合重构与功能改动。
- message 用自然语句描述改动，中文为主、技术术语保留英文原文（DMG、AppleScript、smoke、refactor 等），不加 `type:` 前缀；需要时用正文写动机与影响面。示例：`修复全局输入被抢占：默认构建不再触发 DMG Finder AppleScript 与 smoke 注入`。
- 提交前 `npx tsc --noEmit` 与相关 `npm test` 必须通过。
- 不提交 `dist/`、`src-tauri/target/`、临时日志与调试残留。

## 测试

- vitest + jsdom + Testing Library，测试与被测文件同目录（`*.test.ts(x)`）。
- 改行为必带测试；修 bug 先写复现用例再改实现。
- 覆盖重点不在此维护，以 `docs/adr/` 的决策与各 domain 既有 `*.test.*` 的分布为准。
- 质量门禁：`npx tsc --noEmit` + `npm test` + `npm run build`（build 内含 tsc）。项目未配置 lint，不要虚构 lint 命令。
- 涉及打包或原生行为时跑 `npm run macos:build-smoke`；仅前端改动不必。

## UI 质量

- 颜色、间距、字号、圆角、动效一律取自 `src/styles/tokens.css`，禁止散落硬编码色值。
- 新增令牌按 ADR-0002 命名、ADR-0008 治理；不引入 OpenAI-only 命名或 Fluent 旧别名。
- 状态齐全：hover / focus-visible / active / disabled / 空态 / 加载态 / 错误态，缺一不可交付。
- 键盘可达：焦点可见、Tab 顺序合理、Esc 可退出浮层。
- 浅色与深色、不同正文字号下均需自查；中文排版靠字号行高，不靠 `letter-spacing` 硬凑。
- 动效克制：时长 <500ms，优先 `transform`/`opacity`，不做纯装饰动画。

## 性能

- 大文档是主要压力源：输入路径上不做全量重渲染与全量重解析。
- 解析与导出走 worker 或异步（`export-worker.ts`、`markdownRender.worker.ts`），不阻塞输入。
- 长列表与大纲做虚拟化或分片；避免每帧读取布局属性（`offsetHeight` 等）。
- 新增依赖先评估打包体积；字体本地化等既有约定见 ADR-0003。
- 性能结论要有数据（耗时、帧率），不靠感觉下判断。

## 待办

不破坏妙言视觉，不移动已确认保留的入口；按序推进：

斜杠菜单 → 工作区索引 → 链接/反链/图谱 → 属性 → 模板 → 块操作 → 导出保真

状态栏降噪与命令面板整理已完成：底部状态栏已撤掉，状态区只读；命令面板只做快速打开与全文搜索，命令入口以菜单和快捷键为主。

## 协作

- **Issue**：GitHub Issues（`AlexPlum405/Prism`），用 `gh` CLI，详见 `docs/agents/issue-tracker.md`。
- **标签**：needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix。
- **领域文档**：单上下文布局，`CONTEXT.md` + `docs/adr/`。
- **规则文件**：本文件是唯一真身，`CLAUDE.md` 是指向它的软链，改规则只动这里。
