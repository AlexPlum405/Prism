# i18n 与无障碍基础安装版复测记录

日期：2026-07-01

App：`/Applications/Prism.app`

Bundle ID：`com.prism.editor.v1`

版本：`1.4.1`

测试文档：`fixtures/computer-use-real-app/real-complex-diagrams-export.md`

## 真实安装版 UI/AX 观察

- 打开真实安装版 Prism。
- 前台窗口 bundle 为 `com.prism.editor.v1`。
- 主窗口自绘菜单显示中文：`文件`、`编辑`、`插入`、`格式`、`导航`、`视图`、`导出`、`窗口`、`帮助`。
- 侧栏 tab 显示中文：`文件`、`大纲`。
- 状态栏和按钮显示中文：`新建文件`、`切换到文档列表`、`收起侧边栏`、`Markdown 文稿`、`排版`、`专注模式`、`导出`。
- `Cmd+,` 打开设置中心后，Computer Use AX 树可读到：
  - `container 设置中心`
  - `button 关闭`
  - `container 设置分类`
  - `button 通用 视图、语言与快捷键`
  - `button 写作 编辑器与自动保存`
  - `button 外观 主题与字体`
  - `button 导出 格式与默认位置`
  - `button 引用 Pandoc 与文献`
  - `button 文件 恢复与最近文档`
  - `heading 通用`
  - `text 界面语言`
  - `pop up button 简体中文`
  - `text 默认视图`
  - `pop up button 编辑`
  - `text 快捷键显示`
  - `pop up button 跟随系统`
- 以上说明早期 “设置弹窗控件未语义化、只能视觉判断” 的失败证据已过期。

截图：`screenshots/34-installed-i18n-a11y-retest/01-settings-zh-cn-ax-visible.png`

## 自动化测试

命令：

```bash
npm test -- --run src/domains/i18n/i18n.test.ts src/components/shell/SettingsModal.test.tsx src/components/shell/CommandPalette.test.tsx src/components/shell/ShortcutPanel.test.tsx
```

结果：

- 3 个测试文件通过。
- 25 条测试通过。
- i18n runtime 覆盖三语 translation key 完整性、auto locale fallback、document lang 更新。
- SettingsModal 覆盖设置导航、引用路径 aria-invalid 等基础语义。
- CommandPalette/ShortcutPanel 覆盖本地化入口和快捷键面板基础行为。

日志：`logs/unit-tests/i18n-a11y-shell-20260701.log`

## 结论

- `PRISM-FF-136 / P1-I18N-001`：Pass。
- `PRISM-FF-166 / P1-SETTINGS-002`：Pass。
