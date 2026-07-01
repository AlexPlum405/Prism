# Blocked Burn-down Report - 2026-07-01

## 本轮目标

按附件计划先闭环唯一 P0 Blocked：`PRISM-FF-026 复制为多格式`。本轮不从头重跑全量测试，不伪造 Windows/Linux、权限拒绝、破坏性操作或压力测试结果。

## 结果

- `PRISM-FF-026`：Blocked -> Pass
- 总计：Pass 140 / Fail 0 / Blocked 28 / Not Run 0
- P0：Pass 88 / Fail 0 / Blocked 0 / Not Run 0

## 代码变更

- `src/domains/editor/runtime/editorCommandAdapter.ts`
  - 普通 `copy` 改为写入 Markdown 源文本 `text/plain` 与渲染后的 `text/html`。
  - `copyPlain` / `copyMd` 保持纯 Markdown 文本。
  - `copyHtml` 显式 HTML 复制在缺少 rich clipboard API 时回退 HTML 源码。
- `src/domains/editor/extensions/richCopy.ts`
  - `writeRichClipboard` 增加 fallback 策略，普通富复制默认回退 plain text，显式 HTML 复制可回退 HTML source。
- `src/domains/editor/components/SplitView.tsx`
  - 预览态 `copyHtml` 使用 HTML fallback。
- `src/domains/editor/components/useEditorTableModel.ts`
  - 表格 HTML 复制使用 HTML fallback。

## 真实安装版证据

Fixture：

```text
docs/verification/runs/prism-full-functional-2026-06-27/fixtures/blocked-burn-down/rich-copy-multi-format.md
```

验证动作：

```text
1. 替换 /Applications/Prism.app。
2. 用真实安装版打开 fixture。
3. 执行 Cmd+A / Cmd+C。
4. 用 Swift 读取 NSPasteboard.general。
```

剪贴板类型：

```text
public.html
Apple HTML pasteboard type
public.utf8-plain-text
NSStringPboardType
com.apple.WebKit.custom-pasteboard-data
```

内容摘要：

```text
plain-length: 259
html-length: 2989
html-has-strong: true
html-has-link: true
html-has-table: true
```

证据：

- `screenshots/36-blocked-burn-down/PRISM-FF-026-copy-installed-app.png`
- `logs/blocked-burn-down-20260701/prism-ff-026-copy-installed-app.log`

## 自动化验证

```bash
npm test -- --run src/domains/editor/runtime/editorCommandAdapter.test.ts src/domains/editor/extensions/richCopy.test.ts src/domains/editor/components/useEditorCommandEventModel.test.tsx src/domains/editor/components/EditorPane.integration.test.tsx
npm run build
npm run tauri:build:app-smoke
```

结果：

- Vitest：4 个测试文件 / 53 条测试通过。
- Build：通过。
- App smoke：12 个步骤全部 pass，报告见 `logs/app-smoke-blocked-burn-down-20260701/report.json`。

## 剩余范围

下一阶段按附件计划进入可自动化 Blocked 降噪，优先：

- `PRISM-FF-092` 工作区导航 dirty guard
- `PRISM-FF-094` 文件夹授权失败
- `PRISM-FF-135` 设置持久化错误
- `PRISM-FF-138` Error Boundary
- `PRISM-FF-162` Worker 降级
- `PRISM-FF-118` 索引任务取消

破坏性/权限类测试仍需独立沙盒；Windows/Linux 继续保持真机回填，不伪造验证。
