# 文件关联 Smoke

## `.md`

命令：`Start-Process -FilePath C:\Users\alex\AppData\Local\Prism\app.exe -ArgumentList <windows-smoke.md>`

结果：

- 打开了新的 Prism 窗口。
- 文档标题是 `windows-smoke`。
- 预览区能渲染 Markdown 内容。

默认 shell open 补验：

```text
Start-Process -FilePath C:\Users\alex\Documents\PrismWindowsSmoke\Examples\windows-smoke.md
```

结果：在没有旧 Prism 测试窗口的情况下，Windows 默认文件关联启动了 `app` 进程，主窗口标题为 `Prism`。

## `.txt`

命令：`Start-Process -FilePath C:\Users\alex\AppData\Local\Prism\app.exe -ArgumentList <plain.txt>`

结果：

- 打开了新的 Prism 窗口。
- 状态栏显示 `文本文件`。
- 正文显示 `plain text smoke`。

## `.json`

命令：`Start-Process -FilePath C:\Users\alex\AppData\Local\Prism\app.exe -ArgumentList <data.json>`

结果：

- 打开了新的 Prism 窗口。
- 状态栏显示 `文本文件`。
- 正文显示 `{\"name\":\"Prism\",\"kind\":\"smoke\"}`。

## `.markdown`

命令：`Start-Process -FilePath C:\Users\alex\AppData\Local\Prism\app.exe -ArgumentList <windows-smoke.markdown>`

结果：

- 打开了 Prism 窗口。
- 正文显示 `# Markdown Extension Smoke`。
- 状态栏显示 `Markdown 文稿`。
- 预览 / 排版入口可见。

## `.sql`

命令：`Start-Process -FilePath C:\Users\alex\AppData\Local\Prism\app.exe -ArgumentList <query.sql>`

结果：

- 打开了 Prism 窗口。
- 正文显示 `select 'Prism smoke' as name;`。
- 状态栏显示 `文本文件`。
- Markdown 预览 / 排版入口未显示。

## 多窗口文件打开

步骤：

1. 打开 `query.sql`。
2. 保持该窗口打开，再启动安装版 `app.exe <windows-smoke.md>`。

结果：

- Windows 上出现 2 个 Prism 窗口。
- 原窗口保持 `query.sql` 文本文件。
- 新窗口打开 `windows-smoke.md` Markdown 文稿。
- 没有变成标签页，也没有错误跳回旧文件。

## Explorer 图标与打开方式

`screenshots/04-file-association-explorer.png` 显示 Windows 文件资源管理器中的 `复杂 路径 (测试).md`，文件图标显示为 Prism 文档图标，不是空白图标。

## 当前注册表关联

查询 `HKCU:\Software\Classes` 当前默认 ProgId：

| 扩展名 | 默认 ProgId |
|---|---|
| `.md` | `Prism Markdown Document` |
| `.markdown` | `Prism Markdown Document` |
| `.txt` | `Prism Text Document` |
| `.json` | `Prism Text Document` |
| `.sql` | `Prism Text Document` |

说明：`OpenWithProgids` 中仍可存在其它编辑器，这是 Windows 打开方式列表的正常表现；本轮只把当前默认 ProgId 作为通过依据。

当前 `OpenWithProgids` 中仍能看到 Typora、Antigravity、Trae CN、Qoder 等其它编辑器条目；这表示它们可出现在“打开方式”候选列表中，不表示默认打开方式被覆盖。

## 路径语义

导出对话框里能看到当前源文件路径，内部字符串是：

```text
\\?\C:\Users\alex\Documents\PrismWindowsSmoke\Examples\windows-smoke.md
```

这说明 Prism 在 Windows 上没有把路径改写成 Unix 风格。

更多路径动作见 [path-actions.md](./path-actions.md)。
