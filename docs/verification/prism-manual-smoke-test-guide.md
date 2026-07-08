# Prism 1.0.x 人工 Smoke 测试手册

> 日期：2026-05-15  
> 目标：让人工验证接住“功能已实现，但真实 smoke 没完全闭环”的部分。  
> 适用范围：Finder / Explorer 图片拖拽、Option / Alt 原路径、30 秒输入性能、Pandoc citeproc、Windows 发布路径、Apple 签名公证前检查。  
> 不适用范围：重新设计功能、补新需求、替代自动化测试。

## 1. 总原则

人工 smoke 只回答一个问题：真实用户在真实桌面环境里能不能完成关键动作。

记录时不要写“看起来可以”。每一项都要写成：

```text
日期：
Prism 版本 / commit：
平台：
启动方式：
测试文件：
操作步骤：
实际结果：
截图 / 产物路径：
结论：通过 / 未通过 / 阻塞
```

如果功能失败，优先记录复现路径；不要立即改文档结论为通过。如果环境不满足，例如没有 Windows、没有 Pandoc、没有 Developer ID 证书，要写“阻塞”，不要写“失败”。

## 2. 准备环境

在仓库根目录执行：

```bash
git status --short
npm ci
npm test -- --run
npm run build
npm run tauri:build:app-smoke
open -n src-tauri/target/release/bundle/macos/Prism.app
```

如果只是快速人工检查，可以跳过 `npm test -- --run`，但最后要在记录里说明“未重跑自动化，只做人工 smoke”。

macOS 人工测试推荐使用 app bundle：

```text
src-tauri/target/release/bundle/macos/Prism.app
```

不要用旧的已安装 app 或浏览器页面替代，避免测到旧版本。

## 3. Finder / Explorer 图片拖拽

对应分项文档：`docs/verification/prism-writing-efficiency-smoke.md`

### 3.1 准备工作区

创建以下目录：

```bash
mkdir -p .codex-smoke/manual-drag/workspace/assets
cat > .codex-smoke/manual-drag/workspace/index.md <<'MD'
# 图片拖拽 Smoke

把图片拖到下面这一行：

MD
```

准备一张真实图片，放到：

```text
.codex-smoke/manual-drag/workspace/assets/drag-source.png
```

可以用截图工具生成 PNG，也可以复制任意本地 PNG 到该路径。

### 3.2 普通拖拽

1. 启动最新 `Prism.app`。
2. 打开 `.codex-smoke/manual-drag/workspace/index.md`。
3. 从 Finder 把 `drag-source.png` 拖进编辑器正文。

通过标准：

- 编辑器插入 Markdown 图片语法。
- 当前文档旁出现 `assets/index/` 或等价 assets 子目录。
- 图片被复制进去，而不是只引用原文件。
- 预览中图片可见。
- 保存后重新打开文档，图片仍可见。

失败记录重点：

- 是否完全没有响应。
- 是否插入了错误路径。
- 是否复制了文件但预览断图。
- 是否 toast 提示权限或路径读取失败。

### 3.3 Option / Alt 原路径拖拽

1. 重新打开同一文档。
2. 按住 Option，再从 Finder 拖入同一张图片。
3. Windows 上按住 Alt，从 Explorer 拖入同一张图片。

通过标准：

- Prism 不复制图片到 assets。
- 编辑器插入指向原文件位置的图片链接。
- 如果系统没有暴露原路径，Prism 必须提示“无法读取拖拽文件原始路径”或等价说明，不能静默失败。

注意：

- macOS Finder 跨应用拖拽自动化不可靠，所以这一项必须人工拖。
- Windows Explorer 行为不能用 macOS 代替。

记录模板：

```text
普通拖拽：通过 / 未通过
Option 或 Alt 拖拽：通过 / 未通过 / 系统未暴露原路径但提示正确
插入 Markdown：
复制后的图片路径：
预览是否可见：
截图：
```

## 4. 30 秒输入性能与预览同步

对应分项文档：`docs/verification/prism-preview-sync-smoke.md`

### 4.1 生成长文 fixture

