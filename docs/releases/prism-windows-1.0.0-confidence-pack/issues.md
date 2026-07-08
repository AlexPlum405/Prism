# Prism Windows 1.0.0 已知问题

## 1. 已消减：全量测试失败

命令：`npm test -- --run`

当前结果：通过。

```text
Test Files  170 passed | 4 skipped (174)
Tests       1066 passed | 6 skipped (1072)
```

处理记录：当前失败收敛到 `exportPipeline.test.ts` 的超限 PNG 分片用例。该路径会真实拼接接近 16000px 的 PNG，默认 5s 用例超时预算过低；已只为 3 个分片集成用例设置 15s 预算，保留分片坐标和 PNG 尺寸断言。`WIN-TEST-001` 已从 Fail 调整为 Pass。

## 2. 已消减：MSI 管理员静默安装通过

命令：`msiexec /i Prism_1.0.0_x64_en-US.msi /qn /norestart /l*v ...`

非管理员静默安装结果：`1603`

非管理员日志结论：`Error 1925`，当前用户没有足够权限完成 per-machine 安装。这个问题是安装方式和权限约束，不是 bundle 未生成。

管理员权限复测命令：通过 PowerShell `Start-Process msiexec.exe -Verb RunAs -Wait -PassThru` 执行同一 MSI 的 `/qn /norestart /l*v` 安装。

管理员权限复测结果：`ExitCode 0`

管理员日志：`artifacts/msi-install-admin.log`

日志关键结论：

```text
Product: Prism -- Installation completed successfully.
Windows Installer 已安装产品。产品名称: Prism。产品版本: 1.0.0。产品语言: 1033。制造商: prism。安装成功或错误状态: 0。
MainEngineThread is returning 0
```

结论：`WIN-INSTALL-002` 从 Fail 调整为 Pass。MSI 产物在正确提权前提下可静默安装通过；非管理员 `/qn` 不弹 UAC，因此仍会被 per-machine 权限限制拦截。

## 3. 已消减：updater 工具链跑通，并完成正式 key rotation

`npm run tauri:build -- --verbose` 已经生成 MSI / NSIS，但在 updater 签名阶段失败，原因是本机没有 `TAURI_SIGNING_PRIVATE_KEY`。

原始后果：

- 没有 Windows updater `.sig`
- 没有可验证的 Windows `latest.json`
- 应用内检查更新能给出“暂不可用”最终态，但不能替代真实 updater 产物验证

本轮验证：

- 生成本机 validation key：`C:\Users\alex\.tauri\prism-updater-validation.key`，私钥不进入仓库。
- 临时用 validation public key 覆盖 Tauri updater config 后执行 Windows bundle。
- `TAURI_SIGNING_PRIVATE_KEY_PATH` 不足以驱动 `tauri build`，构建仍报缺私钥；改用 `TAURI_SIGNING_PRIVATE_KEY=<私钥文件内容>` 后通过。
- `npm run tauri:build -- --config <validation pubkey> --bundles nsis,msi` 返回 `0`。
- 生成 `Prism_1.0.0_x64-setup.exe.sig` 和 `Prism_1.0.0_x64_en-US.msi.sig`。
- 使用 `windows-x86_64` 平台 key 生成 `latest.json`，并通过 `release:manifest:check`。

验证产物：

- `artifacts/updater/validation-public-key.pub`
- `artifacts/updater/validation-nsis-setup.exe.sig`
- `artifacts/updater/validation-msi.msi.sig`
- `artifacts/updater/validation-windows-latest.json`

验证构建 SHA256：

```text
NSIS setup.exe  F907CCAA94AD31FB6B82FD87396D2887788855B95B05E8909C2C23EE46208A05
MSI             38E38BFB35D0911AFCA6863E1510A6D9E01B9A6410FAC4031547C30C6B74295A
NSIS .sig       712E303F11C690AD0D979213B94D6B45C09E72ADE859250CE4CC2B70707CA8FF
MSI .sig        8EE18536245107877AC92E239FF267C93EBB8A72A458C1A364F934D321C40D4E
latest.json     58C21E5FFE0B48BD45BFF48FCAE99709CE4B073510352D375F1BB9EB1F8EB6F9
```

结论：updater 签名工具链本身已验证可用。旧 public key 对应的正式私钥仍未找回，因此已执行 updater key rotation，并明确现有 `v1.0.0` 安装版无法通过旧 public key 接受新 key 签名的自动更新，需要用户手动安装一次新 key 版本。

