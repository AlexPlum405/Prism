# Updater 结论

## 原始构建结果

`npm run tauri:build -- --verbose` 已经生成了 Windows bundle，但在 updater 签名阶段停住了。

## 原始阻塞原因

本机没有可用的 `TAURI_SIGNING_PRIVATE_KEY`。

结果是：

- 没有 Windows updater `.sig`
- 没有可验证的 Windows `latest.json` 平台条目
- 应用内检查更新不能进入稳定结论

## 现阶段结论

updater 工具链已经闭环到新的正式 key。

本轮先用 validation key 验证 Windows updater 工具链可用，随后按维护者决策执行 updater key rotation：

- 生成新正式 key：`C:\Users\alex\.tauri\prism-updater.key` 和 `.pub`。
- 私钥只保存在本机，不进入仓库；仓库通过 `.gitignore` 忽略 `*.key` / `*.pem` / `*.p12` / `*.pfx`。
- `src-tauri/tauri.conf.json` 已更新为新正式 public key。
- 使用新正式 key 执行 `npm run tauri:build -- --bundles nsis,msi` 通过。
- NSIS / MSI updater `.sig` 已生成，`windows-x86_64 latest.json` 已生成并通过 `release:manifest:check`。
- 本机已手动安装一次新 key 版本；安装落点 `app.exe` 能搜到新 public key，搜不到旧 public key。

兼容性限制：旧 `v1.0.0` 安装版内嵌旧 public key，无法自动接受新 key 签名的更新。用户需要手动安装一次内嵌新 public key 的版本；之后 updater 才能继续使用新 key。

## 正式 key rotation 验证

新 public key 文件：

- 本机：`C:\Users\alex\.tauri\prism-updater.key.pub`
- 仓库证据：`artifacts/updater/official-public-key.pub`
- public key id：`4D7CCC88FB14D827`

私钥文件：

- 本机：`C:\Users\alex\.tauri\prism-updater.key`
- 仓库：不保存私钥内容。

构建命令：

```powershell
$key = Join-Path $HOME '.tauri\prism-updater.key'
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw -LiteralPath $key
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
$env:CI = 'true'
npm run tauri:build -- --bundles nsis,msi
```

构建结果：

```text
Finished 2 updater signatures at:
  src-tauri/target/release/bundle/nsis/Prism_1.0.0_x64-setup.exe.sig
  src-tauri/target/release/bundle/msi/Prism_1.0.0_x64_en-US.msi.sig
```

Windows manifest：

```powershell
npm run release:manifest -- --platform windows-x86_64 --asset Prism_1.0.0_x64-setup.exe --bundle-dir src-tauri/target/release/bundle/nsis --output src-tauri/target/release/bundle/nsis/latest.json --notes "Prism 1.0.0 Windows updater official key rotation"
npm run release:manifest:check -- --platform windows-x86_64 --asset Prism_1.0.0_x64-setup.exe --bundle-dir src-tauri/target/release/bundle/nsis --output src-tauri/target/release/bundle/nsis/latest.json
```

结果：

```text
Wrote C:\AI\Dev\Prism\src-tauri\target\release\bundle\nsis\latest.json
OK: C:\AI\Dev\Prism\src-tauri\target\release\bundle\nsis\latest.json
```

证据产物：

- `artifacts/updater/official-public-key.pub`
- `artifacts/updater/official-nsis-setup.exe.sig`
- `artifacts/updater/official-msi.msi.sig`
- `artifacts/updater/official-windows-latest.json`

SHA256：

```text
NSIS setup.exe  D76BA7F01D50436EB4FA1B7A2D1E1D81CE4605CC1D12C06F4308E53524016E20
MSI             D1B23C336F716FB9D220E52841D98D9A7E9A0AF484048AEDFB5E074A5EB5E5F6
NSIS .sig       EE8070FD9A3F6A4EAA0F097298F0FCC4DEB92B18DDA1F76B4D7D864192A662D0
MSI .sig        C093F99D46F36A52B2C8E1B9EEB59F5EFB787507C3BD6276F452888DDBC39BBB
latest.json     7D0D7BD43FAA7178AFB0994F582E528ED765B5000843358FAFAF7DECAF076FE4
```

本机手动安装一次新 key 版本：

```powershell
src-tauri\target\release\bundle\nsis\Prism_1.0.0_x64-setup.exe /S
```

结果：

```text
ExitCode             0
Installed app.exe    114A085E1640B6411EFE5FB969AEBE3626A87360DFEAEED1FAEB0F883018DFE5
New public key        present
Old public key        absent
```

结论：`WIN-UPDATER-001` 从 Blocked 调整为 Pass with key rotation。发布说明必须明确旧 public key 安装版不能自动升级到新 key 版本，需要手动安装一次。

## Validation key 工具链验证

