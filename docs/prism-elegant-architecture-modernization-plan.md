# Prism 优雅架构现代化实现计划

> 日期：2026-05-21
> 用途：作为长期架构升级 `/goal` 的详细执行计划。短 goal 应引用本文，不把所有细节塞进 prompt。

## 1. 总目标

把 Prism 从“功能可以继续堆上去的模块化单体”，升级为“长期高频迭代仍然低风险的模块化桌面应用”。本计划不改变用户可见产品定位，不做视觉换皮，不重写业务算法，而是通过分阶段架构深化，让核心能力变成更深的 module：

- `App.tsx` 回到 composition root，只负责装配全局状态、窗口级 UI 和领域 model。
- 导出链路从巨型 `exportPipeline.ts` 变成 strategy + pipeline 结构。
- 编辑器链路从巨型 `EditorPane.tsx` 变成 CodeMirror runtime + editor command adapter + extension registry。
- Tauri 能力通过 platform adapter 进入前端，减少 React 业务代码直接依赖 native API。
- 全局事件从散落的 `window.dispatchEvent(new CustomEvent(...))` 收敛为 typed app event seam。
- Rust command 从单文件堆叠拆成按能力分组的 native command modules。

最终效果：新增功能时能清楚落到某个领域 module；修导出不碰 App；修编辑器命令不碰菜单；改主题不污染导出内部；改 Tauri 权限不污染 React 业务逻辑。

## 2. 当前架构判断

### 2.1 已经做对的部分

- 项目已有领域目录：`document`、`editor`、`export`、`workspace`、`themes`、`commands`、`settings`、`diagnostics`。
- 命令系统已有 registry、category 和快捷键基础。
- 主题系统已有 registry、contract、installer、validator，适合继续深化。
- 测试数量较多，适合作为行为保持型重构的安全网。
- `CONTEXT.md` 和 `docs/adr/` 已经记录产品边界，能避免架构重构跑偏。

### 2.2 主要架构问题

1. `src/App.tsx` 仍然是全局大脑，承担文档生命周期、工作区导航、诊断、导出弹窗、恢复、保存冲突、快捷键、菜单、modal 接线等职责。
2. `src/domains/export/exportPipeline.ts` 仍是最高风险巨型 module，HTML/PDF/PNG/DOCX、Mermaid、KaTeX、图片、分页、Pandoc、WebKit PDF、OpenXML 逻辑混在一起。
3. `src/domains/editor/components/EditorPane.tsx` 仍承担 CodeMirror 生命周期、命令事件、表格、搜索、粘贴图片、右键菜单、滚动条、格式化等多种职责。
4. `window.dispatchEvent` / `window.addEventListener` 作为隐式接口散落在 App、Editor、commands、file actions、export UI 中，payload 形状靠约定。
5. `src-tauri/src/lib.rs` 已经混合 Pandoc、文件授权、废纸篓、系统打开、PDF capture、启动文件事件，后续跨平台和发布能力会继续膨胀。

## 3. 架构原则

### 3.1 模块化单体，不做过度工程

Prism 是本地桌面写作器，不需要微服务式抽象，也不需要插件平台。目标是“深 module”，不是把文件机械拆碎。

### 3.2 保持行为不变

所有阶段默认是 behavior-preserving refactor。除非计划文件明确写出，不改变：

- 单文档单窗口。
- 本地优先。
- Markdown 源码可见。
- 当前妙言风格。
- 现有菜单、快捷键、导出、保存、文件树、设置中心入口。

### 3.3 Interface 先行

每个被拆出的 module 必须有清晰 interface：

- 调用方必须知道什么。
- 错误如何返回。
- 是否异步。
- 是否依赖 DOM / Tauri / CodeMirror。
- 测试应覆盖 interface，而不是只覆盖内部小函数。

### 3.4 先建立 seam，再迁移实现

每个阶段尽量按以下顺序：

1. 写出目标 interface。
2. 让旧实现先通过 adapter 挂到新 interface。
3. 补测试。
4. 迁移调用方。
5. 删除旧路径。

