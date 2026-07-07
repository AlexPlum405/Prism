# Prism Windows 1.0.0 发布信心验证计划

> 状态：待 Windows 真机执行
> 日期：2026-07-07
> 目标：用真实 Windows 设备补齐 Prism 1.0.0 staged 平台发布证据，不用推测、不用 macOS 模拟截图替代。

## 0. 版本口径

默认验证对象是当前公开 macOS 1.0.0 对应的代码口径：

```text
tag=v1.0.0
target=e03f199e6f3bcd256bc9cc83c356302e69239d31
```

如果 Windows 包需要包含 `v1.0.0` 之后的新提交，例如 `912c9fb5 支持编辑预览滚轮调整字号`，则必须先确认版本策略：重打 `v1.0.0`、发布 `v1.0.1`，或只做未发布候选包。不要把不同 commit 的验证证据混写成同一个 1.0.0 结论。

## 1. 验证产物目录

Windows 设备上执行时，把所有证据写到：

```text
docs/releases/prism-windows-1.0.0-confidence-pack/
```

建议结构：

```text
docs/releases/prism-windows-1.0.0-confidence-pack/
  README.md
  manifest.json
  issues.md
  evidence/
    environment.md
    build-and-test.md
    installer-artifacts.md
    install-smoke.md
    file-association.md
    writing-preview.md
    export.md
    updater.md
    performance.md
  screenshots/
    01-first-launch.png
    02-open-md-file.png
    03-titlebar-window-controls.png
    04-file-association-explorer.png
    05-split-preview.png
    06-theme-miaoyan.png
    07-theme-nocturne-dark.png
    08-diagrams-formulas.png
    09-export-dialog.png
    10-export-results.png
```

`manifest.json` 必须逐项记录：`id`、`priority`、`domain`、`status`、`steps`、`expected`、`actual`、`evidence`、`issue`。截图文件名必须和测试项对应。

## 2. Windows 设备准备

最低环境：

- Windows 11 x64；Windows 10 x64 可作为补充，不替代 Windows 11 主验收。
- Git for Windows。
- Node.js 18+，建议 LTS。
- Rust stable：`rustup` + MSVC toolchain。
- Microsoft Visual Studio Build Tools，包含 `Desktop development with C++` 和 Windows SDK。
- WebView2 Runtime。
- PowerShell 7 优先；系统 Windows PowerShell 可作为兜底。

环境记录命令：

```powershell
$PSVersionTable
Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, OsBuildNumber, OsArchitecture
git --version
node --version
npm --version
rustc --version
cargo --version
```

写入：`evidence/environment.md`。

## 3. Codex 自动执行 Prompt

在 Windows 设备的新 Codex 会话中使用：

```text
你在 Windows 真机上验证 Prism Windows 1.0.0 发布信心包。

仓库：AlexPlum405/Prism
验证默认 commit：e03f199e6f3bcd256bc9cc83c356302e69239d31
证据目录：docs/releases/prism-windows-1.0.0-confidence-pack/

要求：
1. 全程只记录真实 Windows 设备结果，不用推测、不借用 macOS/Linux 证据。
2. 自动执行能自动化的命令、构建、文件检查、导出检查和截图采集。
3. 每个测试项写入 manifest.json，并把失败或体验问题写入 issues.md。
4. 截图按测试功能命名，保存到 screenshots/。
5. 如果需要人工点击系统弹窗、默认应用设置、安装器 UAC 或 Explorer 右键菜单，先写清楚需要人工做什么，再继续记录结果。
6. 不修改产品代码；本轮只做验证和证据采集。若发现阻塞问题，只记录，不修复。
7. 结束前运行 git diff --check，并汇总 Pass / Fail / Blocked / Not Run。
```

## 4. 基线拉取与安装依赖

推荐在干净目录执行：

```powershell
git clone https://github.com/AlexPlum405/Prism.git
cd Prism
git fetch --tags origin
git checkout e03f199e6f3bcd256bc9cc83c356302e69239d31
git status --short --branch
npm ci
```

若验证的是后续 Windows 候选分支，必须在 `evidence/environment.md` 顶部写明实际 branch、commit 和原因。

## 5. 自动化构建与测试门槛

P0 阻塞命令：

```powershell
npm test -- --run
npm run build
npm run tauri:build
git diff --check
```

如果 `npm run tauri:build` 因 updater 私钥缺失失败，需要区分：

- 前端 build / Rust release 编译 / Windows bundle 是否已经成功。
- 失败是否只发生在 updater 签名阶段。
- 是否生成可安装的 NSIS/MSI 产物。

证据写入：`evidence/build-and-test.md`。

## 6. 产物检查

检查路径：