```bash
mkdir -p .codex-smoke/manual-preview
node <<'NODE'
const fs = require('node:fs');
const parts = ['# 预览性能人工 Smoke\n'];
for (let i = 1; i <= 120; i += 1) {
  parts.push(`\n## 第 ${i} 节\n`);
  for (let j = 1; j <= 12; j += 1) {
    parts.push(`这是第 ${i} 节第 ${j} 段，用于人工测试长文输入、滚动和预览刷新。English words ${i}-${j} 与中文混排，行内公式 $a_${i}${j} + b = c$。\n\n`);
  }
  if (i % 20 === 0) {
    parts.push('```mermaid\ngraph TD\n  A[源码] --> B[预览]\n  B --> C[点击跳转]\n```\n\n');
  }
}
fs.writeFileSync('.codex-smoke/manual-preview/preview-performance.md', parts.join(''));
NODE
```

### 4.2 30 秒连续输入

1. 用最新 `Prism.app` 打开 `.codex-smoke/manual-preview/preview-performance.md`。
2. 切到分栏模式。
3. 跳到第 80 节附近。
4. 连续正常输入 30 秒，保持接近日常写作速度。
5. 输入期间观察左侧编辑器、右侧预览、状态栏保存状态。
6. 输入结束后等待自动保存完成。
7. 按一次 `Cmd+Z` / `Ctrl+Z`，确认 undo 可用。

通过标准：

- 输入过程中不持续卡顿到影响写作。
- 预览可以延迟刷新，但不能长时间空白。
- Mermaid 渲染不能阻塞普通文字预览。
- 自动保存最终落盘，重新打开文件后内容存在。
- Undo 不丢失，撤销后预览跟随变化。

建议同时打开系统监控：

- macOS：Activity Monitor，观察 Prism CPU。
- Windows：Task Manager，观察 Prism CPU 和内存。

记录模板：

```text
连续输入时长：30 秒
输入是否明显掉帧：
预览是否长时间空白：
自动保存是否完成：
Undo 是否正常：
Prism CPU 峰值：
Prism 内存峰值：
截图 / 录屏：
结论：
```

### 4.3 滚动与点击跳源码

1. 分栏模式下，从顶部滚动源码到第 60 节。
2. 确认预览跟随到第 60 节附近。
3. 在预览滚动到第 100 节。
4. 确认源码跟随到第 100 节附近。
5. 点击预览中的标题、正文段落和代码块。

通过标准：

- 双向滚动区段大致对齐，不要求逐像素一致。
- 点击预览后源码定位到对应行附近。
- 快速滚动不出现明显反向抖动、抢滚或空白。

## 5. Pandoc citeproc HTML 引用导出

对应分项文档：`docs/verification/prism-pandoc-citation-html-smoke.md`

### 5.1 前置条件

必须先安装 Pandoc，并确认：

```bash
pandoc --version
```

macOS 如果使用 Homebrew：

```bash
brew install pandoc
```

没有 Pandoc 时，本项只能记录为“阻塞”，不能记为通过。

### 5.2 准备文件

```bash
mkdir -p .codex-smoke/manual-pandoc
cat > .codex-smoke/manual-pandoc/citation-demo.md <<'MD'
---
title: Prism 引用导出 Smoke
author: Prism QA
---

# Prism 引用导出 Smoke

中文正文引用一本书 [@doe2024]，并引用另一篇文章 [@smith2023, p. 12]。

普通邮箱 jane@example.com 不应该被识别成引用。
[邮件链接](mailto:jane@example.com) 也不应该触发引用。

## 普通 Markdown 保真

- 列表项
- **粗体** 与 `inline code`

| 项目 | 结果 |
| --- | --- |
| citeproc | 期望生成引用 HTML |
MD

cat > .codex-smoke/manual-pandoc/library.bib <<'BIB'
@book{doe2024,
  title = {Local First Markdown Writing},
  author = {Doe, Jane},
  year = {2024},
  publisher = {Prism Press}
}