### 3.5 验证分层

不是每个阶段都跑最重 smoke。按风险分层：

- 纯文档：`git diff --check`。
- 纯 TS 结构迁移：相关测试 + `npm run build` + `git diff --check`。
- App 装配、命令、编辑器、导出：相关测试 + `npm test -- --run` + `npm run build` + `git diff --check`。
- Tauri/Rust/native command：补 `cargo test` 或 `cargo check`，并跑相关 app smoke。
- 真实 app 启动、导出、文件关联、窗口事件：`npm run tauri:build:app-smoke`。

## 4. 目标目录形态

这是目标方向，不要求一步到位。

```txt
src/
  app/
    AppShell.tsx
    useAppCommandContext.ts
    useAppShortcuts.ts
    useDocumentDiagnosticsModel.ts
    useDocumentNavigationModel.ts
    useSaveExportDialogModel.ts
    useStartupFileOpen.ts

  platform/
    events/
      appEvents.ts
      eventTypes.ts
    tauri/
      dialogs.ts
      fileSystem.ts
      nativeCommands.ts
      opener.ts
      paths.ts

  domains/
    document/
    workspace/
    editor/
      runtime/
        createEditorRuntime.ts
        editorCommandAdapter.ts
        editorClipboard.ts
        editorSearch.ts
      extensions/
    preview/
    export/
      exportService.ts
      formats/
        htmlExport.ts
        pdfExport.ts
        pngExport.ts
        docxExport.ts
      render/
        exportRenderer.ts
        diagramRenderer.ts
        imageRenderer.ts
        htmlFragmentRenderer.ts
      pdf/
        webkitPdfEngine.ts
        rasterPdfEngine.ts
        pdfChrome.ts
        pdfLinks.ts
      docx/
        docxBuilder.ts
        docxImages.ts
        docxInlineHtml.ts
        docxMdast.ts
      diagnostics/
      pipeline/
    commands/
    settings/
    themes/
    diagnostics/

  ui/
    shell/
    primitives/
```

```txt
src-tauri/src/
  lib.rs
  commands/
    file_scope.rs
    pandoc.rs
    pdf_capture.rs
    startup_files.rs
    system_open.rs
    trash.rs
  platform/
    macos.rs
    windows.rs
```

## 5. 分阶段实施计划

### Phase 0：架构基线与证据冻结

目标：

- 记录当前架构问题、目标目录、验证基线。
- 建立本轮架构现代化的 verification 文档。
- 不改业务代码。

建议文件：

- `docs/prism-elegant-architecture-modernization-plan.md`
- `docs/verification/prism-elegant-architecture-modernization.md`

验证：

- `git diff --check`

完成标准：

- 计划和验证入口存在。
- 明确当前工作树无关脏改。

### Phase 1：Typed app events 与 platform adapters

目标：

- 建立 `src/platform/events/appEvents.ts`，统一声明 app 内部事件名和 payload。
- 先覆盖当前高频事件：
  - `editor.command`
  - `editor.format`
  - `editor.heading`
  - `editor.blockFormat`
  - `command.run`
  - `search.open`
  - `file.action`
  - `file.renameRequest`
  - `toast.show`
  - `export.progress`
  - `export.failed`
  - `diagnostics.open`
- 建立 `src/platform/tauri/` adapter，逐步收敛 `open`、`invoke`、`readTextFile`、`writeTextFile`、`exists`、`opener` 等直接调用。

实现细节：

- 第一阶段不必一次替换所有调用，先让新增 typed event 和旧 `CustomEvent` 兼容。
- `appEvents.emit()` 内部可以继续使用 `window.dispatchEvent`，但外部不再手写字符串事件名。
- `appEvents.on()` 返回 unsubscribe，避免重复监听泄漏。
- 给 event payload 加 TypeScript 类型，不用 `any`。
- platform adapter 先从低风险路径开始，例如 toast、export progress、file action，不先碰保存和导出核心写文件。

风险：

- 事件名迁移容易漏调用方。
- 测试环境需要 mock window event。

验证：