```powershell
Get-ChildItem -Recurse src-tauri\target\release\bundle | Select-Object FullName, Length, LastWriteTime
Get-ChildItem src-tauri\target\release\bundle\nsis -ErrorAction SilentlyContinue
Get-ChildItem src-tauri\target\release\bundle\msi -ErrorAction SilentlyContinue
Get-ChildItem src-tauri\target\release -Filter Prism.exe -ErrorAction SilentlyContinue
```

必须记录：

- 安装器类型：NSIS、MSI、两者都有，或只有 unpacked exe。
- 文件名、大小、SHA256。
- `Prism.exe` 文件版本、产品名、签名状态。

PowerShell：

```powershell
Get-FileHash <installer-or-exe> -Algorithm SHA256
(Get-Item <path-to-Prism.exe>).VersionInfo | Format-List
Get-AuthenticodeSignature <path-to-Prism.exe> | Format-List
```

证据写入：`evidence/installer-artifacts.md`。

## 7. 安装 / 覆盖安装 / 卸载 Smoke

测试项：

| ID | 优先级 | 验收 |
|---|---|---|
| WIN-REL-001 | P0 | 安装器可正常启动并安装 Prism |
| WIN-REL-002 | P0 | 开始菜单可启动 Prism |
| WIN-REL-003 | P0 | 安装后 `Prism.exe` 版本为目标版本 |
| WIN-REL-004 | P1 | 覆盖安装不清空用户设置和最近文件 |
| WIN-REL-005 | P1 | 卸载不会删除用户工作区文档 |

人工或 Codex 操作后截图：

- 安装器首页。
- 安装完成页。
- 开始菜单 Prism。
- Prism 首次启动主窗口。

证据写入：`evidence/install-smoke.md`。

## 8. 标题栏与窗口控制

测试项：

| ID | 优先级 | 验收 |
|---|---|---|
| WIN-UI-001 | P0 | Windows 标题栏、最小化、最大化、关闭按钮可见且不遮挡内容 |
| WIN-UI-002 | P0 | 最大化 / 还原后编辑区、预览区、文件树不重叠 |
| WIN-UI-003 | P1 | 多窗口打开保持单文档单窗口，不变成标签页 |
| WIN-UI-004 | P1 | 高 DPI 缩放 125% / 150% 下文字和按钮不溢出 |

截图：

- `03-titlebar-window-controls.png`
- `03b-maximized.png`
- `03c-hidpi-150.png`

## 9. 文件关联与 Explorer 验证

准备临时工作区：

