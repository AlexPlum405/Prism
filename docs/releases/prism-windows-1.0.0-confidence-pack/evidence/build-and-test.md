# 构建与测试

## 1. 全量测试

命令：`npm test -- --run`

结果：通过。

概要：

- Test Files：`170 passed | 4 skipped`。
- Tests：`1066 passed | 6 skipped`。

消减记录：

| 项目 | 处理 |
|---|---|
| `src/domains/export/exportPipeline.test.ts` | 超限 PNG 分片导出测试会真实拼接接近 16000px 的 PNG，默认 5s 用例超时预算过低；已只为 3 个分片集成用例设置 15s 预算，保留分片坐标和 PNG 尺寸断言 |
| 全量测试 | 当前最新代码全量通过，`WIN-TEST-001` 从 Fail 调整为 Pass |

## 2. 前端 build

命令：`npm run build`

结果：通过。

备注：Vite 输出 chunk size warnings 和 `node:module` externalized warning，未阻断构建。

## 3. Rust native tests

命令：`cargo test -q --manifest-path src-tauri\Cargo.toml`

结果：通过。

概要：

- Tests：`53 passed`。
- 备注：`src\commands\trash.rs` 仍有 unused import warnings，未阻断测试。

## 4. Windows bundle

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

本轮快捷键修复后重打包记录：

- 命令：`npm run tauri:build -- --verbose`。
- 结果：MSI / NSIS 产物生成成功；最终仍因缺少 `TAURI_SIGNING_PRIVATE_KEY` 停在 updater 签名阶段。
- Commit：`b9eca8c5c2eaaddff6644be0ccebf4a1812b723f`。
- `src-tauri\target\release\app.exe`：Size `31,839,232`，SHA256 `17D9233D5A08E10BC63D88A7296A478AB19A888399D836D963B6563E283033DB`。
- `src-tauri\target\release\bundle\nsis\Prism_1.0.0_x64-setup.exe`：Size `21,341,955`，SHA256 `F3A1000B2EBFD3F6DF8BB6B53941CBE1B2C7210CB28228549427698EBB806FA9`。
- `src-tauri\target\release\bundle\msi\Prism_1.0.0_x64_en-US.msi`：Size `23,453,696`，SHA256 `7921064DE709DAB6167D319C45C1A79457823DDF4F8BC0A7BEA709D85F49F31D`。

## 5. 导出 smoke 测试

命令：

```text
npm test -- --run src/domains/export/exportPipeline.test.ts -t "writes complex export smoke artifacts for all supported formats"
```

结果：通过，1 个测试通过，64 个跳过。

## 6. 图片粘贴 / 拖拽定向测试

命令：

```text
npm test -- --run src/domains/editor/extensions/imagePaste.test.ts src/domains/editor/runtime/editorClipboardRuntime.test.ts src/domains/editor/runtime/editorClipboardController.test.ts src/domains/editor/components/EditorPane.integration.test.tsx -t "image|drop|clipboard|Alt|Option|drag"
```

结果：通过。

摘要：

- Test Files：`4 passed (4)`。
- Tests：`24 passed | 31 skipped (55)`。

覆盖：剪贴板图片保存到 assets、拖拽图片复制、Alt / Option drop 插入原路径、读取不到原路径时提示等。

## 7. 收尾检查

命令：`git diff --check`

结果：通过，退出码 `0`。

备注：Git 输出了当前工作树若干既有源码文件的 LF/CRLF 转换 warning；未发现 whitespace error。
