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

updater 正式发布产物仍是明确阻塞项，不是“看起来差不多”的状态。

本轮已经用 validation key 验证 Windows updater 工具链可用；正式发布仍需要当前 `src-tauri/tauri.conf.json` 内嵌 public key 对应的私钥，或者明确做 updater key rotation。

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

结论：技术链路已跑通；正式发布闭环仍取决于当前内嵌 public key 对应的私钥。GitHub `v1.0.0` macOS release 目前只有 DMG，没有 `latest.json` / `.sig`。如果找不回旧私钥，需要显式决定是否旋转 updater key，并接受旧安装版不能自动更新到新 key 签名版本的后果。

## 正式私钥查找

2026-07-08 追加查找：

- `C:\Users\alex\.tauri` 只存在 `prism-updater-validation.key` 和 `.pub`，没有 `prism-updater.key`。
- 当前 shell 环境没有 `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PATH`。
- GitHub Actions secrets 列表没有返回 updater signing secret。
- `git log --all -S"DDA9E1E9A224F4B0"` 和 `git log --all -S"trusted comment: tauri secret"` 没有命中。
- 用户目录按文件名搜索 `prism-updater.key`、`*updater*.key`、`*updater*.key.pub` 只命中 validation key。

结论：当前机器和仓库可见配置中没有正式 updater 私钥。`WIN-UPDATER-001` 继续保持 Blocked，下一步只能由维护者提供旧私钥，或明确做 updater key rotation。

## 应用内检查更新

步骤：

1. 打开 Prism `帮助` 菜单。
2. 点击 `检查更新...`。
3. 等待最终提示。

结果：

- Prism 没有一直 loading。
- 窗口底部出现提示：`检查更新暂不可用：当前发布通道暂未提供可用的更新清...`
- 截图：`screenshots/14-update-unavailable.png`，Prism 窗口级截图，尺寸 1102x792。

结论：应用内检查更新 UI 有最终态，但 updater 签名和 Windows release manifest 仍未闭环。
