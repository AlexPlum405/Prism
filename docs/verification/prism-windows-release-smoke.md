# Prism Windows Release Smoke 验证

> 日期：2026-05-15
> 目标：把 Windows 发布链路从旧版人工清单升级为 Prism v1.4.0 的 release 阻塞项与验收协议。
> 计划来源：`docs/archive/dirty-data-2026-05-30/historical-docs/prism-product-optimization-plan.md` 第 2 节“产品信任与发布治理”和第 12 节“质量体系”。
> 当前状态：当前机器是 macOS，未生成 Windows 安装器、updater 签名产物或 Windows `latest.json` 平台条目；Windows Stable 发布仍为阻塞。

## 1. 阻塞定义

以下任一项未完成时，不能把 Windows 版本标为 Stable：

- 未在 Windows x64 机器或可信 Windows CI 上执行 `npm test -- --run`。
- 未在 Windows 上执行 `npm run build`。
- 未在 Windows 上执行带 Tauri updater 私钥的 `npm run tauri:build`。
- 未生成 Windows 安装器或明确标注的绿色版。
- 未生成并校验 Windows updater `.sig` 产物。
- 未把 Windows 平台条目写入发布用 `latest.json`，或条目 URL / signature 未指向真实 release asset。
- 未完成文件关联、路径、导出和更新检查 smoke。

## 2. Windows 构建命令

PowerShell：

```powershell
npm ci
npm test -- --run
npm run build
$env:TAURI_SIGNING_PRIVATE_KEY="$HOME\.tauri\prism-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri:build
```

如果在 CI 中使用 updater 私钥内容而不是路径，必须通过 secret 注入，不要写入仓库。

## 3. 产物检查

根据 Tauri Windows bundler 实际产物类型检查其一或全部：

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

必须确认：

- 安装器文件存在，版本号为 `1.4.0`。
- 对应 updater `.sig` 文件存在且非空。
- release asset 命名与 README / release note 一致。
- `latest.json` 的 Windows 平台 key 与 Tauri updater 期望一致，URL 指向 GitHub Release 的真实 Windows updater asset。
- 如果只发布绿色版，README 和 release note 必须明确“无安装器 / 无 updater 支持”。

## 4. 安装与启动 Smoke

- 全新安装可启动。
- 覆盖安装不会清空用户设置。
- 卸载后不会删除用户工作区文档。
- 开始菜单启动 Prism 正常。
- 最小化、最大化、关闭窗口符合 Windows 预期。
- 多窗口打开不变成标签页，仍保持单文档单窗口定位。

## 5. 文件关联与路径 Smoke

- 双击 `.md` / `.markdown` 文件可交给 Prism 打开。
- 系统“打开方式”选择 Prism 后可正确加载文件。
- 从命令行携带文件路径启动时，当前文档和工作区根目录正确。
- `复制路径` 保留 Windows 反斜杠路径，不被错误改写。
- “在资源管理器中显示”能定位文件或打开文件夹。
- 文件树删除默认进入 Windows 回收站；如果失败，必须二次确认永久删除。

## 6. 核心写作与导出 Smoke

- `Ctrl+N`、`Ctrl+O`、`Ctrl+S`、`Ctrl+F`、`Ctrl+B`、`Ctrl+I` 可用。
- `F8` 专注模式、`F9` 打字机模式、`F11` 全屏可用。
- 图片粘贴和拖拽写入当前文档旁 `assets/`。
- HTML / PDF / PNG / DOCX 四种导出可写入 Windows 用户目录。
- 复杂文档导出包含中文、表格、代码块、Mermaid、KaTeX、图片。

## 7. Updater Smoke

- 发布用 `latest.json` 可通过浏览器访问。
- 应用内“帮助 -> 检查更新”不会报网络或签名错误。
- 当 latest release 版本高于本地版本时，能识别更新。
- 当 latest release 没有 Windows 平台条目时，release note 必须明确 Windows 不支持应用内更新。

## 8. 本轮记录

2026-05-15：

- 当前环境：macOS，本机不能真实生成或安装 Windows 产物。
- 已确认 `docs/prism-updater-manifest.example.json` 只有示例性质，不能作为 Windows updater 已验证证据。
- 已确认旧文档 `docs/archive/dirty-data-2026-05-30/historical-docs/prism-1.0.3-windows-smoke-checklist.md` 只适合作为历史参考，不代表 v1.4.0 release 已通过。
- Windows release / updater 仍为阻塞项，应在 GitHub Release 前由 Windows 机器或 CI 执行本文档。

待真实 smoke 完成后，在此追加：

```text
日期：
Windows 版本：
构建方式：
安装器产物：
updater .sig：
latest.json Windows 条目：
安装 / 覆盖安装 / 卸载：
文件关联：
路径与资源管理器：
写作与导出：
检查更新：
结论：
```
