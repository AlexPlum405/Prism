# 安装器产物

## 产物清单

| 路径 | 大小 | SHA256 | 文件版本 | 产品版本 | 产品名 | 签名状态 |
|---|---:|---|---|---|---|---|
| `src-tauri/target/release/app.exe` | 31,839,232 | `17D9233D5A08E10BC63D88A7296A478AB19A888399D836D963B6563E283033DB` | `1.0.0` | `1.0.0` | `Prism` | `NotSigned` |
| `src-tauri/target/release/bundle/nsis/Prism_1.0.0_x64-setup.exe` | 21,341,955 | `F3A1000B2EBFD3F6DF8BB6B53941CBE1B2C7210CB28228549427698EBB806FA9` | `1.0.0` | `1.0.0` | `Prism` | `NotSigned` |
| `src-tauri/target/release/bundle/msi/Prism_1.0.0_x64_en-US.msi` | 23,453,696 | `7921064DE709DAB6167D319C45C1A79457823DDF4F8BC0A7BEA709D85F49F31D` | `-` | `-` | `-` | `NotSigned` |

## 安装落点

| 路径 | 大小 | SHA256 | 文件版本 | 产品版本 | 产品名 | 签名状态 |
|---|---:|---|---|---|---|---|
| `C:\Users\alex\AppData\Local\Prism\app.exe` | 31,839,232 | `A4D5220F5AC8026FD4B65BA0CD11D19360B54180BCD39F93B105E418021062E0` | `1.0.0` | `1.0.0` | `Prism` | `NotSigned` |

## 安装方式验证

- NSIS 静默安装：通过。
- MSI 静默安装：失败，见 `install-smoke.md`。
- 修复分支 NSIS 覆盖安装：通过，返回 `0`；用于 `WIN-WRITE-004` 安装版快捷键复测。
