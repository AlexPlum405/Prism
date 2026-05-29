# Prism v1.4.1 Release Notes

## 中文

Prism v1.4.1 是一次面向真实发布入口和写作效率的增量版本。本版本将项目版本统一推进到 `1.4.1`，重新打包 macOS Apple Silicon DMG，并把最新 36 秒产品介绍视频接入 README。

### 重点更新

- 新增快节奏产品介绍视频，展示编辑、分栏预览、文档树、快速打开、设置中心、导出菜单、任务清单、表格、KaTeX、Mermaid、Callout 与代码块等关键能力。
- README / README.zh-CN 已改为使用新视频封面，并链接到带声音 MP4 产品介绍视频。
- 统一更新 Prism 应用图标与多平台图标资源，新增品牌图标生成脚本，保留 Windows 图标一致性验证记录。
- 编辑器内任务清单 checkbox 支持直接点击切换，并补充集成测试。
- 增强 Markdown 写作效率：Callout 选择器、Callout 片段、斜杠菜单、块操作、上下文菜单与图片粘贴流程都有细节修正。
- 优化命令与菜单模型，补齐导出命令、编辑命令、平台行为与中英文资源文案。
- 补充当前 Prism UX 审计、可勾选优化项、宣传素材、演示用《桃花源记》Markdown 文档与 Rust 核心现代化目标文档。

### 发布与验证

- 版本号已同步到 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 和 `src-tauri/Cargo.lock`。
- 已通过全量 Vitest：144 个测试文件，695 条测试。
- 已通过生产构建：`npm run build`。
- 已生成并校验 macOS Apple Silicon DMG：`Prism_1.4.1_aarch64.dmg`。
- 已验证产品介绍视频：1920x1080、36 秒、60fps、H.264 + AAC。
- 新增高质量产品介绍视频资产：2560x1440、36 秒、120fps、H.264 + AAC，平均码率约 21.7Mbps。

## English

Prism v1.4.1 is an incremental release focused on the public release surface and writing efficiency. This version aligns the project version to `1.4.1`, rebuilds the macOS Apple Silicon DMG, and adds the latest 36-second product video to the README.

### Highlights

- Added a fast-paced product video covering editing, split preview, document tree, quick open, settings center, export menu, task lists, tables, KaTeX, Mermaid, callouts, and code blocks.
- Updated README / README.zh-CN to use the new video poster and link directly to the MP4 product video with sound.
- Refreshed Prism application icons and multi-platform icon assets, added a brand icon generation script, and documented Windows icon consistency verification.
- Added direct in-editor task list checkbox toggling with integration coverage.
- Improved Markdown writing workflows across the callout picker, callout snippets, slash menu, block operations, context menu, and image paste handling.
- Refined command and menu modeling, including export commands, editor commands, platform behavior, and bilingual resource copy.
- Added current UX audit materials, selectable UX optimization options, promotional assets, the Tao Yuanming showcase Markdown document, and a Rust core modernization goal document.

### Release And Verification

- Version numbers are aligned in `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`.
- Full Vitest suite passed: 144 test files and 695 tests.
- Production build passed: `npm run build`.
- Built and verified the macOS Apple Silicon DMG: `Prism_1.4.1_aarch64.dmg`.
- Verified the product video: 1920x1080, 36 seconds, 60fps, H.264 + AAC.
- Added a high-quality product video asset: 2560x1440, 36 seconds, 120fps, H.264 + AAC, with an average bitrate around 21.7Mbps.
