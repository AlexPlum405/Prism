# Prism 全功能截图 + 全功能测试报告（2026-06-22）

## 总体结论

本轮在 macOS 上对 `/Applications/Prism.app` 做了真实 UI 截图验收。App 身份已确认：`CFBundleIdentifier=com.prism.editor.v1`，截图均通过 CoreGraphics 按 `owner=Prism/name=Prism` 的窗口 ID 捕获，避免复用旧截图或截错应用。

本轮没有完成原计划的全部 P0/P1/P2 真执行。已形成一套可复核证据：`113` 张截图、`113` 条 manifest 记录、`fixtures/` 测试 workspace、失败/风险清单。未执行项已在本报告和 `issues.md` 中明确列出，不伪造 Windows/Linux 或未操作功能的结果。

补充说明：macOS `System Events` 中 Prism 的 Tauri 进程名可能显示为 `app`，但截图前通过 Computer Use 确认 bundle id 为 `com.prism.editor.v1`，截图脚本按 CoreGraphics `owner=Prism/name=Prism` 的窗口 ID 捕获。

## 执行统计

| 维度 | 计划数 | 已执行/有截图 | Pass | Fail | Needs review | Not executed / Blocked |
|---|---:|---:|---:|---:|---:|---:|
| P0 | 88 | 85 | 79 | 2 | 4 | 3 |
| P1 | 75 | 25 | 24 | 0 | 1 | 50 |
| P2 | 10 | 3 | 3 | 0 | 0 | 7（其中 Windows/Linux/跨平台字体 5 条为 no device） |
| 合计 | 173 | 113 | 106 | 2 | 5 | 60 |

## 已覆盖重点

- Shell：空状态、标题栏已保存/未保存、快速打开、全文搜索、编辑区右键、选区右键、成功 toast、错误 toast。
- File：Markdown/JSON/SQL/TXT 打开、文件树、文件夹展开折叠、文件右键、工作区菜单、内联重命名、最近文件、在访达中显示、文件/大纲 tab。
- Document：源码/分栏/预览、长文档顶部/中段/底部、文档搜索、替换面板、单次替换、专注模式、打字机模式入口、自动换行入口、预览错误态。
- Editing：选区浮动工具栏、行内格式、插入链接、Wiki 补全、插入图片、Slash 菜单、Callout 选择器、任务列表、代码块。
- Preview：基础排版、代码、表格、引用/callout、KaTeX、Mermaid、正常图片、缺失图片、暗色主题、front matter、脚注、wikilink、5 个主题状态。
- Table：插入表格 popover、网格尺寸提示、表格工具栏、表格右键、复制格式菜单。
- Knowledge：属性、非法 YAML、出链、反链、图谱按钮有/无、图谱面板、大纲、链接/图片诊断。
- Export：Markdown 可导出、JSON/SQL 禁用态、导出设置基础、导出中、导出成功文件生成、导出失败预检、取消导出、上次导出禁用、页眉页脚字段、DOCX 字体、HTML 包含主题、导出清晰度控件。
- Settings：通用、写作、外观、导出、引用、文件 6 个分区，Pandoc ready 状态。
- Help/Menu：快捷键、关于、检查更新触发态、9 个菜单分组。
- Platform：macOS 标题栏、窄窗口、低高度窗口。

## 最高优先级问题

1. `ISSUE-001`：选区右键菜单没有进入可复制/可链接状态（`TC-P0-010`，P0）。
2. `ISSUE-002`：表格复制格式缺少 CSV/TSV（`TC-P0-062`，P0）。
3. `ISSUE-006`：本轮未完成全部 P0/P1 真执行覆盖（测试交付风险，P0）。
4. `ISSUE-003`：多类浮层/菜单对 Esc 关闭反馈不一致（P1）。
5. `ISSUE-004`：通用命令面板未找到可见入口（P1）。
6. `ISSUE-005`：检查更新只捕获到检查中，未确认最终态（P1）。
7. `ISSUE-011`：行号入口未找到，TC-P0-038 只能验证自动换行（P1）。
8. `ISSUE-012`：导出成功文件已生成，但成功 toast 未捕获（P1）。
9. `ISSUE-007`：Windows/Linux 真机验证缺失（P2）。
10. `ISSUE-010`：打字机模式只验证入口，未完成连续输入跟随验证（P2）。

## 未覆盖风险

- P0 未执行的高风险区：saving 状态、命令面板默认态/筛选。
- P0 需复核项：打字机模式只验证入口和布局，行号/自动换行只验证到自动换行入口，导出成功只验证到文件生成但未捕获成功 toast，检查更新只捕获到检查中。
- P1 未执行的高风险区：模板、TOC/YAML/details、表格排序/转换、图谱深度/搜索/节点交互、导出保存面板/取消/preflight、主题/字体导入、Pandoc detecting/not-ready、帮助外链最终动作。
- P2 未执行：macOS 全屏/最小化恢复；Windows/Linux 标题栏和文件关联；跨平台字体 fallback。

## 路径

- 截图目录：`docs/reviews/prism-full-feature-test-2026-06-22/screenshots/`
- 测试 fixture：`docs/reviews/prism-full-feature-test-2026-06-22/fixtures/`
- Manifest：`docs/reviews/prism-full-feature-test-2026-06-22/manifest.json`
- Issues：`docs/reviews/prism-full-feature-test-2026-06-22/issues.md`

## 建议验证命令

```bash
git status --short --branch
plutil -p /Applications/Prism.app/Contents/Info.plist | rg 'CFBundleIdentifier|CFBundleName'
find docs/reviews/prism-full-feature-test-2026-06-22/screenshots -type f -name '*.png' | sort
find docs/reviews/prism-full-feature-test-2026-06-22/screenshots -type f -name '*.png' | wc -l
node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('docs/reviews/prism-full-feature-test-2026-06-22/manifest.json','utf8')); console.log(m.cases.length, m.policy.screenshotCount); if(m.cases.length!==m.policy.screenshotCount) process.exit(1)"
rg -n "TC-P0-|TC-P1-|TC-P2-" docs/reviews/prism-full-feature-test-2026-06-22/manifest.json
rg -n "Fail|Blocked|Not executed|Needs review" docs/reviews/prism-full-feature-test-2026-06-22
git diff --check
```
