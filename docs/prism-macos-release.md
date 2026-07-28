# Prism macOS 签名、公证与 updater 发布流程

> 目标：把 macOS 稳定版从“本机可打包”推进到“可被用户信任下载、可被应用内更新识别”的发布链路。
>
> 参考：Tauri v2 官方文档
> - macOS Code Signing: https://v2.tauri.app/distribute/sign/macos/
> - Updater: https://v2.tauri.app/plugin/updater/

## 1. 发布分级

Prism 的 macOS 产物按可信度分三类：

| 类型 | 用途 | 要求 |
| --- | --- | --- |
| Dev build | 本机测试、内部验证 | 可未签名，不上传 stable release |
| Nightly / Preview | 早期用户试用 | 至少说明签名状态和 Gatekeeper 风险 |
| Stable | 正式用户下载 | 必须签名、公证，并提供 updater 产物和签名 |

正式 README 与 release note 只能把 Stable 作为推荐下载。未签名构建只能作为开发说明或临时 fallback。

## 2. updater 签名密钥

Prism updater 使用 Tauri updater 自己的 Ed25519 签名密钥，和 Apple 代码签名证书不是同一套东西。

本机当前路径：

```bash
~/.tauri/prism-updater.key
~/.tauri/prism-updater.key.pub
```

2026-07-09 已执行 updater key rotation，新 public key id 为 `4D7CCC88FB14D827`。`src-tauri/tauri.conf.json` 保存 public key；private key 只保存在本机或 CI secret，不进入仓库。

兼容性说明：旧 public key 安装版不能自动接受新 key 签名更新，需要用户手动安装一次内嵌新 public key 的版本。

发布构建前必须设置：

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$HOME/.tauri/prism-updater.key")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
```

`src-tauri/tauri.conf.json` 中必须满足：

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "<public key content>",
      "endpoints": [
        "https://github.com/AlexPlum405/Prism/releases/latest/download/latest.json"
      ]
    }
  }
}
```

验收：

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$HOME/.tauri/prism-updater.key")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri:build
test -f src-tauri/target/release/bundle/macos/Prism.app.tar.gz
test -f src-tauri/target/release/bundle/macos/Prism.app.tar.gz.sig
```

## 3. Apple 代码签名

Stable 版需要 Apple Developer 账号和 Developer ID Application 证书。Tauri 支持两种输入方式：

### 本机钥匙串

适合在维护者 Mac 上发布：

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: <Name> (<Team ID>)"
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$HOME/.tauri/prism-updater.key")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri:build
```

也可以把签名身份写入 `src-tauri/tauri.conf.json > bundle > macOS > signingIdentity`，但 Prism 先不把个人证书名固化到仓库，避免污染开源配置。

### CI 证书导入

适合 GitHub Actions：

```bash
export APPLE_CERTIFICATE="<base64 encoded .p12>"
export APPLE_CERTIFICATE_PASSWORD="<p12 export password>"
export APPLE_SIGNING_IDENTITY="Developer ID Application: <Name> (<Team ID>)"
export TAURI_SIGNING_PRIVATE_KEY="<updater private key content>"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<updater key password or empty string>"
npm run tauri:build
```

CI secret 必须至少包含：

| Secret | 说明 |
| --- | --- |
| `APPLE_CERTIFICATE` | `.p12` 证书的 base64 内容 |
| `APPLE_CERTIFICATE_PASSWORD` | 导出 `.p12` 时设置的密码 |
| `APPLE_SIGNING_IDENTITY` | Developer ID Application 证书名称 |
| `TAURI_SIGNING_PRIVATE_KEY` | updater 私钥内容；不要只填文件路径 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | updater 私钥密码；无密码时为空字符串 |

## 4. Apple 公证

使用 Developer ID Application 证书发布时，Tauri 官方要求走 Apple 公证。推荐 App Store Connect API，避免在 CI 中长期保存 Apple ID 密码。

### App Store Connect API

```bash
export APPLE_API_ISSUER="<issuer id>"
export APPLE_API_KEY="<key id>"
export APPLE_API_KEY_PATH="/secure/path/AuthKey_<key id>.p8"
```

### Apple ID 方式

```bash
export APPLE_ID="<apple id email>"
export APPLE_PASSWORD="<app-specific password>"
export APPLE_TEAM_ID="<team id>"
```

验收：

```bash
spctl --assess --type execute --verbose src-tauri/target/release/bundle/macos/Prism.app
codesign --verify --deep --strict --verbose=2 src-tauri/target/release/bundle/macos/Prism.app
```

如果 `spctl` 显示被拒绝，不能发布为 Stable，只能发布为 Preview 并在 release note 中明确签名/公证状态。

## 5. GitHub Release 资产

macOS Apple Silicon stable release 至少上传：

```text
Prism_1.4.0_aarch64.dmg
Prism.app.tar.gz
Prism.app.tar.gz.sig
latest.json
```

`latest.json` 中 macOS 平台条目必须引用 `.app.tar.gz`，signature 字段填入 `.sig` 文件内容，而不是 DMG。

本地生成并校验：

```bash
npm run release:manifest
npm run release:manifest:check
```

默认输出：

```text
src-tauri/target/release/bundle/macos/latest.json
```

最小结构：

```json
{
  "version": "1.4.0",
  "notes": "Release notes go here.",
  "pub_date": "2026-05-14T00:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<content of Prism.app.tar.gz.sig>",
      "url": "https://github.com/AlexPlum405/Prism/releases/download/v1.4.0/Prism.app.tar.gz"
    }
  }
}
```

## 6. 发布前检查

```bash
npm test -- --run
npm run build
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$HOME/.tauri/prism-updater.key")"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri:build
npm run release:manifest
npm run release:manifest:check
git diff --check
```

`npm run tauri:build` 不再产出 DMG：bundle targets 已改为 app-only（macOS），因为 create-dmg 的 Finder 美化 AppleScript 会抢占全局键盘鼠标输入焦点，且此前多次出现超时 `(-1712)`。DMG 统一使用无 Finder 自动化的路径产出：

```bash
npm run tauri -- build --bundles app
npm run release:mac-dmg:skip-finder
hdiutil verify src-tauri/target/release/bundle/macos/Prism_1.4.0_aarch64.dmg
```

此路径使用 Tauri 生成的 `bundle_dmg.sh --skip-jenkins`，会跳过 Finder 中的图标定位 / 美化 AppleScript，因此 DMG 视觉布局不作为验收项；签名、公证、updater `.sig` 与 `latest.json` 仍按上文要求执行。

发布前人工确认：

- README 和 README.zh-CN 下载区指向 latest release。
- release note 明确签名、公证、updater 支持状态。
- `Prism.app.tar.gz.sig` 存在且已写入 `latest.json`。
- 应用内“帮助 -> 检查更新”能访问 latest release 的 `latest.json`。
- 未签名或未公证产物不标注为 Stable。