- `npm test -- --run src/hooks/useAppToast.test.tsx src/hooks/useExportTaskUi.test.tsx src/domains/editor/components/EditorPane.integration.test.tsx src/domains/commands/registry.test.ts src/App.recovery.test.tsx`
- `npm run build`
- `git diff --check`

完成标准：

- 至少 5 类现有 app event 迁移到 typed interface。
- 未迁移事件在 verification 文档列出后续计划。

### Phase 2：App.tsx 瘦身为 composition root

目标：

- 把 `App.tsx` 中的领域状态和副作用拆成有名字的 model hooks。
- `App.tsx` 只负责组合 UI、传递 model 输出、注册少量顶层 shell 行为。

建议拆分：

- `src/app/useAppCommandContext.ts`
- `src/app/useAppShortcuts.ts`
- `src/app/useDocumentDiagnosticsModel.ts`
- `src/app/useDocumentNavigationModel.ts`
- `src/app/useSaveExportDialogModel.ts`
- `src/app/useStartupFileOpen.ts`

实现细节：

- 先抽纯逻辑，不移动 JSX。
- 每个 hook 明确输入和输出，不直接读所有 store。
- 保留原有状态名字，减少 diff 风险。
- `useSaveExportDialogModel` 包含保存/导出弹窗状态、目录选择、覆盖确认、清晰度选择、默认导出目录。
- `useDocumentDiagnosticsModel` 聚合链接、图片、标题、渲染、表格、排版和导出预检诊断。
- `useDocumentNavigationModel` 聚合 document links、backlinks、relation graph、跳转和打开文件。
- `useStartupFileOpen` 处理 Tauri pending files 和 `file-opened` 事件。

风险：

- hook 依赖数组容易漏项。
- 关闭弹窗、恢复快照、保存冲突之间的可见性规则不能变。

验证：

- 每拆一个 hook 跑相关 App 测试。
- 最终跑：
  - `npm test -- --run src/App.recovery.test.tsx`
  - `npm test -- --run`
  - `npm run build`
  - `git diff --check`

完成标准：

- `App.tsx` 行数显著下降。
- App 测试通过。
- 用户可见行为不变。

### Phase 3：Export strategy + pipeline 深化

目标：

- 保持现有导出 API 行为不变，把 `exportPipeline.ts` 拆成深 module。
- 导出对外 interface 稳定，内部使用 format strategy。

目标结构：

```txt
src/domains/export/
  exportService.ts
  pipeline/exportPipelineContext.ts
  pipeline/createRenderedExportNode.ts
  formats/htmlExport.ts
  formats/pdfExport.ts
  formats/pngExport.ts
  formats/docxExport.ts
  render/exportCss.ts
  render/diagramRenderer.ts
  render/imageRenderer.ts
  render/htmlFragmentRenderer.ts
  pdf/webkitPdfEngine.ts
  pdf/rasterPdfEngine.ts
  pdf/pdfChrome.ts
  pdf/pdfLinks.ts
  docx/docxBuilder.ts
  docx/docxImages.ts
  docx/docxInlineHtml.ts
  docx/docxMdast.ts
```

实现细节：

- 保持 `exportHtml`、`exportPdf`、`exportPng`、`exportDocx` 的外部导出名，先通过 re-export 兼容现有调用方。
- 先拆纯工具：CSS 收集、URL 安全、链接 rect、canvas limit、header/footer 文本。
- 再拆 render：Mermaid、SVG、图片、HTML fragment、KaTeX。
- 再拆 PDF：WebKit engine、raster fallback、chrome overlay、link annotation。
- 再拆 DOCX：mdast 转换、inline HTML、图片、Mermaid PNG-first、details/callout fallback。
- 每次移动后先保证测试通过，不混入算法优化。

风险：

- 导出链路最容易回归。
- DOCX 和 PDF 共用的视觉资源处理不能重复分叉。
- WebKit PDF 与 raster fallback 的错误信息不能丢。

验证：

