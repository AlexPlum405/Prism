# UI、主题、语言与快捷键 Smoke

## 标题栏与窗口控制

已验证：

- `03-titlebar-window-controls.png`：Prism 窗口级截图，尺寸 1102x792。
- `03b-maximized.png`：Prism 最大化窗口截图，尺寸 2560x1392。

结果：Windows 标题栏、最小化、最大化、关闭按钮可见；最大化后编辑区、文件树和状态栏没有重叠。

## 多窗口

步骤：

1. 打开 `query.sql`。
2. 在该窗口仍打开时，再用安装版 `app.exe` 打开 `windows-smoke.md`。

结果：

- 系统出现两个 Prism 进程 / 两个 Prism 窗口。
- 一个窗口保持 `query.sql`，状态为 `文本文件`。
- 另一个窗口打开 `windows-smoke.md`，状态为 `Markdown 文稿`。
- 没有变成标签页，也没有错误跳回旧文件。

## 主题与语言

已重采窗口级截图：

- `06-theme-miaoyan.png`
- `06b-theme-inkstone.png`
- `06c-theme-slate.png`
- `06d-theme-mono.png`
- `07-theme-nocturne-dark.png`
- `11-locale-zh.png`
- `12-locale-en.png`
- `13-locale-ja.png`

结果：MiaoYan、Inkstone Light、Slate Manual、Mono Lab、Nocturne Dark 主题以及中文、English、日本語设置窗口均可显示；本轮未发现明显文字溢出。

主题补验方式：

1. 备份 `%APPDATA%\com.prism.editor.v1\config.json`。
2. 依次把 `contentTheme` 设置为 `inkstone`、`slate`、`mono`，用安装版 Prism 打开 `windows-smoke.md`。
3. 每次只保留一个 Prism 窗口并保存窗口级截图。
4. 测试结束后恢复原始配置，恢复后 `contentTheme=miaoyan`、`locale=zh-CN`。

## 知识图谱入口

测试工作区：

```text
C:\Users\alex\Documents\PrismWindowsSmoke\GraphSmoke
```

文件：

- `a.md`：包含 `[Graph Smoke B](b.md)` 和 `[[b]]`。
- `b.md`：包含 `[Graph Smoke A](a.md)`。

结果：

- 打开 `a.md` 后，状态栏出现 `查看关系图谱` 按钮。
- 点击后打开 `关系图谱` 面板，能看到 `Graph Smoke A` 和 `Graph Smoke B` 两个节点，以及 `1 出 / 0 入`、`0 出 / 1 入` 的关系摘要。
- 截图：`15-relation-graph.png`，Prism 窗口级截图，尺寸 1102x792。
- 对照打开 `plain.txt` 时，状态栏显示 `文本文件`，没有 `关系图谱` 入口。

## 查找 / 替换

在 `keyboard-smoke.md` 中验证：

- `Ctrl+F` 打开查找栏。
- `Ctrl+H` 展开替换栏。
- 替换栏显示 `查找`、`替换`、`替换`、`全部替换` 控件。

结果：Pass。

## 快捷键问题

在 `keyboard-smoke.md` 中验证：

- `Ctrl+B` / `Ctrl+I`：选中文本后快捷键未写入 Markdown 加粗 / 斜体标记；文件内容仍为 `keyboard smoke`。
- `Ctrl+O`：未出现系统打开文件对话框。
- `Ctrl+N`：未创建或切换到新文稿。
- `F11`：未改变窗口尺寸，未进入全屏。

已通过：

- `Ctrl+F`
- `Ctrl+H`
- `F8`：状态区出现 `专注模式 (F8)`。

## F9 打字机模式

源码和菜单中存在 `typewriterMode` / `打字机模式 F9`。

真机 UI 观察：

- `View` 菜单可见 `打字机模式 F9`。
- 顶部 `视图` 菜单可访问树可稳定读到 `菜单项目 打字机模式 F9`。
- 可访问树没有暴露稳定的 checked / selected 状态。
- 触发 F9 后视觉变化不稳定，本轮没有可重复、可归档的窗口级证据。

结论：保持 Blocked，需要人工视觉补验。本轮未保存曾被其它浮层干扰的截图。

## 条件项：Ctrl + 鼠标滚轮字号

计划要求该项仅在验证 commit 包含 `912c9fb5 支持编辑预览滚轮调整字号` 时执行。

当前严格验证基线为：

```text
e03f199e6f3bcd256bc9cc83c356302e69239d31
```

该基线不包含 `912c9fb5`，因此本轮按计划记录为 Not Run。

证据限制：

- `Ctrl+S` 未出现错误提示；由于格式化快捷键未产生内容变化，无法把本轮结果作为独立保存成功证据。

## 高 DPI

本机当前系统 DPI 为 96，即 100% 缩放。

125% / 150% 缩放未改系统设置执行。该项需要改动 Windows 显示缩放，可能影响当前会话和后续截图，因此状态为 Blocked，需用户确认后补验。
