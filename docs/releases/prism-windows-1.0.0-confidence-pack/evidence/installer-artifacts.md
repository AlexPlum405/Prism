# 安装器产物

## 产物清单

| 路径 | 大小 | SHA256 | 文件版本 | 产品版本 | 产品名 | 签名状态 |
|---|---:|---|---|---|---|---|
| `src-tauri/target/release/app.exe` | 31,839,232 | `BF21B29C1AD0BD2D1B36ABCF98AA978E47B1D2C315174B664E283BEC1CBA6540` | `1.0.0` | `1.0.0` | `Prism` | `NotSigned` |
| `src-tauri/target/release/bundle/nsis/Prism_1.0.0_x64-setup.exe` | 21,342,380 | `D76BA7F01D50436EB4FA1B7A2D1E1D81CE4605CC1D12C06F4308E53524016E20` | `1.0.0` | `1.0.0` | `Prism` | `NotSigned` |
| `src-tauri/target/release/bundle/msi/Prism_1.0.0_x64_en-US.msi` | 23,453,696 | `D1B23C336F716FB9D220E52841D98D9A7E9A0AF484048AEDFB5E074A5EB5E5F6` | `-` | `-` | `-` | `NotSigned` |

## Updater 签名产物

| 路径 | 大小 | SHA256 |
|---|---:|---|
| `src-tauri/target/release/bundle/nsis/Prism_1.0.0_x64-setup.exe.sig` | 416 | `EE8070FD9A3F6A4EAA0F097298F0FCC4DEB92B18DDA1F76B4D7D864192A662D0` |
| `src-tauri/target/release/bundle/msi/Prism_1.0.0_x64_en-US.msi.sig` | 416 | `C093F99D46F36A52B2C8E1B9EEB59F5EFB787507C3BD6276F452888DDBC39BBB` |
| `src-tauri/target/release/bundle/nsis/latest.json` | 725 | `7D0D7BD43FAA7178AFB0994F582E528ED765B5000843358FAFAF7DECAF076FE4` |

## 安装落点

| 路径 | 大小 | SHA256 | 文件版本 | 产品版本 | 产品名 | 签名状态 |
|---|---:|---|---|---|---|---|
| `C:\Users\alex\AppData\Local\Prism\app.exe` | 31,839,232 | `114A085E1640B6411EFE5FB969AEBE3626A87360DFEAEED1FAEB0F883018DFE5` | `1.0.0` | `1.0.0` | `Prism` | `NotSigned` |

## 安装方式验证

- NSIS 静默安装：通过。
- MSI 管理员静默安装：通过；非管理员 `/qn` 静默安装因 per-machine 权限限制失败，见 `install-smoke.md`。
- 修复分支 NSIS 覆盖安装：通过，返回 `0`；用于 `WIN-WRITE-004` 安装版快捷键复测。
- updater key rotation 后的 NSIS / MSI 产物已完成打包和 `.sig` / `latest.json` 生成；本机已用新 NSIS 手动覆盖安装一次，返回 `0`，安装版内嵌新 public key id `4D7CCC88FB14D827`。
