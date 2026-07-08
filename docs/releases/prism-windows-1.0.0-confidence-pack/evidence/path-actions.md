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

状态：Blocked。

原因：该项需要通过 Prism UI 删除本地文件 `DeleteSmoke\delete-me.md`。这属于通过应用界面删除本地数据，必须在动作发生前由用户明确确认。

未执行前，测试文件仍存在：

```text
C:\Users\alex\Documents\PrismWindowsSmoke\DeleteSmoke\delete-me.md
```

