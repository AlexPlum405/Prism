# 安装器产物

## 产物清单

| 路径 | 大小 | SHA256 | 文件版本 | 产品版本 | 产品名 | 签名状态 |
|---|---:|---|---|---|---|---|
| `src-tauri/target/release/app.exe` | 31,851,008 | `975842CFA0917AC5C98932614752F16E06D2F33FE5503C5C4F31BE3BB956A396` | `1.0.0` | `1.0.0` | `Prism` | `NotSigned` |
| `src-tauri/target/release/bundle/nsis/Prism_1.0.0_x64-setup.exe` | 21,345,591 | `53E46E5A1FC2182F2C8ABD84BDA27A514262150808B56501087504B2B8BA4C19` | `1.0.0` | `1.0.0` | `Prism` | `NotSigned` |
| `src-tauri/target/release/bundle/msi/Prism_1.0.0_x64_en-US.msi` | 23,453,696 | `82CBA51BA38A0988926D3CC1150EE45B7F376324AFF3272C7A9B1D68158C0556` | `-` | `-` | `-` | `NotSigned` |

## 安装落点

| 路径 | 大小 | SHA256 | 文件版本 | 产品版本 | 产品名 | 签名状态 |
|---|---:|---|---|---|---|---|
| `C:\Users\alex\AppData\Local\Prism\app.exe` | 31,851,008 | `89FC627C51D582CAE7C749EA028EC6632E5B26ED5570260D7737D84667E33709` | `1.0.0` | `1.0.0` | `Prism` | `NotSigned` |

## 安装方式验证

- NSIS 静默安装：通过。
- MSI 静默安装：失败，见 `install-smoke.md`。
