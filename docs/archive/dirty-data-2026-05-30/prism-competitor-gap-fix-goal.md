# Prism 竞品差距补齐 `/goal`

> 状态：待实施
> 日期：2026-05-30
> 背景报告：`docs/prism-vs-competitors-benchmark-2026-05-30.md`
> 说明：本 goal 只针对竞品评测识别出的「真实短板」5 条，**不触碰**「故意不做」的非目标（插件系统、知识库宇宙、云同步、AI 写作平台）。补齐这些非目标会违背 `CONTEXT.md` 的本地优先单文档写作器定位。

## 五条短板与对应 Phase

| Phase | 短板 | 现状 | 工作量 |
|:--:|---|---|---|
| 1 | Toggle 渲染闭环 | 能插入 `<details>`，预览/导出未验证 | 小 |
| 2 | `[[` 页面链接 | 索引/反链/图谱已就绪，缺输入入口 | 中 |
| 3 | 导出保真验证 | 四格式广度够，保真度缺实战检验 | 中 |
| 4 | 性能实测 | 仅架构推断，无同机基准 | 中 |
| 5 | 成熟度收口 | 核心写作链路缺端到端回归 | 大（本轮取可交付部分） |

执行顺序按性价比：1 → 2 → 3 → 4 → 5。

## 可直接复制的 goal

```text
/goal 在 /Users/Alex/AI/project/Prism 中，一次性补齐竞品评测识别出的 5 条真实短板，对应 Phase 1 到 Phase 5。

开始前先读：CONTEXT.md、CLAUDE.md、docs/adr/、docs/prism-vs-competitors-benchmark-2026-05-30.md、现有 src/domains/editor/extensions/slashMenu.ts 与 callouts.ts、src/lib/markdownToHtml.ts、src/domains/export/exportPipeline.ts、src/domains/workspace/services/ 工作区索引、当前 git status、当前 git diff、最近 git log --oneline -20。

总目标：把 5 条短板从「缺口/未验证」推进到「已实现并验证」，且全程保持 Prism 本地优先、单文档单窗口、Markdown 源码可见、当前妙言风格和既有用户功能不回退。

Phase 1（Toggle 渲染闭环，对应短板②）：核查 rehype-raw 是否已让 <details>/<summary> 进入预览；在五套内容主题（miaoyan/inkstone/slate/mono/nocturne）补折叠样式（箭头、间距、与主题协调）；验证导出三格式——HTML 原生支持、PDF 展开态、DOCX 降级为展开文本；在 markdownToHtml 增 details 用例。完成后把状态从「部分实现」提到「已实现」。

Phase 2（[[ 页面链接，对应短板①）：在 src/domains/editor/extensions/ 新建 pageLink.ts，参照 slashMenu.ts 的 CodeMirror 触发器模式；监听 [[ 输入，复用工作区索引查询文件名与文档内标题；复用 slashMenu 菜单 UI（上下选择/Enter 插入/Esc 关闭/输入过滤，如 [[mer 过滤）；插入时计算相对路径，按 CONTEXT.md 约定生成标准 Markdown 链接 [文档名](relative/path.md) 或 [标题](path.md#heading)，不引入私有 wiki link 存储；保持预览侧已存在 [[文档名]] 的识别跳转兼容（只读不强制改写）。新增 pageLink.test.ts 覆盖触发、过滤、相对路径生成、插入文本。

Phase 3（导出保真验证，对应短板③）：在 docs/examples/ 建导出黄金样本，含 Mermaid、KaTeX、嵌套代码、宽表格、本地图片、Callout、Toggle、长文分页的混合文档；四格式各导一遍人工核保真，重点验 CONTEXT.md 硬要求——图片/渲染块不被分页切断、PDF/PNG 高清不降清、DOCX 中 Mermaid PNG-first、图片链接保留；把可断言部分（产物非空、结构正确、无异常）做成自动回归；剩余缺陷记入 docs/verification 并开 issue。

Phase 4（性能实测，对应短板④）：npm run tauri:build 出 release 包，量安装包体与解压体积；测冷启动到可编辑、空载常驻内存；用大 Markdown 文档（约 1 万行，含 Mermaid/KaTeX/表格）测输入延迟、滚动、预览刷新；数字写回 docs/prism-vs-competitors-benchmark-2026-05-30.md 的性能维度，标注采集环境（机型/OS/版本），把该维度从「架构推断」改「实测」。诚实要求：若实测性能不理想，如实记录并下调报告评分，不粉饰；若发现 React 端大文档瓶颈，记入 verification 待后续单独立项，不在本 goal 内展开重构。

Phase 5（成熟度收口，对应短板⑤，本轮取可交付部分）：盘点 142 测试文件的覆盖盲区，优先补核心写作链路（编辑→保存→导出）的端到端用例；把 docs/ 现有 smoke/checklist 固化为可复跑回归；收口本轮改动引入或暴露的已知 bug，稳定优先于加新功能。本 goal 不追求无限投入，只交付「核心链路 e2e + smoke 固化 + 本轮 bug 收口」，更广的成熟度建设留给后续。

范围边界：不引入完整 WYSIWYG、云同步、移动端、实时协作、Notion database、Obsidian 式插件市场、AI 写作平台或未经确认的新外部依赖。Phase 2 必须用标准 Markdown 链接而非私有 wiki link 存储。不 reset、checkout、revert 或覆盖无关脏改；当前存在图标资产改动和本地裁图产物，必须先识别，只提交本 checkpoint 相关文件。

执行方式：按 Phase 小步推进，但目标是一次性跑完 5 个 Phase。每个 Phase 开始前汇报目标、影响文件、风险等级和精确验证命令；完成后更新必要 docs/verification 证据，说明改动、验证结果、跳过哪些重验证及原因、剩余风险。验证通过且可安全提交时立即 commit（commit message 用中文），但**不要 push**——5 个 Phase 全部完成后停下来，汇总所有 commit hash 等待用户确认，由用户决定何时 push 到 origin/main。

验证分层：文档改动只跑 git diff --check；TS/React 小改跑相关测试 + npm run build + git diff --check；编辑器、导出、命令系统、工作区改动跑相关测试 + npm test -- --run + npm run build + git diff --check；涉及 Tauri/Rust/真实 app 路径的改动补 cargo check 并跑 npm run tauri:build:app-smoke；Phase 4 的 release 构建跑 npm run tauri:build。

重点验收：Toggle 在五套主题预览正确折叠、三格式导出行为符合预期；[[ 输入弹出搜索、插入标准 Markdown 链接、跨目录跳转正确、pageLink.test.ts 通过；导出黄金样本四格式高清保真、复杂块不被分页切断、回归用例入库；性能实测数字写回报告并标注环境；核心写作链路 e2e 用例通过、smoke 固化为可复跑回归。

完成条件：Phase 1 到 Phase 5 全部完成或只剩明确外部阻塞；最终 npm test -- --run、npm run build、git diff --check 通过，涉及 Tauri 路径处 npm run tauri:build:app-smoke 通过；docs/prism-vs-competitors-benchmark-2026-05-30.md 性能维度已更新为实测；必要 verification 文档已更新；所有可提交改动已 commit（**不要 push**）；最终停下来汇总每个 Phase 完成情况、全部 commit hash、验证证据、跳过项原因和剩余风险，等待用户确认后再由用户决定是否 push 到 origin/main。

暂停条件：需要改变产品定位、需要破坏性 git 操作、需要新增高风险外部依赖、需要凭据/签名/发布权限、存在用户数据安全风险、或 Phase 2/3 实现与当前工作区索引或导出管道现实发生重大冲突时，暂停并说明可选方案。
```
