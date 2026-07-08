# 环境记录

日期：2026-07-08

## 机器与系统

```text
Get-CimInstance Win32_OperatingSystem
Caption                    Version   BuildNumber OSArchitecture
-------                    -------   ----------- --------------
Microsoft Windows 11 专业版 10.0.26200 26200       64 位
```

说明：本机是 Windows 11 专业版；`10.0.26200` 是 Windows 报告的系统版本号，不表示旧版系统。

## 运行时版本

```text
PowerShell 7.6.2
git version 2.53.0.windows.3
v24.15.0
11.12.1
rustc 1.95.0 (59807616e 2026-04-14)
cargo 1.95.0 (f2d3ce0bd 2026-03-21)
```

## Windows 构建依赖

```text
Visual Studio 生成工具 2022
InstallationPath    C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools
InstallationVersion 17.14.37203.1
Product             Microsoft.VisualStudio.Product.BuildTools
VCTools workload    present
```

```text
Microsoft Edge WebView2 Runtime
Version  149.0.4022.98
Location C:\Program Files (x86)\Microsoft\EdgeWebView\Application
```

## 仓库状态

```text
e03f199
## HEAD (no branch)
 M src-tauri/Cargo.toml
 M src-tauri/src/lib.rs
 M src-tauri/tauri.conf.json
 M src-tauri/windowConfig.test.ts
 M src/App.tsx
 M src/components/shell/TitleBar.module.css
 M src/components/shell/TitleBar.test.tsx
 M src/components/shell/TitleBar.tsx
 M src/domains/document/components/ViewModeSwitch.module.css
 M src/domains/document/components/ViewModeSwitch.module.test.ts
 M src/domains/document/components/ViewModeSwitch.tsx
?? design-demos/
?? docs/releases/prism-windows-1.0.0-confidence-pack/
?? src-tauri/tauri.windows.conf.json
?? src-tauri/windows/
```

说明：验证是在 detached HEAD 工作区进行的，工作区并非干净。除本轮证据包与 Windows bundle 所需配置外，还存在既有未提交源码改动；本轮未回滚这些改动。
