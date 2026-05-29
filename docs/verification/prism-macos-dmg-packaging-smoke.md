# Prism macOS DMG Packaging Smoke

> 日期：2026-05-15  
> 目标：记录 Prism macOS DMG 打包 gate 的真实失败点和可复现 fallback。  
> 计划来源：`docs/archive/dirty-data-2026-05-30/historical-docs/prism-product-optimization-plan.md` 第 2 节“产品信任与发布治理”。

## 1. 背景

`npm run tauri:build` 已能完成前端 build、Rust release 编译和 `Prism.app` bundle 生成，但本机在 DMG 阶段会卡在 create-dmg 的 Finder AppleScript 布局步骤，最终超时。

失败命令：

```bash
npm run tauri:build
npm run tauri -- build --bundles dmg -v
```

失败点：

```text
bundle_dmg.sh ... Prism_1.4.0_aarch64.dmg Prism.app
Running AppleScript to make Finder stuff pretty
Finder AppleEvent 已超时 (-1712)
```

这不是 TypeScript / Rust 编译失败，也不是 Tauri capabilities 配置失败；它发生在 macOS Finder 自动化布置 DMG 图标时。

## 2. Fallback

Tauri 生成的 `bundle_dmg.sh` 支持 `--skip-jenkins`，可跳过 Finder AppleScript 美化步骤，生成无自定义图标定位的 DMG。

若目标只是本地打开 `.app` 做运行时 smoke，优先使用 App-only smoke 构建：

```bash
npm run tauri:build:app-smoke
```

该命令合并 `src-tauri/tauri.local-smoke.conf.json`，只生成 macOS `.app`，并关闭 updater artifacts；它不需要 `TAURI_SIGNING_PRIVATE_KEY`，也不触发 DMG Finder 布局步骤。它不能替代正式发布构建、updater `.sig`、`latest.json`、Apple 签名或公证。

仓库脚本：

```bash
npm run tauri -- build --bundles app
npm run release:mac-dmg:skip-finder
hdiutil verify src-tauri/target/release/bundle/macos/Prism_1.4.0_aarch64.dmg
```

脚本位置：

```text
scripts/package-macos-dmg-skip-finder.sh
```

## 3. 本轮结果

### 2026-05-15 App-only runtime smoke build

已执行：

```bash
npm run tauri:build:app-smoke
```

结果：

- 通过：命令返回 0。
- 前端 `npm run build`、Rust release 编译和 macOS `.app` bundling 均完成。
- 生成 `src-tauri/target/release/bundle/macos/Prism.app`。
- 未要求 `TAURI_SIGNING_PRIVATE_KEY`。
- 未进入 DMG Finder AppleScript 布局步骤。
- 该结果只证明本机 runtime smoke 可获得干净 `.app`，不证明 updater 签名、`.sig`、`latest.json`、Apple 签名、公证或 DMG 美化布局。

### DMG fallback

已执行：

```bash
npm run tauri:build
npm run release:mac-dmg:skip-finder
hdiutil verify src-tauri/target/release/bundle/macos/Prism_1.4.0_aarch64.dmg
```

结果：

- `npm run tauri:build` 已完成前端 build、Rust release 编译和 `Prism.app` bundle，随后仍失败在 `bundle_dmg.sh` DMG 阶段。
- 生成 `src-tauri/target/release/bundle/macos/Prism_1.4.0_aarch64.dmg`。
- `hdiutil verify` 返回 `checksum ... is VALID`。
- `hdiutil info` 未发现残留 Prism / dmg 挂载卷。

## 4. 验收与限制

通过：

- `.app` bundle 已由 Tauri build 生成。
- fallback DMG 可生成并通过 hdiutil 校验。

限制：

- fallback DMG 没有 Finder 图标定位 / 美化布局。
- fallback 不替代 Apple Developer ID 签名和公证。
- Stable release 仍需按 `docs/prism-macos-release.md` 完成签名、公证、updater `.sig` 和 `latest.json`。
