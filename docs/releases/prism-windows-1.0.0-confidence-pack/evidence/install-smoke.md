# 安装与启动 Smoke

## NSIS 安装

命令：`Prism_1.0.0_x64-setup.exe /S`

结果：`ExitCode 0`

安装落点：

```text
C:\Users\alex\AppData\Local\Prism
```

安装后 `app.exe`：

```text
Size   31,851,008
SHA256 89FC627C51D582CAE7C749EA028EC6632E5B26ED5570260D7737D84667E33709
```

快捷键修复后重新打包，并用新 NSIS 覆盖安装后的 `app.exe`：

```text
Size   31,839,232
SHA256 A4D5220F5AC8026FD4B65BA0CD11D19360B54180BCD39F93B105E418021062E0
```

开始菜单快捷方式：

```text
C:\Users\alex\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Prism.lnk
```

快捷方式存在，大小 `1159` bytes。

安装器 UI 截图：

- `screenshots/00-installer-home.png`：NSIS Welcome 页，窗口级截图，尺寸 `499x388`。
- 安装完成页未稳定捕获。NSIS 点击 Next 后流程很快完成并启动 / 关闭窗口，本轮不把不稳定截图作为证据。

## 开始菜单启动

通过开始菜单链接启动后，Prism 打开了首个 guide 文档窗口，窗口标题仍是 `Prism`。

## 安装后版本

安装落点中的可执行文件：

```text
C:\Users\alex\AppData\Local\Prism\app.exe
```

文件版本检查结果：

```text
FileVersion    1.0.0
ProductVersion 1.0.0
ProductName    Prism
```

结论：安装后的 Prism 版本与目标版本 `1.0.0` 一致。

## 覆盖安装

步骤：

1. 记录用户配置文件 hash 和最近文件列表。
2. 在 Prism 未运行时再次执行 `Prism_1.0.0_x64-setup.exe /S`。
3. 对比安装后配置和最近文件。

结果：

- 覆盖安装 `ExitCode 0`。
- `config.json` SHA256 前后保持不变：`92E283F252DADC4788084AB0CA9282A58747B82E6CAFDB797FF5BAF2D91E87EA`。
- 最近文件列表保持不变，包含 `复杂 路径 (测试).md`、`windows-smoke.md`、`data.json`、`plain.txt` 等。
- 快捷键修复后再次用新 NSIS 覆盖安装，`ExitCode 0`，用于 `WIN-WRITE-004` 安装版复测。

结论：覆盖安装没有清空用户设置和最近文件。

## 卸载保留用户工作区

步骤：

1. 记录 `C:\Users\alex\Documents\PrismWindowsSmoke\DeleteSmoke\keep.md` 的 SHA256。
2. 执行 `C:\Users\alex\AppData\Local\Prism\uninstall.exe /S`。
3. 检查安装目录和 `keep.md`。
4. 重新执行 NSIS 静默安装，恢复 Prism 可用状态。

结果：

- 卸载 `ExitCode 0`。
- 卸载后 `C:\Users\alex\AppData\Local\Prism\app.exe` 不存在。
- `keep.md` 仍存在，SHA256 保持 `E949B08B70E6A3B5AECD9200C849C5719571772E7AE0DE30B76CFA4AD3557B88`。
- 重装 `ExitCode 0`，`app.exe` 和 `uninstall.exe` 均恢复。

结论：卸载不会删除测试工作区文档。

## MSI 安装

### 非管理员静默安装

命令：`msiexec /i Prism_1.0.0_x64_en-US.msi /qn /norestart /l*v ...`

结果：`ExitCode 1603`

日志：`artifacts/msi-install.log`

日志里的关键结论：

```text
Product: Prism -- Error 1925. You do not have sufficient privileges to complete this installation for all users of the machine.
Action ended 2:24:55: InstallFinalize. Return value 3.
Product: Prism -- Installation failed.
```

结论：非管理员 `/qn` 静默安装不会弹 UAC，会被 per-machine 安装权限限制拦截。

### 管理员静默安装

命令：通过 PowerShell `Start-Process msiexec.exe -Verb RunAs -Wait -PassThru` 执行同一 MSI 的 `/qn /norestart /l*v` 安装。

结果：`ExitCode 0`

日志：`artifacts/msi-install-admin.log`

日志里的关键结论：

```text
Product: Prism -- Installation completed successfully.
Windows Installer 已安装产品。产品名称: Prism。产品版本: 1.0.0。产品语言: 1033。制造商: prism。安装成功或错误状态: 0。
MainEngineThread is returning 0
```

结论：MSI 产物在管理员权限下可以静默安装通过。此前失败是非管理员 silent install 的权限前置条件，不是 MSI 产物损坏。
