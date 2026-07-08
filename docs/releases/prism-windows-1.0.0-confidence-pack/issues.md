# Prism Windows 1.0.0 已知问题

## 1. 全量测试仍有 4 个失败

命令：`npm test -- --run`

失败项：

| 文件 | 失败点 | 结果 |
|---|---|---|
| `src/domains/editor/components/EditorPane.integration.test.tsx` | 复制当前 CodeMirror 选区的上下文菜单 | `writeText('hello')` 没有被调用 |
| `src/domains/export/exportPipeline.test.ts` | 超限长 PNG 分片导出 | 超时 |
| `src/domains/export/exportPipeline.test.ts` | 宽高都超限的 PNG 瓦片导出 | `jsdom` 空引用错误 |
| `src/domains/export/exportPipeline.test.ts` | PDF linked image URI annotations | 超时 |

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

## 4. 部分快捷键在 Windows 真机未生效

验证文件：`C:\Users\alex\Documents\PrismWindowsSmoke\Examples\keyboard-smoke.md`

结果：

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

## 7. 额外风险：Rust workspace index job 定向测试失败

命令：

```text
cargo test -q workspace_index_job --manifest-path src-tauri\Cargo.toml
```

结果：失败，`6` 项中 `5 passed / 1 failed`。

失败项：

| 文件 | 失败点 | 结果 |
|---|---|---|
| `src-tauri/src/domain/workspace_index_job.rs` | `queries_backlinks_and_relation_graph_from_completed_job` | `backlinks[0]` 越界，backlinks 长度为 0 |

说明：前端索引取消 / 降级模型测试通过，取消相关 Rust 测试也通过；这个失败暴露的是 completed native index job 查询 backlinks / relation graph 的额外风险。