- 聚焦：
  - `npm test -- --run src/domains/export/exportPipeline.test.ts`
  - `npm test -- --run src/domains/commands/exportCommand.integration.test.ts src/domains/export/isolatedWebviewExport.test.ts src/domains/export/index.test.ts`
- 全量：
  - `npm test -- --run`
  - `npm run build`
  - `git diff --check`
- 若触及真实导出 worker 或 Tauri PDF capture：
  - `npm run tauri:build:app-smoke`

完成标准：

- `exportPipeline.ts` 不再是主要实现文件，或者仅保留对外 facade。
- HTML/PDF/PNG/DOCX 关键测试全部通过。
- verification 文档列出拆分后的 module 责任。

### Phase 4：Editor runtime 与 command adapter 拆分

目标：

- 让 `EditorPane.tsx` 只负责挂载 CodeMirror view 和渲染局部 UI。
- 编辑器行为进入 runtime 和 extension modules。

建议拆分：

- `src/domains/editor/runtime/createEditorRuntime.ts`
- `src/domains/editor/runtime/editorCommandAdapter.ts`
- `src/domains/editor/runtime/editorClipboard.ts`
- `src/domains/editor/runtime/editorSearch.ts`
- `src/domains/editor/runtime/editorScroll.ts`
- `src/domains/editor/runtime/editorTableRuntime.ts`

实现细节：

- 先抽命令 adapter：处理 `bold`、`heading`、`blockFormat`、`insertTable`、template、paragraph/section 操作。
- 再抽 clipboard：图片粘贴、富文本复制、Markdown 表格粘贴。
- 再抽 search：隐藏 search panel、find/replace command、restore search。
- 再抽 scroll/typewriter：scroll ratio、top line、jump to line。
- 事件入口改用 typed app events。
- CodeMirror Compartment 配置可以保留在 runtime factory。

风险：

- CodeMirror view 生命周期复杂，不能在 React render 中创建多份 view。
- table floating toolbar 和 table popover 依赖 selection，拆分时不能丢同步。

验证：

- `npm test -- --run src/domains/editor/components/EditorPane.integration.test.tsx`
- `npm test -- --run src/domains/editor/extensions/*.test.ts`
- `npm run build`
- `git diff --check`

完成标准：

- `EditorPane.tsx` 行数显著下降。
- 编辑器命令、表格、搜索、图片粘贴测试通过。

### Phase 5：Markdown core、workspace index 与 preview/export 一致性

目标：

- 把 Markdown 文档理解沉淀为稳定 core。
- 预览、导出、链接诊断、反链、图谱、Front Matter 尽量复用同一文档模型。

实现细节：

- 继续深化 `src/domains/markdown/documentModel.ts`。
- 文档模型至少覆盖：
  - headings
  - links
  - images
  - front matter
  - source line
  - callout
  - details/toggle
  - Mermaid/KaTeX block placeholder
- `workspaceIndex` 使用 document model，减少重复正则扫描。
- 导出预检和诊断从 document model 获取结构信息。

风险：

- Markdown 解析差异会影响现有预览和导出。
- 大文档性能不能明显下降。

验证：

- `npm test -- --run src/domains/markdown/documentModel.test.ts src/lib/markdownToHtml.test.ts src/domains/workspace/services/workspaceIndex.test.ts`
- 导出和诊断相关测试。
- 长文 benchmark 如已有则继续跑。

完成标准：

- 工作区索引、链接诊断、关系图谱至少部分复用 Markdown core。
- verification 记录复用点和仍保留的独立扫描点。

### Phase 6：统一诊断模型深化

目标：

- 链接、图片、标题、表格、渲染、排版、导出预检全部进入统一诊断模型。
- UI 只消费 `PrismDiagnostic[]`。

实现细节：

- `PrismDiagnostic` 字段稳定：
  - `id`
  - `kind`
  - `severity`
  - `source`
  - `line`
  - `column`
  - `message`
  - `detail`
  - `action`
  - `target`
- `getActionableErrorDiagnostics()` 是状态栏 `ERROR n` 的唯一过滤入口。
- 排版建议默认不计入 `ERROR`，除非设置开启严格检查。
- 导出阻断项和导出 warning 明确分级。