```powershell
$Root = "$env:USERPROFILE\Documents\PrismWindowsSmoke"
New-Item -ItemType Directory -Force "$Root\Examples" | Out-Null
Set-Content -Encoding UTF8 "$Root\Examples\windows-smoke.md" "# Windows Smoke`n`n- [ ] task`n`n```mermaid`ngraph TD; A-->B;`n```"
Set-Content -Encoding UTF8 "$Root\Examples\plain.txt" "plain text smoke"
Set-Content -Encoding UTF8 "$Root\Examples\data.json" "{`"name`":`"Prism`"}"
```

测试项：

| ID | 优先级 | 验收 |
|---|---|---|
| WIN-FILE-001 | P0 | 双击 `.md` 可用 Prism 打开，若默认应用未绑定则记录 Blocked: default app not set |
| WIN-FILE-002 | P0 | Explorer “打开方式”选择 Prism 后能打开目标文件 |
| WIN-FILE-003 | P0 | 一个 Prism 窗口打开文件 A，从 Explorer 打开文件 B 时打开 / 切换到文件 B，不错误跳回 A |
| WIN-FILE-004 | P1 | `.txt` 打开为文本文件模式，右上角不显示分栏 / 预览模式 |
| WIN-FILE-005 | P1 | `.json` / `.sql` 按文本文件边界处理，路径和保存正常 |
| WIN-FILE-006 | P1 | Explorer 中 Prism 文档图标显示合理，不是空白图标 |

证据写入：`evidence/file-association.md`。

## 10. 路径、删除、资源管理器动作

测试项：

| ID | 优先级 | 验收 |
|---|---|---|
| WIN-PATH-001 | P0 | 当前文件路径显示 / 复制路径保留 Windows 反斜杠或系统原生路径语义 |
| WIN-PATH-002 | P0 | “在资源管理器中显示”能定位当前文件 |
| WIN-PATH-003 | P1 | 文件树删除默认进入 Windows 回收站；失败时必须二次确认永久删除 |
| WIN-PATH-004 | P1 | 含中文、空格、括号的路径可打开、保存、导出 |

不要在真实文档目录做破坏性测试，只用 `$env:USERPROFILE\Documents\PrismWindowsSmoke`。

## 11. 写作、预览、主题与三语

测试项：

| ID | 优先级 | 验收 |
|---|---|---|
| WIN-WRITE-001 | P0 | 编辑 / 分栏 / 预览三态切换正常 |
| WIN-WRITE-002 | P0 | Markdown 预览包含标题、表格、任务列表、代码块、KaTeX、Mermaid、PlantUML、Markmap |
| WIN-WRITE-003 | P0 | 搜索 / 替换正常，预览模式触发替换时按既定逻辑处理 |
| WIN-WRITE-004 | P2 / 条件项 | 仅当验证 commit 包含 `912c9fb5` 时执行：`Ctrl` + 鼠标滚轮调整编辑 / 预览字号；输入框内不误触。若严格验证 `e03f199e`，标记 `Not Run: not in 1.0.0 target commit` |
| WIN-WRITE-005 | P1 | MiaoYan、Inkstone、Slate、Mono、Nocturne Dark 主题均可切换 |
| WIN-WRITE-006 | P1 | 中文、English、日本語切换后核心 UI 无明显溢出 |
| WIN-WRITE-007 | P1 | 知识图谱入口在 Markdown 有链接关系时可用，文本文件不显示不该出现的 Markdown 控件 |

截图：

- `05-split-preview.png`
- `06-theme-miaoyan.png`
- `07-theme-nocturne-dark.png`
- `08-diagrams-formulas.png`
- `11-locale-zh.png`
- `12-locale-en.png`
- `13-locale-ja.png`

## 12. 导出验证

使用同一个复杂 Markdown fixture，至少包含：

- 中文、英文、日文段落。
- 表格。
- 任务列表。
- Mermaid。
- PlantUML。
- Markmap。
- KaTeX。
- 本地图片。
- 长段落和长代码块。

测试项：

| ID | 优先级 | 验收 |
|---|---|---|
| WIN-EXPORT-001 | P0 | HTML 导出成功，浏览器打开后图表和公式可见 |
| WIN-EXPORT-002 | P0 | PDF 导出成功，分页不把文字横切成两半 |
| WIN-EXPORT-003 | P0 | PNG 导出成功，不因默认清晰度直接失败；如超限，错误提示必须可理解 |
| WIN-EXPORT-004 | P0 | DOCX 导出成功，可被 Word 或 WPS 打开 |
| WIN-EXPORT-005 | P1 | 导出诊断能识别坏链接 / 缺图，不阻止无错误文档导出 |
| WIN-EXPORT-006 | P1 | 导出路径含中文和空格时成功 |

导出结果保存到：

```text
docs/releases/prism-windows-1.0.0-confidence-pack/artifacts/export/
```

证据写入：`evidence/export.md`。

## 13. Updater / 检查更新

当前 macOS 1.0.0 已明确不包含自动更新签名。Windows 执行时必须真实记录：

| ID | 优先级 | 验收 |
|---|---|---|
| WIN-UPD-001 | P1 | 帮助 / 检查更新不会卡死或一直 loading |
| WIN-UPD-002 | P1 | 若 release manifest 无 Windows 条目，UI 给出合理最终态，不假装有更新 |
| WIN-UPD-003 | P2 | 若后续生成 Windows updater asset 和 `.sig`，再验证 latest.json Windows key、URL、signature |

证据写入：`evidence/updater.md`。

## 14. 性能与大工作区

用真实或复制的较大 workspace 验证，不要直接破坏用户资料。建议先复制：

```powershell
$Source = "C:\path\to\large-workspace"
$Target = "$env:TEMP\PrismLargeWorkspaceSmoke"
robocopy $Source $Target /MIR /XD node_modules .git dist target build .cache .next .venv venv
```

测试项：

| ID | 优先级 | 验收 |
|---|---|---|
| WIN-PERF-001 | P1 | 打开大工作区后文件树可交互，不出现长期卡死 |
| WIN-PERF-002 | P1 | 选择 Markdown 文件、滚动、编辑输入可用 |
| WIN-PERF-003 | P2 | 工作区索引可取消或降级，不拖垮主窗口 |
| WIN-PERF-004 | P2 | 长文档预览和导出有可接受反馈 |

证据写入：`evidence/performance.md`。

## 15. 结论门槛

Windows Stable 发布必须满足：

- P0 全 Pass。
- P1 无 Fail；确实无法自动化的项目可 Blocked，但必须说明原因和人工补验路径。
- 所有失败项写入 `issues.md`，包含触发动作、表现、预期、实际、截图或日志。
- `manifest.json` 条目数与截图 / 证据引用一致。
- Windows 产物 SHA256、版本、安装方式和下载方式明确。
- README / Release Notes 不得在 Windows 未通过前写成 “Released”。

结论格式：

```text
Windows 1.0.0 release status: Go | Conditional Go | No-Go
Commit:
Windows version:
Installer:
SHA256:
P0:
P1:
Known blockers:
Release note changes required:
```

## 16. 收尾命令

```powershell
git status --short --branch
git diff --check
```

如果只新增验证证据和计划文档，不需要跑 macOS 专属脚本。若 Windows 验证期间改到产品代码，必须重新执行：

```powershell
npm test -- --run
npm run build
npm run tauri:build
```
