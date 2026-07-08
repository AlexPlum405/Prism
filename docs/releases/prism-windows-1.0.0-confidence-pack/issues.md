# Prism Windows 1.0.0 已知问题

## 1. 已消减：全量测试失败

命令：`npm test -- --run`

当前结果：通过。

```text
Test Files  170 passed | 4 skipped (174)
Tests       1066 passed | 6 skipped (1072)
```

处理记录：当前失败收敛到 `exportPipeline.test.ts` 的超限 PNG 分片用例。该路径会真实拼接接近 16000px 的 PNG，默认 5s 用例超时预算过低；已只为 3 个分片集成用例设置 15s 预算，保留分片坐标和 PNG 尺寸断言。`WIN-TEST-001` 已从 Fail 调整为 Pass。

## 2. MSI 静默安装在当前用户权限下失败

命令：`msiexec /i Prism_1.0.0_x64_en-US.msi /qn /norestart /l*v ...`

结果：`1603`

日志结论：`Error 1925`，当前用户没有足够权限完成 per-machine 安装。这个问题是安装方式和权限约束，不是 bundle 未生成。

## 3. updater 产物没有闭环

`npm run tauri:build -- --verbose` 已经生成 MSI / NSIS，但在 updater 签名阶段失败，原因是本机没有 `TAURI_SIGNING_PRIVATE_KEY`。

后果：

- 没有 Windows updater `.sig`
- 没有可验证的 Windows `latest.json`
- 应用内检查更新能给出“暂不可用”最终态，但不能替代真实 updater 产物验证

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
