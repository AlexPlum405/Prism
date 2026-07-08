# 路径与文件动作 Smoke

## 中文、空格、括号路径

验证路径：

```text
C:\Users\alex\Documents\PrismWindowsSmoke\路径 Smoke (中文 空格)\复杂 路径 (测试).md
```

结果：

- Prism 可以打开该 Markdown 文件。
- 文件树显示 `复杂 路径 (测试).md`。
- 编辑区显示 `复杂路径 Smoke` 内容。

## 复制文件路径

在 Prism 文件树右键菜单中执行 `复制文件路径`。

剪贴板结果：

```text
\\?\C:\Users\alex\Documents\PrismWindowsSmoke\路径 Smoke (中文 空格)\复杂 路径 (测试).md
```

结论：路径保留 Windows 原生反斜杠与长路径语义，没有被改写成 Unix 风格。

## 在资源管理器中显示

在 Prism 文件树右键菜单中执行 `在资源管理器中显示`。

结果：

- Windows 文件资源管理器打开目标目录。
- 目标文件 `复杂 路径 (测试).md` 被选中。
- 截图已重采为窗口级别：`screenshots/04-file-association-explorer.png`，尺寸 1125x635，没有桌面、Codex 或任务栏污染。

## 删除到回收站

状态：Pass。

用户已在 2026-07-09 明确确认允许通过 Prism UI 删除测试文件：

```text
C:\Users\alex\Documents\PrismWindowsSmoke\DeleteSmoke\delete-me.md
```

动作前 SHA256：

```text
435054A230788A46A02A6F328793EFBB6372A342184DB279B4679420C813989A
```

复测步骤：

1. 用安装版 Prism 打开 `DeleteSmoke\delete-me.md`。
2. 在文件树中右键 `delete-me.md`。
3. 点击 `删除`。
4. 在 Prism 弹出的系统确认框中点击 `移到废纸篓`。

结果：

- Prism 文件树刷新后只剩 `keep.md`。
- Prism toast 显示 `已移到系统废纸篓`。
- 原路径 `C:\Users\alex\Documents\PrismWindowsSmoke\DeleteSmoke\delete-me.md` 已不存在。
- 对照文件 `C:\Users\alex\Documents\PrismWindowsSmoke\DeleteSmoke\keep.md` 仍存在。
- Windows 回收站 Shell namespace 中找到 `delete-me.md`，原位置为 `C:\Users\alex\Documents\PrismWindowsSmoke\DeleteSmoke`，删除时间为 `2026/7/9 0:58`。

结论：`WIN-PATH-003` 从 Blocked 调整为 Pass。Prism 文件树删除默认进入 Windows 回收站，没有触发永久删除 fallback。

