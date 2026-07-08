# 构建与测试

## 1. 全量测试

命令：`npm test -- --run`

结果：通过。

概要：

- Test Files：`170 passed | 4 skipped`。
- Tests：`1061 passed | 6 skipped`。

消减记录：

| 项目 | 处理 |
|---|---|
| `src/domains/export/exportPipeline.test.ts` | 超限 PNG 分片导出测试会真实拼接接近 16000px 的 PNG，默认 5s 用例超时预算过低；已只为 3 个分片集成用例设置 15s 预算，保留分片坐标和 PNG 尺寸断言 |
| 全量测试 | 当前最新代码全量通过，`WIN-TEST-001` 从 Fail 调整为 Pass |

## 2. 前端 build

命令：`npm run build`

结果：通过。

备注：Vite 输出 chunk size warnings 和 `node:module` externalized warning，未阻断构建。

## 3. Windows bundle

命令：`npm run tauri:build -- --verbose`

结果：

- 前端 build 成功。
- Rust release build 成功。
- Tauri 生成了 MSI 和 NSIS。
- updater 签名阶段失败，原因是本机没有 `TAURI_SIGNING_PRIVATE_KEY`。

Cargo warning：

- `src\commands\trash.rs`：unused `PathBuf`
- `src\commands\trash.rs`：unused `Command`, `Stdio`
- `src\commands\trash.rs`：unused `first_non_empty_line`

WiX warning：

- `ICE03`：`DownloadAndInvokeBootstrapper` string overflow
- `ICE40`：`REINSTALLMODE`
- `ICE57`：per-user / per-machine component
- `ICE61`：upgrade max version

MSI/NSIS 产物已经能出来，当前阻塞点是 updater 私钥。

## 4. 导出 smoke 测试

命令：

```text
npm test -- --run src/domains/export/exportPipeline.test.ts -t "writes complex export smoke artifacts for all supported formats"
```

结果：通过，1 个测试通过，64 个跳过。

## 5. 图片粘贴 / 拖拽定向测试

命令：

```text
npm test -- --run src/domains/editor/extensions/imagePaste.test.ts src/domains/editor/runtime/editorClipboardRuntime.test.ts src/domains/editor/runtime/editorClipboardController.test.ts src/domains/editor/components/EditorPane.integration.test.tsx -t "image|drop|clipboard|Alt|Option|drag"
```

结果：通过。

摘要：

- Test Files：`4 passed (4)`。
- Tests：`24 passed | 31 skipped (55)`。

覆盖：剪贴板图片保存到 assets、拖拽图片复制、Alt / Option drop 插入原路径、读取不到原路径时提示等。

## 6. 收尾检查

命令：`git diff --check`

结果：通过，退出码 `0`。

备注：Git 输出了当前工作树若干既有源码文件的 LF/CRLF 转换 warning；未发现 whitespace error。
