# Prism Theme Pack v1 验证记录

时间：2026-05-20

## 范围

本记录覆盖 Prism Theme Pack v1 的四阶段目标：

- 主题 registry 与用户主题读取。
- 设置中心主题导入、导入并应用、打开目录、重载、删除。
- HTML / PDF / PNG / DOCX 导出读取用户主题 contract。
- 样例主题与真实 macOS app smoke。

## 自动验证

### 收口复验（2026-05-20 18:25 CST）

```bash
npm test -- --run src/domains/themes src/domains/settings src/components/shell/SettingsModal.test.tsx src/domains/commands/registry.test.ts src/domains/editor/components/PreviewPane.test.tsx src/domains/export
```

结果：通过。23 个测试文件，176 个测试。

```bash
npm test -- --run
```

结果：通过。89 个测试文件，491 个测试。

```bash
npm run build
```

结果：通过。仍有既有 Vite large chunk warning。

```bash
git diff --check
```

结果：通过。

```bash
npm run tauri:build:app-smoke
```

结果：通过。真实 `Prism.app` 构建并完成既有 app smoke，证据写入 `.codex-smoke/app-smoke/evidence/report.json`。

Computer Use 复测结果：`list_apps` 返回 `codex app-server exited before returning a response`，仍不可用。本轮继续用真实 `Prism.app` + app-smoke/AppleScript/screencapture 证据覆盖真实 app 验证。

新依赖确认：`fflate` 通过 npm registry 查询为 `0.8.3`，许可证 `MIT`，仓库 `https://github.com/101arrowz/fflate.git`。

### 既有阶段验证记录

```bash
npm test -- --run src/domains/themes src/domains/settings src/components/shell/SettingsModal.test.tsx src/domains/commands/registry.test.ts src/domains/editor/components/PreviewPane.test.tsx src/domains/export
```

结果：通过。23 个测试文件，176 个测试。

```bash
npm test -- --run
```

结果：通过。89 个测试文件，491 个测试。

```bash
npm run build
```

结果：通过。Vite 仍有既有 large chunk warning，不影响本次功能正确性。

```bash
git diff --check
```

结果：通过。

```bash
npm run tauri:build:app-smoke
```

结果：通过。真实 `Prism.app` 构建并完成既有 app smoke：

- 打开 Markdown fixture。
- 状态栏 ERROR 诊断面板可打开。
- `Cmd+P` 可打开工作区目标文件。
- 基础编辑和 `Cmd+S` 保存成功。
- `Cmd+,` 可打开设置中心。
- 状态栏导出菜单可打开导出保存弹窗。

证据：`.codex-smoke/app-smoke/evidence/report.json`

## 主题包真实 app smoke

Computer Use MCP 在本轮验证中返回 `codex app-server exited before returning a response`，无法直接用 Computer Use 控制窗口。为避免跳过真实 app 验证，改用仓库既有 app-smoke 同类链路：真实 macOS `Prism.app` + AppleScript + `screencapture`。

步骤：

1. 备份 `~/Library/Application Support/com.prism.editor.v1/config.json` 与 `themes/`。
2. 将 `docs/examples/themes/warm-paper/` 安装到 `appData/themes/warm-paper/`。
3. 写入临时配置 `contentTheme: "warm-paper"`。
4. 启动真实 `src-tauri/target/release/bundle/macos/Prism.app` 打开 `.codex-smoke/theme-pack/workspace/theme-pack.md`。
5. 截图主窗口和设置中心。
6. 恢复用户原配置和主题目录。

结果：通过。真实 app 读取到用户主题，配置中的 `contentTheme` 为 `warm-paper`。

证据：

- `.codex-smoke/theme-pack/evidence/report.json`
- `.codex-smoke/theme-pack/evidence/01-warm-paper-main.png`
- `.codex-smoke/theme-pack/evidence/02-settings-center.png`

## 覆盖说明

- 文件夹主题：`docs/examples/themes/warm-paper/` 作为合法目录主题。
- `.zip` / `.prism-theme`：由 `themeInstaller.test.ts` 覆盖一层根目录、路径穿越拒绝、缺 `theme.json` 拒绝。
- CSS 安全：由 `themeCss.test.ts` 覆盖 scoped selector、远程资源拒绝、核心界面隐藏拒绝。
- 异常主题：由 `themeRegistry.test.ts` 覆盖异常主题不进入可用列表，并 fallback 到 `miaoyan`。
- 设置中心入口：由 `SettingsModal.test.tsx` 覆盖导入、导入并应用、打开主题目录、重载、删除当前用户主题按钮，以及异常主题禁用 option。
- 菜单栏：由 `registry.test.ts` 覆盖主题菜单从 runtime registry 生成，可用用户主题进入菜单，异常主题不进入菜单。
- 导出：由 `exportSettings.test.ts` 和 `exportPipeline.test.ts` 覆盖 runtime 用户主题的 write class、DOCX token、Mermaid font 读取，以及现有 HTML/PDF/PNG/DOCX 导出主链路。

## 剩余风险

- Computer Use MCP 本轮不可用，因此没有用该工具逐项点击导入按钮；已用真实 app + AppleScript smoke 与单元测试组合覆盖。
- 主题 CSS 当前是第一版安全过滤，能拦截远程资源、未 scoped selector 和高风险核心界面隐藏；后续若开放更多 CSS 能力，需要继续加强 CSS parser 级验证。
- DOCX 仍是结构化保真，不承诺完整 CSS 映射；复杂主题在 Word 中以 contract token 为准。