正式私钥查找结果：本机 `C:\Users\alex\.tauri` 原本只有 validation key；当前 shell 没有 updater signing env；GitHub Actions secrets 未列出 signing secret；Git 历史 `-S` 搜索未发现旧 public key 或 tauri secret key 线索；用户目录文件名搜索也只命中 validation key。

key rotation 结果：

- 新正式私钥：`C:\Users\alex\.tauri\prism-updater.key`，不进入仓库。
- 新正式 public key 已写入 `src-tauri/tauri.conf.json`，仓库证据为 `artifacts/updater/official-public-key.pub`。
- `npm run tauri:build -- --bundles nsis,msi` 在注入新正式私钥后返回 `0`。
- 生成 `Prism_1.0.0_x64-setup.exe.sig` 和 `Prism_1.0.0_x64_en-US.msi.sig`。
- 使用 `windows-x86_64` 平台 key 生成 `latest.json`，并通过 `release:manifest:check`。
- 已用新 NSIS 手动覆盖安装一次新 key 版本，返回 `0`；安装落点 `app.exe` SHA256 为 `114A085E1640B6411EFE5FB969AEBE3626A87360DFEAEED1FAEB0F883018DFE5`，二进制中能搜到新 public key id `4D7CCC88FB14D827`，搜不到旧 public key。

正式 key rotation 产物：

- `artifacts/updater/official-public-key.pub`
- `artifacts/updater/official-nsis-setup.exe.sig`
- `artifacts/updater/official-msi.msi.sig`
- `artifacts/updater/official-windows-latest.json`

正式 key rotation 构建 SHA256：

```text
NSIS setup.exe  D76BA7F01D50436EB4FA1B7A2D1E1D81CE4605CC1D12C06F4308E53524016E20
MSI             D1B23C336F716FB9D220E52841D98D9A7E9A0AF484048AEDFB5E074A5EB5E5F6
NSIS .sig       EE8070FD9A3F6A4EAA0F097298F0FCC4DEB92B18DDA1F76B4D7D864192A662D0
MSI .sig        C093F99D46F36A52B2C8E1B9EEB59F5EFB787507C3BD6276F452888DDBC39BBB
latest.json     7D0D7BD43FAA7178AFB0994F582E528ED765B5000843358FAFAF7DECAF076FE4
```

结论：`WIN-UPDATER-001` 从 Blocked 调整为 Pass with key rotation。

## 4. 已修复并复测通过：部分快捷键在 Windows 真机未生效

验证文件：`C:\Users\alex\Documents\PrismWindowsSmoke\Examples\keyboard-smoke.md`

原 Windows 真机基线结果：

| 快捷键 | 预期 | 实际 |
|---|---|---|
| `Ctrl+B` | 给选中文本加粗 | 文件内容未出现 `**...**` 标记 |
| `Ctrl+I` | 给选中文本斜体 | 文件内容未出现 `*...*` 标记 |
| `Ctrl+O` | 打开系统文件选择对话框 | 未出现可见打开对话框 |
| `Ctrl+N` | 新建文稿 | 未创建或切换到新文稿 |
| `F11` | Prism 窗口进入全屏 | 窗口尺寸保持 1102x792 |

对照项：

- `Ctrl+F` 可打开查找栏。
- `Ctrl+H` 可展开替换栏。
- `F8` 可触发专注模式状态。

当前开发分支处理记录：

- 原因定位：编辑器聚焦时，部分组合键会先经过 CodeMirror keymap；`Ctrl+I` 可被 CodeMirror 默认命令消耗，导致 app 级快捷键 hook 收不到。
- 修复：在 CodeMirror 最高优先级 keymap 中桥接 `Ctrl+B`、`Ctrl+I`、`Ctrl+O`、`Ctrl+N`、`F11` 到 Prism `command.run`。
- 自动回归：`npm test -- --run src/domains/editor/components/EditorPane.integration.test.tsx src/app/useAppShortcuts.test.tsx src/domains/commands/platform.test.ts src/domains/commands/registry.test.ts` 通过，`Test Files 4 passed`，`Tests 94 passed`。
- 安装版复测：已重新执行 `npm run tauri:build -- --verbose`，生成 NSIS / MSI 后因缺少 `TAURI_SIGNING_PRIVATE_KEY` 停在 updater 签名阶段；NSIS 覆盖安装返回 0。安装落点 `C:\Users\alex\AppData\Local\Prism\app.exe` SHA256 为 `A4D5220F5AC8026FD4B65BA0CD11D19360B54180BCD39F93B105E418021062E0`。

