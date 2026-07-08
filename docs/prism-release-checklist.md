# Prism 发布检查清单

> 目标：每次发布前确认版本、许可证、构建产物、README 和问题反馈入口都可信。

## 1. 版本与许可证

- `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` 的 Prism 应用版本一致。
- `LICENSE`、`package.json`、`package-lock.json`、`src-tauri/Cargo.toml` 的项目许可证一致。
- README 中的当前源码版本与 manifest 版本一致。
- README 下载区只指向 GitHub latest release，不硬编码已过期资产名。

## 2. 本地验证

发布前必须运行：

```bash
npm test
npm run build
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$HOME/.tauri/prism-updater.key")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri:build
npm run release:manifest
npm run release:manifest:check
```

如果 `npm run tauri:build` 因平台签名、证书或系统依赖失败，发布说明必须记录失败原因和替代验证结果。

本地运行时 smoke 可使用不生成 updater artifacts 的 App-only 构建，避免把 UI 验证阻塞在 updater 私钥或 DMG Finder 自动化上：

```bash
npm run tauri:build:app-smoke
```

该命令只用于本机打开 `.app` 做功能验证，不替代正式发布构建。正式 release 仍必须使用带 updater 私钥的 `npm run tauri:build`，并检查 `.app.tar.gz` / `.sig` / `latest.json`。

macOS 本机若 DMG 阶段失败于 Finder AppleScript 超时 `(-1712)`，先不要改运行时代码；这是 create-dmg 布局脚本与 Finder 自动化的打包环境问题。可用以下 fallback 产出一个无自定义图标布局的 DMG：

```bash
npm run tauri -- build --bundles app
npm run release:mac-dmg:skip-finder
hdiutil verify src-tauri/target/release/bundle/macos/Prism_1.4.0_aarch64.dmg
```

该 fallback 只跳过 DMG 美化布局，不替代签名、公证和 updater 资产检查。

## 3. 产物检查

- macOS 稳定版目标是签名和公证后的 DMG / app bundle。
- Windows 稳定版至少提供安装包；如提供绿色版，必须明确标注。
- Windows 发布必须执行 `docs/verification/prism-windows-release-smoke.md`。当前 macOS 本机结果不能替代 Windows 安装器、文件关联、回收站、导出路径和 updater smoke。
- Tauri updater 的 `latest.json` 必须上传到 GitHub Release，路径与 `src-tauri/tauri.conf.json` 中的 updater endpoint 一致。
- `src-tauri/tauri.conf.json` 必须开启 `bundle.createUpdaterArtifacts`，发布构建后检查 `.app.tar.gz` / `.sig`、Windows 安装器 `.sig` 等 updater 产物存在。
- macOS `latest.json` 使用 `npm run release:manifest` 从 `Prism.app.tar.gz.sig` 生成，使用 `npm run release:manifest:check` 校验，不手工复制 signature。
- manifest 脚本必须保留测试覆盖：生成结果要包含当前版本、GitHub Release URL、`.sig` 内容；当 `.sig` 变更后，`--check` 必须失败。
- updater 签名私钥只保存在本地或 CI secret；本机文件路径是 `~/.tauri/prism-updater.key`，但发布构建时 `TAURI_SIGNING_PRIVATE_KEY` 必须注入私钥文件内容，不要只填路径。当前本机 key 无密码时，非交互构建也要显式设置 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""`。
- 2026-07-09 已执行 updater key rotation，新 public key id 为 `4D7CCC88FB14D827`，public key 写入 `src-tauri/tauri.conf.json`。私钥不得提交到仓库；仓库 `.gitignore` 已忽略 `*.key` / `*.pem` / `*.p12` / `*.pfx`。
- key rotation 后，旧 public key 安装版不能自动接受新 key 签名更新；release note 必须明确旧安装版用户需要手动安装一次新版本。
- macOS Stable 的签名、公证和 updater 资产流程见 `docs/prism-macos-release.md`；未完成签名/公证时不能把产物标为 Stable。
- 文件系统权限边界见 `docs/prism-filesystem-permissions.md`；发布前确认 `src-tauri/capabilities/` 中没有静态 `**` 全盘 scope。
- `latest.json` 至少包含 `version`、`notes`、`pub_date`、`platforms`，平台条目必须包含对应资产 `url` 和 `signature`。
- release note 写明新增能力、修复项、已知问题和升级风险。
- release asset 命名与 release note 中的下载说明一致。
- 若 Windows 安装器、Windows updater `.sig` 或 `latest.json` Windows 平台条目缺失，release note 必须明确 Windows 不支持 Stable 安装器或应用内更新，README 不得把 Windows 标为已验证 Stable。

## 4. README 与反馈入口

- README 和 README.zh-CN 的下载说明都指向 latest release。
- bug issue 模板要求版本、系统、区域、视图模式、主题和最小复现。
- export issue 模板要求源 Markdown、导出格式、导出设置、实际结果和期望结果。
- 若发布包含视觉改动，附带截图或短视频更新。

## 5. 发布后确认

- GitHub latest release 页面可打开。
- 应用内“帮助 -> 检查更新”能完成检查；若 latest release 暂无 `latest.json`，release note 必须明确该版本不支持应用内更新。
- README badge 显示的最新版本正确。
- 新建 issue 时能看到 Bug report、Export bug、Feature request 三类模板。