@article{smith2023,
  title = {Reliable Export Pipelines},
  author = {Smith, John},
  journal = {Desktop Writing Review},
  year = {2023},
  volume = {7},
  number = {2},
  pages = {10-20}
}
BIB
```

### 5.3 成功路径

1. 启动最新 `Prism.app`。
2. 打开 `.codex-smoke/manual-pandoc/citation-demo.md`。
3. 打开设置中心。
4. `Pandoc 路径` 留空，或填写 `which pandoc` 输出的绝对路径。
5. `参考文献文件` 选择 `.codex-smoke/manual-pandoc/library.bib`。
6. `CSL 样式文件` 可留空。
7. 执行 `导出 -> HTML`，输出为 `.codex-smoke/manual-pandoc/citation-demo.html`。
8. 用浏览器打开 HTML。

通过标准：

- 正文不再出现原始 `[@doe2024]`、`[@smith2023, p. 12]`。
- 页面出现 `Doe`、`Smith`、`Local First Markdown Writing`、`Reliable Export Pipelines`。
- 普通邮箱和 `mailto:` 没有被当成引用。
- 标题、列表、表格仍正常渲染。
- 没有出现 Pandoc 回退 warning。

### 5.4 回退路径

1. 在设置中心把 `Pandoc 路径` 改成不存在的路径。
2. 再次导出 HTML。

通过标准：

- HTML 仍能生成。
- citekey 以占位形式保留。
- UI warning 或诊断说明 Pandoc 不可用。
- 应用不崩溃，导出流程可继续使用。

## 6. Windows 人工 smoke

对应分项文档：`docs/verification/prism-windows-release-smoke.md`

本项必须在 Windows x64 机器或可信 Windows CI 上做。macOS 不能替代。

### 6.1 构建与产物

PowerShell：

```powershell
npm ci
npm test -- --run
npm run build
$key = Join-Path $HOME ".tauri\prism-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw -LiteralPath $key
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri:build
```

通过标准：

- Windows 安装器或明确标注的绿色版存在。
- updater `.sig` 存在且非空。
- 版本号正确。
- `latest.json` Windows 平台条目指向真实 release asset。

### 6.2 安装、文件关联、路径

操作：

1. 全新安装 Prism。
2. 从开始菜单启动。
3. 双击 `.md` 和 `.markdown` 文件。
4. 用“打开方式”选择 Prism。
5. 在 Prism 中执行复制路径、在资源管理器中显示。
6. 从文件树删除一个临时 Markdown 文件。

通过标准：

- 双击 Markdown 文件能打开到正确文档。
- 当前文档和工作区根目录正确。
- Windows 反斜杠路径不被错误改写。
- 资源管理器能定位文件或文件夹。
- 删除默认进入回收站；如果失败，必须二次确认永久删除。

### 6.3 Windows 写作路径

操作：

1. 测试 `Ctrl+N`、`Ctrl+O`、`Ctrl+S`、`Ctrl+F`、`Ctrl+B`、`Ctrl+I`。
2. 测试 `F8` 专注模式、`F9` 打字机模式、`F11` 全屏。
3. 从 Explorer 拖入图片。
4. 按住 Alt 从 Explorer 拖入图片。
5. 导出 HTML / PDF / PNG / DOCX 到用户目录。

通过标准：

- 快捷键符合 Windows 预期。
- 图片粘贴和拖拽写入当前文档旁 assets。
- Alt 原路径路径语义正确，或路径不可读时提示明确。
- 四种导出产物非空，能被系统或常用软件打开。

记录模板：

```text
Windows 版本：
Prism 版本 / commit：
安装器路径：
updater .sig：
latest.json 条目：
文件关联：
Explorer 拖拽：
Alt 原路径：
回收站删除：
四格式导出：
结论：
```

## 7. Apple 签名、公证和 updater 发布前人工检查

本项不是普通功能 smoke，而是发布可信验证。没有 Developer ID 证书、公证权限、updater 私钥时，记录为“阻塞”。

### 7.1 构建

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat /path/to/prism-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri:build
```

通过标准：

- `.app`、`.dmg`、`.app.tar.gz` 或对应 updater 产物生成。
- updater signature 生成。
- 没有因为私钥缺失、公证权限或 Finder AppleScript 布局超时失败。

### 7.2 签名与公证

检查：

```bash
codesign --verify --deep --strict --verbose=2 path/to/Prism.app
spctl --assess --type execute --verbose path/to/Prism.app
```

通过标准：

- `codesign` 验证通过。
- `spctl` 不拒绝应用。
- DMG 下载后首次打开不出现无法验证开发者的阻断提示。
- updater manifest 指向真实 release asset 和真实 signature。

## 8. 最终记录位置

完成后把结果追加到对应文档：

- Finder / Explorer 图片拖拽：`docs/verification/prism-writing-efficiency-smoke.md`
- 30 秒输入性能：`docs/verification/prism-preview-sync-smoke.md`
- Pandoc citeproc：`docs/verification/prism-pandoc-citation-html-smoke.md`
- Windows：`docs/verification/prism-windows-release-smoke.md`
- Apple 发布：`docs/verification/prism-macos-dmg-packaging-smoke.md` 或 `docs/prism-macos-release.md`
- 总体状态：`docs/verification/prism-1.0x-core-closure-audit.md`

追加记录后，至少执行：

```bash
git diff --check
```

如果只改 smoke 记录，提交时可以使用：

```bash
git add docs/verification
git commit -m "记录人工 smoke 结果" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
git push
```

## 9. 通过 / 阻塞判定

可以判定为通过：

- 人工真实操作完成。
- 产物或截图可复查。
- 失败路径有明确提示且符合预期。

必须判定为阻塞：

- 没有 Windows 环境却要验证 Windows。
- 没有 Pandoc 却要验证 citeproc。
- 没有 Developer ID / updater 私钥却要验证签名、公证、正式 updater。
- 自动化工具不能真实完成 Finder / Explorer 跨应用拖拽。

必须判定为未通过：

- 真实操作能复现产品错误。
- 无提示静默失败。
- 文件丢失、路径错写、导出空文件、预览长时间空白。
- 应用崩溃或保存状态错误。
