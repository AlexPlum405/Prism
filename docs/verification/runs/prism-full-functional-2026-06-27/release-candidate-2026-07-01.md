# Prism RC 验证检查点

日期：2026-07-01
App：`/Applications/Prism.app`
Bundle ID：`com.prism.editor.v1`
版本：`1.4.1`

## 本轮目标

继承 `prism-full-functional-2026-06-27` 已有全功能证据，不从头重跑全量测试；优先闭环剩余 Blocked 中对真实用户体验影响最高的 `PRISM-FF-132 导出打开产物动作`。

## 代码改动

- 导出成功 toast 的 `打开` 与 `显示位置` action 增加 `dismissOnClick: false`，点击任一动作后 toast 不再立即关闭。
- 导出成功且带动作的 toast 使用 `EXPORT_ACTION_TOAST_DURATION_MS = 15000`，给用户和自动化复测足够时间点击后续动作。
- `scripts/run-app-smoke.mjs` 增强窗口/截图稳定性：Quick Open 重试、截图尺寸变化按重叠区域比较、退出时清理所有 Prism app 实例。

## 验证命令

```bash
git status --short --branch
npm test -- --run src/hooks/useExportTaskUi.test.tsx src/domains/commands/registry.test.ts src/domains/commands/exportCommand.integration.test.ts
npm run build
npm run tauri:build:app-smoke
PRISM_APP_PATH=/Applications/Prism.app node scripts/run-app-smoke.mjs
```

当前结果：

- Vitest：3 个测试文件 / 39 条断言通过。
- `npm run build`：通过。
- `npm run tauri:build:app-smoke`：通过，完成 app bundle 构建、Markdown 文档图标 patch、本地 bundle smoke。
- `/Applications/Prism.app` 安装版 smoke：通过，覆盖 `.markdown` 中文/空格路径、JSON/SQL/TXT、Markdown、ERROR 诊断、Quick Open、编辑保存、导出菜单、设置中心、HTML/PDF/PNG/DOCX 复杂导出产物。
- 安装版身份：`CFBundleIdentifier = com.prism.editor.v1`，`CFBundleName = Prism`，版本 `1.4.1`。

## PRISM-FF-132 复测结果

状态：Pass

真实安装版步骤：

1. 用 `/Applications/Prism.app` 打开 `/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md`。
2. 导出为 HTML，确认 `替换并导出`。
3. 截图确认成功 toast 显示 `HTML 导出完成`、产物文件名、`打开`、`显示位置`。
4. 点击 `打开`，前台应用变为 `Google Chrome`，打开本地 HTML 产物。
5. 再次导出 HTML。
6. 点击 `显示位置`，前台应用变为 `Finder`，Finder 打开 `Examples` 目录并选中 `Prism Markdown 语法指南.html`。

证据：

- `screenshots/35-installed-export-open-actions-retest/01-html-export-success-toast.png`
- `screenshots/35-installed-export-open-actions-retest/02-open-action-external-app.png`
- `screenshots/35-installed-export-open-actions-retest/03-html-export-success-toast-for-reveal.png`
- `screenshots/35-installed-export-open-actions-retest/04-reveal-action-finder-location.png`
- `logs/computer-use-real-app/export-open-actions-installed-retest-20260701.md`
- `logs/app-smoke-installed-ff132-20260701/open-action-evidence.txt`
- `logs/app-smoke-installed-ff132-20260701/reveal-action-evidence.txt`

## 当前统计

```json
{
  "total": 168,
  "Pass": 139,
  "Fail": 0,
  "Blocked": 29,
  "Not Run": 0,
  "screenshotFiles": 433,
  "manifestScreenshots": 1015,
  "uniqueManifestScreenshots": 454,
  "computerUseRealAppEvidence": 245
}
```

## 剩余 Blocked 分类

- Windows/Linux 真机：无真实 Windows/Linux 设备，不伪造导出和文件关联验证。
- 权限拒绝/破坏性操作：需要用户明确确认后才能执行拒绝权限、删除、重命名父目录等破坏性或半破坏性路径。
- 注入故障/断网/Worker/内存压力：需要专门故障注入、断网环境或长时间压力采样，本轮不把未执行项改 Pass。
- 短暂动画类证据：预览源码 flash 等需要录屏或可控动画时长专项复测。

## 结论

本轮已形成可发布候选检查点：Fail 仍为 0，`PRISM-FF-132` 已真实闭环为 Pass，剩余非通过项均保持 Blocked 且不伪造验证。
