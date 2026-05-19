# Prism 写作体验 12 阶段全量优化验证记录

> 启动日期：2026-05-19  
> 目标：按 `CONTEXT.md` 已确认的 12 阶段顺序，增量完成 Prism 本地写作体验优化。  
> 主视觉：当前妙言风格（Miaoyan-style）。

## 基线

- `197655b`：确认妙言风格优化计划。
- 验证：`git diff --check` 通过。
- 推送：已推送 `origin/main`。

## 阶段 1：状态栏降噪

改动范围：

- `src/domains/workspace/components/StatusBar.tsx`
- `src/domains/workspace/components/StatusBar.module.css`
- `src/domains/workspace/components/StatusBar.test.tsx`

实现结果：

- 底部状态栏不再显示 `已保存` / `未保存` / `保存中`。
- 底部状态栏不再显示 `META` / `LINK n` / `BACKLINK n` / `TYPO n`。
- 中间统计压缩为 `字数 · 行:列`，选区状态为 `选区 n 字 · 行:列`。
- 可处理诊断聚合为右侧 `ERROR n`。
- 保留现有专注模式按钮与导出按钮。
- 保留后台导出状态 `导出中` 入口。

验证：

- `npm test -- --run src/domains/workspace/components/StatusBar.test.tsx`：7 项通过。
- `npm test -- --run`：69 个测试文件、415 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改前端状态栏呈现与测试，不涉及 Tauri capabilities、安装器、签名、公证、updater 或 file association。

## 阶段 2：命令面板整理

改动范围：

- `src/domains/commands/types.ts`
- `src/domains/commands/registry.ts`
- `src/domains/commands/registry.test.ts`
- `src/App.tsx`
- `src/domains/workspace/services/documentLinks.ts`
- `src/domains/workspace/services/documentLinks.test.ts`
- `src/domains/workspace/services/index.ts`
- `src/domains/workspace/components/DocumentLinksPanel.tsx`
- `src/domains/workspace/components/DocumentLinksPanel.test.tsx`
- `src/styles/global.css`

实现结果：

- 命令面板新增 `打开文档属性`、`查看当前文档链接`、`查看反向链接`、`查看关系图谱`。
- `打开文档属性` 打开现有 Front Matter 属性面板。
- `查看反向链接` 打开现有反向链接面板。
- `查看当前文档链接` 打开新增轻量文档链接面板，列出当前文档 Markdown/wiki 链接并可点击跳转。
- `查看关系图谱` 先接入命令入口，阶段 8 替换为正式轻量关系图谱。
- `META` / `LINK` / `BACKLINK` 已从状态栏移除，入口进入命令面板。

验证：

- `npm test -- --run src/domains/commands/registry.test.ts src/domains/workspace/services/documentLinks.test.ts src/domains/workspace/components/DocumentLinksPanel.test.tsx src/components/shell/CommandPalette.test.tsx`：4 个测试文件、32 项测试通过。
- `npm test -- --run`：70 个测试文件、419 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改命令面板、React 弹层与 TypeScript 服务，不涉及发布、签名、公证、updater 或安装器。

## 阶段 3：斜杠菜单

改动范围：

- `src/domains/editor/extensions/slashMenu.ts`
- `src/domains/editor/extensions/slashMenu.test.ts`
- `src/domains/editor/components/EditorPane.integration.test.tsx`
- `src/styles/global.css`

实现结果：

- 斜杠菜单补齐 `标题`、`分割线`、`图片`、`链接`。
- Callout 补齐 `IMPORTANT` 类型。
- 保留已有表格、Mermaid、KaTeX、代码块、Toggle、导出设置块、模板插入。
- 所有插入内容仍是标准 Markdown / HTML 片段。
- CodeMirror completion 浮层补充妙言主题样式，保持轻量低对比。

验证：

- `npm test -- --run src/domains/editor/extensions/slashMenu.test.ts src/domains/editor/components/EditorPane.integration.test.tsx`：2 个测试文件、22 项测试通过。
- `npm test -- --run`：70 个测试文件、419 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改编辑器 completion 源与前端样式，不涉及 Tauri capabilities、发布、签名、公证或安装器。