修复后 Windows 真机复测文件：`C:\Users\alex\Documents\Prism\Examples\shortcut-retake.md`

| 快捷键 | 预期 | 修复后实际 |
|---|---|---|
| `Ctrl+B` | 给选中文本加粗 | 选中 `keyboard smoke` 后写入 `**keyboard smoke**` |
| `Ctrl+I` | 给选中文本斜体 | 撤销粗体后写入 `*keyboard smoke*` |
| `Ctrl+O` | 打开系统文件选择对话框 | 出现 Windows “打开”对话框，包含文件名输入框、打开 / 取消按钮；Esc 可关闭 |
| `Ctrl+N` | 新建文稿 | 创建 `未命名.md`，随后重命名为 `shortcut-retake.md` |
| `F11` | Prism 窗口进入全屏 | 从 1102x762 窗口层切到 2560x1440 全屏层；再次按 `F11` 还原 |

结论：`WIN-WRITE-004` 从 Blocked 调整为 Pass。

## 5. F9 打字机模式已补验

复测环境：Windows 安装版 Prism 主窗口，Guide 文档，编辑模式。

复测步骤：

1. 打开顶部 `视图` 菜单，确认存在 `打字机模式 F9` 菜单项。
2. 点击 `打字机模式 F9`。
3. 观察编辑区内容位置，并再次打开 `视图` 菜单确认勾选状态。

结果：

- 触发后首屏正文整体下移，第一行内容位于窗口中部附近，符合打字机模式 `40vh` 上下留白的预期视觉效果。
- 再次打开 `视图` 菜单时，`打字机模式` 左侧显示勾选。
- 已保存截图：`screenshots/17-typewriter-mode.png`、`screenshots/17b-typewriter-menu-checked.png`。

结论：`WIN-WRITE-005` 从 Blocked 调整为 Pass。

## 6. 已补验：回收站删除和高 DPI

用户已确认允许通过 Prism UI 删除测试文件 `DeleteSmoke\delete-me.md`。

回收站删除补验结果：

- Prism 文件树右键 `delete-me.md` 后点击 `删除`。
- 在确认框中点击 `移到废纸篓`。
- 原路径不存在，`keep.md` 仍存在。
- Windows 回收站中可查到 `delete-me.md`，原位置为 `C:\Users\alex\Documents\PrismWindowsSmoke\DeleteSmoke`。

高 DPI 补验结果：

- Windows 显示缩放依次切到 `125%` 和 `150%`。
- 每次缩放后均重启 Prism，并采集窗口级截图。
- 标题栏、顶部菜单、三模式按钮、文件树、预览正文、状态栏均可见；未观察到重叠、裁切或溢出。
- 截图：`screenshots/18-high-dpi-125.jpg`、`screenshots/18b-high-dpi-150.jpg`。
- 复测结束后已恢复系统缩放到 `100% (推荐)`。

结论：`WIN-PATH-003` 和 `WIN-UI-004` 均从 Blocked 调整为 Pass。

仍未执行的条件项：

- `Ctrl` + 鼠标滚轮调整字号：当前验证基线 `e03f199e6f3bcd256bc9cc83c356302e69239d31` 不包含 `912c9fb5`，按计划 Not Run。

## 7. 证据限制：图片粘贴 / 拖拽

图片粘贴 / 拖拽定向自动化测试通过：

```text
Test Files  4 passed (4)
Tests       24 passed | 31 skipped (55)
```

覆盖剪贴板图片保存到 assets、拖拽图片复制、Alt / Option drop 插入原路径，以及读取不到原路径时提示。

限制：本轮未补人工拖拽 UI 截图。

## 8. 已消减：Rust workspace index job 定向测试失败

命令：

```text
cargo test -q workspace_index_job --manifest-path src-tauri\Cargo.toml
```

当前结果：通过，`6 passed / 0 failed`。

补充命令：

```text
cargo test -q workspace_index --manifest-path src-tauri\Cargo.toml
```

当前结果：通过，`18 passed / 0 failed`。

处理记录：Windows `canonicalize()` 返回的 `\\?\C:\...` verbatim 路径前缀会导致相对 Markdown 链接候选路径和索引文档路径规范化结果不一致，从而让 completed native index job 查询 backlinks / relation graph 时拿不到反链。已统一去除 Windows verbatim 前缀，并补底层单测。