风险：

- 用户看到的 `ERROR n` 数量可能变化，必须符合 `CONTEXT.md`。

验证：

- `npm test -- --run src/domains/diagnostics/*.test.ts src/domains/editor/components/DocumentDiagnosticsPanel.test.tsx src/domains/workspace/components/StatusBar.test.tsx`
- 导出预检相关测试。

完成标准：

- App 不再手工拼装多个诊断 UI 类型。
- 状态栏和诊断面板共享同一过滤逻辑。

### Phase 7：Settings 和 UI primitives 瘦身

目标：

- 设置中心保持妙言风格，但减少 `SettingsModal.tsx` 的业务逻辑。
- 建立少量可复用 UI primitives，不做大设计系统。

建议拆分：

- `src/components/shell/settings/useThemeSettingsModel.ts`
- `src/components/shell/settings/useExportSettingsModel.ts`
- `src/components/shell/settings/useCitationSettingsModel.ts`
- `src/ui/primitives/Dialog.tsx`
- `src/ui/primitives/Button.tsx`
- `src/ui/primitives/FieldRow.tsx`
- `src/ui/primitives/Toast.tsx` 或保留 shell Toast 但统一接口。

实现细节：

- 先抽设置业务 model，不先做视觉变化。
- Button/Dialog/FieldRow 只覆盖现有重复样式，不引入新的视觉语言。
- 主题导入、替换、删除 prompt 继续使用 Prism 内部弹窗，不回到系统 alert。

风险：

- 组件抽象过早会增加心智负担；只抽真实重复的东西。

验证：

- `npm test -- --run src/components/shell/SettingsModal.test.tsx`
- `npm run build`
- `git diff --check`

完成标准：

- `SettingsModal.tsx` 行数下降。
- 设置中心行为和视觉不变。

### Phase 8：Tauri native commands 模块化

目标：

- 拆分 `src-tauri/src/lib.rs`，让 Rust 侧 command 按能力分组。

建议结构：

```txt
src-tauri/src/
  lib.rs
  commands/
    mod.rs
    file_scope.rs
    pandoc.rs
    pdf_capture.rs
    startup_files.rs
    system_open.rs
    trash.rs
```

实现细节：

- `lib.rs` 保留 builder、plugin 注册、command 注册。
- `pandoc.rs` 包含 pandoc detect 和 citeproc HTML。
- `file_scope.rs` 包含 markdown/workspace scope grant。
- `trash.rs` 包含系统废纸篓和 macOS fallback。
- `pdf_capture.rs` 包含 WebKit PDF capture。
- `startup_files.rs` 包含 pending files 和 macOS opened event 支持。
- Rust 测试随模块迁移。

风险：

- Tauri command path 和 generate_handler 不能变。
- macOS 条件编译容易漏 `cfg`。

验证：

- `cd src-tauri && cargo test`
- `npm run tauri:build:app-smoke`
- `git diff --check`

完成标准：

- `lib.rs` 不再包含大量 command 实现。
- Rust 测试通过。

### Phase 9：主包性能与依赖边界

目标：

- 验证架构拆分没有增加首屏成本。
- 优化已知 main chunk 污染点。

实现细节：

- 记录 `npm run build` 输出中的 `main`、`export-pipeline`、`mermaid.core`、`vendor-docx`、`vendor-pdf`。
- 优先懒加载：
  - preview markdown heavy renderer。
  - relation graph。
  - highlight.js 重依赖。
  - 导出 worker only 依赖。
- 不为体积牺牲预览和导出稳定性。

风险：

- 动态 import 会改变加载时机，可能导致首个预览或导出延迟。

验证：

- `npm run build`
- 必要时 `npm exec vite build -- --sourcemap`
- 真实 app smoke。

完成标准：

- verification 文档记录优化前后 chunk 结果。
- 若没有下降，说明原因和后续可选项。

### Phase 10：最终真实 App smoke 和完成审计

目标：

- 用真实 `.app` 验证核心链路。
- 对照本计划逐项做 completion audit。