验证目的：证明 Windows bundle 在有匹配 updater 私钥和 public key 时可以生成 `.sig`，并且 `latest.json` 可以写入 `windows-x86_64` 平台条目。

私钥位置：`C:\Users\alex\.tauri\prism-updater-validation.key`

> 私钥只在本机保存，不进入仓库。仓库只保存 validation public key、签名和 manifest 作为证据。

关键发现：

- `TAURI_SIGNING_PRIVATE_KEY_PATH` 未被本轮 `tauri build` 接受，构建仍报 `A public key has been found, but no private key`。
- `TAURI_SIGNING_PRIVATE_KEY` 必须注入私钥文件内容；注入路径不够。
- `tauri signer generate --write-keys` 生成的 `.pub` 文件内容本身就是 `tauri.conf.json > plugins.updater.pubkey` 需要的 base64 字符串，不能再次 base64 包一层。

通过命令：

```powershell
$key = Join-Path $HOME '.tauri\prism-updater-validation.key'
$pubkey = (Get-Content -Raw -LiteralPath "$key.pub").Trim()
$config = '{"plugins":{"updater":{"pubkey":"' + $pubkey + '"}}}'
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw -LiteralPath $key
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
$env:CI = 'true'
npm run tauri:build -- --config $config --bundles nsis,msi
```

结果：

```text
Finished 2 updater signatures at:
  src-tauri/target/release/bundle/nsis/Prism_1.0.0_x64-setup.exe.sig
  src-tauri/target/release/bundle/msi/Prism_1.0.0_x64_en-US.msi.sig
```

Windows manifest：

```powershell
npm run release:manifest -- --platform windows-x86_64 --asset Prism_1.0.0_x64-setup.exe --bundle-dir src-tauri/target/release/bundle/nsis --output src-tauri/target/release/bundle/nsis/latest.json --notes "Prism 1.0.0 Windows updater validation"
npm run release:manifest:check -- --platform windows-x86_64 --asset Prism_1.0.0_x64-setup.exe --bundle-dir src-tauri/target/release/bundle/nsis --output src-tauri/target/release/bundle/nsis/latest.json
```

结果：

```text
Wrote C:\AI\Dev\Prism\src-tauri\target\release\bundle\nsis\latest.json
OK: C:\AI\Dev\Prism\src-tauri\target\release\bundle\nsis\latest.json
```

证据产物：

- `artifacts/updater/validation-public-key.pub`
- `artifacts/updater/validation-nsis-setup.exe.sig`
- `artifacts/updater/validation-msi.msi.sig`
- `artifacts/updater/validation-windows-latest.json`

SHA256：

```text
NSIS setup.exe  F907CCAA94AD31FB6B82FD87396D2887788855B95B05E8909C2C23EE46208A05
MSI             38E38BFB35D0911AFCA6863E1510A6D9E01B9A6410FAC4031547C30C6B74295A
NSIS .sig       712E303F11C690AD0D979213B94D6B45C09E72ADE859250CE4CC2B70707CA8FF
MSI .sig        8EE18536245107877AC92E239FF267C93EBB8A72A458C1A364F934D321C40D4E
latest.json     58C21E5FFE0B48BD45BFF48FCAE99709CE4B073510352D375F1BB9EB1F8EB6F9
```

结论：validation key 技术链路已跑通。正式发布现已改走新 key rotation，见上方“正式 key rotation 验证”。

## 正式私钥查找

2026-07-08 追加查找：

- `C:\Users\alex\.tauri` 只存在 `prism-updater-validation.key` 和 `.pub`，没有 `prism-updater.key`。
- 当前 shell 环境没有 `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PATH`。
- GitHub Actions secrets 列表没有返回 updater signing secret。
- `git log --all -S"DDA9E1E9A224F4B0"` 和 `git log --all -S"trusted comment: tauri secret"` 没有命中。
- 用户目录按文件名搜索 `prism-updater.key`、`*updater*.key`、`*updater*.key.pub` 只命中 validation key。

结论：当前机器和仓库可见配置中没有旧 public key 对应的正式 updater 私钥。2026-07-09 已明确做 updater key rotation，因此 `WIN-UPDATER-001` 不再因缺旧私钥阻塞；剩余风险是旧安装版需要手动升级到新 key 版本。

## 应用内检查更新

步骤：

1. 打开 Prism `帮助` 菜单。
2. 点击 `检查更新...`。
3. 等待最终提示。

结果：

- Prism 没有一直 loading。
- 窗口底部出现提示：`检查更新暂不可用：当前发布通道暂未提供可用的更新清...`
- 截图：`screenshots/14-update-unavailable.png`，Prism 窗口级截图，尺寸 1102x792。

结论：应用内检查更新 UI 有最终态；updater 签名和 Windows release manifest 已通过新 key rotation 闭环。
