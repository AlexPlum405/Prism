# 脏数据归档说明

> 归档日期：2026-05-30
> 目的：把一次性设计稿、临时报告、宣传素材、截图视频和本地冒烟输出集中管理，避免继续散落在项目主目录和 `docs/` 根层级。

## 归档范围

- `assets-brand/`：早期品牌宣传视频、HTML 展示页和预览 GIF。
- `assets-ui-audit/`：旧 UI audit 截图。
- `assets/`：已不再作为当前图标生成源的图标候选图、裁切图和 source sheet。
- `historical-docs/`：旧版本功能清单、一次性 UI 报告、已完成或已过期的 plan / goal / smoke / audit 文档。
- `history/`：根目录旧 `prism.html` 原型和早期 Markdown 编辑器 HTML 原型。
- `prototypes/`：早期设计探索、图标方案、侧栏/状态栏/图谱等 HTML 原型。
- `prism-promo-assets/`：Prism 产品视频使用过的截图素材。
- `prism-promo-video/`：Prism 产品视频旧导出、GIF、HTML 源和验证帧。
- `screenshot-legacy/`：未被 README 引用的旧截图、旧 intro 视频和 GIF。
- `ux-audit-assets/`：2026-05-29 UX 审计截图。
- 根目录下的 `prism-*.md/html/png`：一次性分析、竞品、UX、宣传和布局探索文档。
- `local-ignored/`：本地 Codex/Playwright/冒烟测试输出，继续由 `.gitignore` 忽略，不进入 Git。

## 未归档内容

- `docs/screenshot/prism-intro/assets/` 仍被 README 截图区引用，暂时保留在原位置。
- `docs/assets/prism-icon-red-panda-app-icon.png` 仍是 `scripts/generate-brand-icons.mjs` 的当前图标源，暂时保留在原位置。
- `docs/prism-openai-redesign.html` 被 ADR 和样式注释作为历史视觉参考引用，暂时保留在原位置。
- `docs/prism-rust-core-modernization-implementation-plan.md` 仍是当前待实施的 Rust Core 现代化计划，暂时保留在原位置。
- `docs/verification/`、`docs/releases/`、`docs/examples/`、`docs/agents/`、`docs/adr/` 属于正式证据、发布记录、示例、Agent 配置或架构决策，不纳入脏数据归档。
- `node_modules/`、`dist/`、`src-tauri/target/` 是标准依赖/构建缓存，只由 `.gitignore` 管理，没有搬入归档。

## 维护约定

后续新增的一次性分析文档、临时截图、视频导出中间产物、原型 HTML 和 smoke 输出，优先放到本目录下对应子目录。正式产品文档、架构决策、验证报告和 README 直接引用资产不要放进这里。