最小 smoke 覆盖：

- 启动 Prism.app。
- 打开 Markdown 文件。
- 文件树与当前文档同步。
- 基础编辑和保存。
- `Cmd+P` 快速打开。
- 设置中心打开。
- `ERROR n` 诊断入口。
- 导出保存弹窗。
- 后台导出状态。
- 主题切换和主题导入入口不退回系统 alert。

验证：

- `npm test -- --run`
- `npm run build`
- `git diff --check`
- `npm run tauri:build:app-smoke`
- 重启 `src-tauri/target/release/bundle/macos/Prism.app`

完成标准：

- verification 文档完整记录每个 phase 的证据。
- 所有可提交改动已 commit 并 push。
- 最终报告包含 commit hash、push 状态、验证证据、跳过项原因、剩余风险。

## 6. 特殊情况处理

### 6.1 工作树脏

- 开始每个 checkpoint 前必须看 `git status --short` 和 `git diff`。
- 不提交 `.antigravitycli/`、`temp_script_check.js` 这类本地 scratch。
- 如果无关脏改在本阶段不会被碰到，说明并避开。
- 如果无关脏改和目标文件冲突，暂停说明，不擅自覆盖。

### 6.2 测试已有失败

- 先确认失败是否由本 checkpoint 引入。
- 如果是本 checkpoint 引入，必须修。
- 如果是历史无关失败，记录命令、失败摘要、归因和继续策略。
- 最终 gate 不能忽略真实相关失败。

### 6.3 需要新增依赖

- 默认不新增依赖。
- 如果确实需要，暂停并说明：
  - 为什么必须新增。
  - 当前替代方案为什么不够。
  - 许可证和体积影响。
  - 是否影响离线使用。

### 6.4 真实 app smoke 工具不可用

- 优先跑 `npm run tauri:build:app-smoke`。
- 如果 Computer Use 不可用，记录错误和 fallback，不阻塞所有开发。
- 如果 smoke 脚本暴露真实问题，优先修真实问题。

### 6.5 平台差异

- macOS 是当前主要验证平台。
- 触及 Tauri、文件系统、废纸篓、系统打开、PDF capture 时必须考虑 Windows/Linux 条件编译或明确不支持。
- 不把 macOS-only 能力伪装成跨平台能力。

### 6.6 数据安全

- 保存、另存、恢复、冲突、删除、废纸篓、导出覆盖等路径必须保守。
- 禁止直接永久删除用户文件。
- 任何影响文件写入的重构必须有回归测试。

### 6.7 视觉稳定

- 架构重构不做视觉换皮。
- 新抽出的 UI primitive 必须复用当前妙言风格，不引入新视觉体系。
- 不能移除已确认保留的导出按钮、专注模式按钮、标题栏视图切换。

## 7. Commit 与 push 规则

- 每个 phase 或安全 checkpoint 完成后，如果验证通过，立即 commit 并 push。
- commit message 使用中文。
- 不把无关本地文件加入 commit。
- 每个 commit 尽量只覆盖一个清晰架构主题，例如：
  - `建立类型化应用事件接口`
  - `抽离 App 导出保存弹窗模型`
  - `拆分 WebKit PDF 导出引擎`

## 8. 最终验收标准

本计划完成时必须同时满足：

- `App.tsx`、`EditorPane.tsx`、`exportPipeline.ts`、`src-tauri/src/lib.rs` 的职责明显收敛。
- 核心用户链路无回退：打开、编辑、保存、预览、搜索、链接跳转、主题、导出。
- 全量测试和构建通过。
- 真实 app smoke 通过或有明确不可自动化原因和人工测试手册。
- verification 文档记录完整。
- 所有可提交改动已 push 到 `origin/main`。

## 9. 不做的事情

- 不重写成新框架。
- 不引入 Redux 或大型状态机，除非后续有明确收益。
- 不做插件市场。
- 不做云同步。
- 不做完整 WYSIWYG。
- 不做 Notion database。
- 不做视觉换皮。
- 不做发布签名、公证或生产 release。
