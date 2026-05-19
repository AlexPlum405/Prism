# Prism 架构优化全阶段验证记录

> 启动日期：2026-05-20  
> 计划文件：`docs/prism-architecture-optimization-full-plan.md`  
> 目标：按 checkpoint 完成 10 个架构优化项，同时保持现有写作、预览、保存、恢复、搜索、诊断、导出能力不回退。

## 基线

- `fc5d828`：记录 Prism 架构优化全阶段计划。
- 工作树：开始执行时 `main...origin/main`，无未提交改动。
- 已读上下文：`AGENTS.md`、`CONTEXT.md`、`docs/adr/`、计划文件、`docs/verification/`。

## Checkpoint 2A：导出分页与失败诊断分层

改动范围：

- `src/domains/export/pagination.ts`
- `src/domains/export/pagination.test.ts`
- `src/domains/export/diagnostics.ts`
- `src/domains/export/diagnostics.test.ts`
- `src/domains/export/exportPipeline.ts`
- `src/domains/commands/registry.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出导出分页保护模块 `pagination.ts`，集中承载 atomic block 标记、标题与视觉块分组、分页 spacer、超高视觉块缩放、分页阈值常量。
- `exportPipeline.ts` 继续通过同一公开函数调用分页逻辑，HTML/PDF/PNG/DOCX 的现有导出路径不改变算法。
- 从 `registry.ts` 抽出导出失败诊断模块 `diagnostics.ts`，集中承载引用路径校验、Pandoc 状态、导出设置、warning、错误堆栈等诊断文本生成。
- 命令注册层保留导出编排与 toast 行为，不再内联导出诊断细节。
- 新增聚焦测试覆盖分页模块和诊断模块，原有导出 pipeline 与命令注册测试保持通过。

验证：

```bash
npm test -- --run src/domains/export/pagination.test.ts src/domains/export/diagnostics.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/export/isolatedWebviewExport.test.ts src/domains/export/index.test.ts src/domains/commands/registry.test.ts
```

结果：

- 7 个测试文件通过。
- 85 项测试通过。

跳过项：

- 本 checkpoint 只迁移 TypeScript 纯函数边界和新增单元测试，不改变 Tauri capabilities、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 2B：导出渲染等待与栅格兼容工具分层

改动范围：

- `src/domains/export/rendering.ts`
- `src/domains/export/rendering.test.ts`
- `src/domains/export/pagination.ts`
- `src/domains/export/exportPipeline.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出可复用渲染工具模块 `rendering.ts`。
- `rendering.ts` 统一承载导出 frame 等待、超时保护、栅格不兼容 CSS color 函数清理、WebKit color() 归一化、DOM computed color 归一化。
- `pagination.ts` 改为复用同一 frame wait helper，减少导出 pipeline 内部重复等待逻辑。
- `exportPipeline.ts` 继续使用原函数名别名接入新模块，避免大范围改调用点和导出行为。
- 新增聚焦测试覆盖 timer fallback、timeout rejection、CSS color 清理和 color() 归一化。

验证：

```bash
npm test -- --run src/domains/export/rendering.test.ts src/domains/export/pagination.test.ts src/domains/export/diagnostics.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/export/isolatedWebviewExport.test.ts src/domains/export/index.test.ts src/domains/commands/registry.test.ts
```

结果：

- 8 个测试文件通过。
- 89 项测试通过。

跳过项：

- 本 checkpoint 只迁移导出前端渲染辅助函数，不改变 Tauri capabilities、WebKit PDF Rust command、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 2C：导出 assets 工具分层

改动范围：

- `src/domains/export/assets.ts`
- `src/domains/export/assets.test.ts`
- `src/domains/export/exportPipeline.ts`

实现结果：

- 从 `exportPipeline.ts` 抽出资产处理工具模块 `assets.ts`。
- `assets.ts` 集中承载 data URL / bytes 转换、canvas PNG bytes 兜底、本地媒体路径解析、MIME 推断、DOCX raster 类型判断、图片尺寸读取、SVG 尺寸归一化、DOCX SVG foreignObject 文本降级。
- `exportPipeline.ts` 保留导出主流程和具体格式编排，继续调用同一转换函数，不改变 HTML/PDF/PNG/DOCX 导出算法。
- 新增聚焦测试覆盖 data URL 二进制转换、本地相对路径解析、媒体读取元数据、MIME/type 判断、SVG DOCX 兼容处理。

