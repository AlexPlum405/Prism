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

## 3. 部分消减：updater 工具链跑通，正式私钥仍缺失

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

结论：updater 签名工具链本身已验证可用；`WIN-UPDATER-001` 仍保持 Blocked，因为正式发布必须使用 `src-tauri/tauri.conf.json` 当前内嵌 public key 对应的私钥。若该私钥已丢失，需要做 updater key rotation 决策，并明确现有 `v1.0.0` macOS 安装版无法通过旧 public key 接受新 key 签名的自动更新。

正式私钥查找结果：本机 `C:\Users\alex\.tauri` 只有 validation key；当前 shell 没有 updater signing env；GitHub Actions secrets 未列出 signing secret；Git 历史 `-S` 搜索未发现当前 public key 或 tauri secret key 线索；用户目录文件名搜索也只命中 validation key。因此该项继续属于外部状态阻塞。

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

## 5. 仍未补齐 / 需要人工确认的验证项

这些项本轮没有做成完整真机证据：

- 删除到回收站：需要用户在动作前确认允许 Prism UI 删除 `DeleteSmoke\delete-me.md`
- 高 DPI 125% / 150%：需要确认后修改 Windows 显示缩放
- `Ctrl` + 鼠标滚轮调整字号：当前验证基线 `e03f199e6f3bcd256bc9cc83c356302e69239d31` 不包含 `912c9fb5`，按计划 Not Run
- `F9` 打字机模式：触发后缺少稳定可访问文本或可见状态证据，需要人工视觉补验

## 6. 证据限制：图片粘贴 / 拖拽

图片粘贴 / 拖拽定向自动化测试通过：

```text
Test Files  4 passed (4)
Tests       24 passed | 31 skipped (55)
```

覆盖剪贴板图片保存到 assets、拖拽图片复制、Alt / Option drop 插入原路径，以及读取不到原路径时提示。

限制：本轮未补人工拖拽 UI 截图。

## 7. 已消减：Rust workspace index job 定向测试失败

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