验证：

```bash
npm test -- --run src/domains/export/assets.test.ts src/domains/export/rendering.test.ts src/domains/export/pagination.test.ts src/domains/export/diagnostics.test.ts src/domains/export/exportPipeline.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/export/isolatedWebviewExport.test.ts src/domains/export/index.test.ts src/domains/commands/registry.test.ts
```

结果：

- 9 个测试文件通过。
- 94 项测试通过。

跳过项：

- 本 checkpoint 只迁移导出资产转换与路径解析工具，不改变 Tauri capabilities、导出格式、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 4A：编辑器命令定义分层

改动范围：

- `src/domains/commands/categories/editorCommands.ts`
- `src/domains/commands/registry.ts`

实现结果：

- 新增 `createEditorCommands()`，把编辑、插入、格式三类纯编辑器命令从 `registry.ts` 拆出。
- `registry.ts` 保留统一 registry 对外接口、快捷键查找、启用状态判断、命令执行与错误 toast。
- 外部菜单结构、命令 id、快捷键、enabled 条件、事件派发命令名保持不变。
- 本次只迁移定义层，不恢复全功能命令面板，也不改变 `Cmd+P` 快速打开和 `Cmd+Shift+F` 全文搜索定位。

验证：

```bash
npm test -- --run src/domains/commands/registry.test.ts src/domains/commands/platform.test.ts src/App.recovery.test.tsx
```

结果：

- 3 个测试文件通过。
- 38 项测试通过。

跳过项：

- 本 checkpoint 只移动命令定义代码，不改变 Tauri capabilities、文件系统、导出算法、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 4B：视图/主题/窗口/帮助命令定义分层

改动范围：

- `src/domains/commands/categories/viewCommands.ts`
- `src/domains/commands/categories/themeCommands.ts`
- `src/domains/commands/categories/windowCommands.ts`
- `src/domains/commands/categories/helpCommands.ts`
- `src/domains/commands/registry.ts`

实现结果：

- 把视图、主题、窗口、帮助相关命令定义从 `registry.ts` 拆入对应 category module。
- `registry.ts` 保留统一 registry 对外接口、快捷键查找、启用状态判断、命令执行与错误 toast。
- `Cmd+P` 仍只做快速打开，`Cmd+Shift+F` 仍只做全文搜索；没有恢复全功能命令面板。
- 命令 id、菜单类别、快捷键、checked/ enabled 条件和 run 行为保持不变。
- 文件、保存、恢复、导出等高耦合命令仍留在 `registry.ts`，等待后续按更深的文件安全层和导出命令边界继续拆分。

验证：

```bash
npm test -- --run src/domains/commands/registry.test.ts src/domains/commands/platform.test.ts src/App.recovery.test.tsx
```

结果：

- 3 个测试文件通过。
- 38 项测试通过。

跳过项：

- 本 checkpoint 只移动命令定义代码，不改变 Tauri capabilities、文件系统、导出算法、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。

## Checkpoint 4C：导出命令编排分层

改动范围：

- `src/domains/commands/categories/exportCommands.ts`
- `src/domains/commands/registry.ts`

实现结果：

- 新增 `createExportCommands()`，把 PDF / DOCX / HTML / PNG 导出命令、上次设置导出、覆盖上次导出从 `registry.ts` 拆出。
- 导出命令模块承载导出进度事件、导出保存路径请求、导出历史设置、质量档位、成功 toast 打开/显示位置动作、失败诊断与重试动作。
- `registry.ts` 不再直接依赖导出 pipeline、导出诊断、导出质量工具或导出历史类型。
- 外部命令 id、菜单类别、快捷键/启用条件、toast 文案、历史记录行为保持不变。

验证：

```bash
npm test -- --run src/domains/commands/registry.test.ts src/domains/commands/exportCommand.integration.test.ts src/domains/commands/platform.test.ts src/App.recovery.test.tsx
```

结果：

- 4 个测试文件通过。
- 39 项测试通过。

跳过项：

- 本 checkpoint 只移动导出命令编排代码，不改变导出 pipeline 算法、Tauri capabilities、真实 app 启动、发布、签名、公证、updater、安装器或 file association。
- 因此未跑发布级 DMG / 完整真实 app smoke；最终全阶段收口时仍需跑 `npm run tauri:build:app-smoke` 并重启本地 `Prism.app`。
