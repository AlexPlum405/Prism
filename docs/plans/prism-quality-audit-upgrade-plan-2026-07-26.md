# Prism 质量审计与升级计划（详细版）

> 日期：2026-07-26
> 来源：与维护者的方案讨论、`CONTEXT.md`、`docs/plans/prism-optimization-plan-2026-06-17.md`、`docs/verification/` 既有基准与 smoke 记录。
> 目标：把"总觉得不够好"（性能 / 功能 / UI）转化为**有证据、有排序、可增量执行**的升级路线，并固化一套可重复的"审计 → 排序 → 修复 → 验证"循环。

---

## 0. 与既有决策的关系

本计划不推翻任何已确认决策，以下约束全程有效：

1. Prism 是 Markdown-first 单活动文档写作器（ADR-0006/0007，`CONTEXT.md` 术语表）。审计发现的功能差距若与该定位冲突（如插件市场、云同步、AI 写作、完整 block editor），进入 Not-now 清单，不进入升级队列。
2. **真实预览性能基准是 P0 前置**：预览渲染策略类改动（分阶段 DOM commit、渐进 hydrate 等）必须先由真实 Tauri WebView 基准证明瓶颈，不接受仅 jsdom/Node 证据（`CONTEXT.md` "真实预览性能基准"节）。
3. `CONTEXT.md` "优化实施顺序"中的 12 项增量路线继续有效；本计划的产出与其合并排序，而不是另起一条平行路线。
4. 每项改动遵守四个完成标准：功能可用、视觉不破坏、已有功能不回退、有最小验证。
5. macOS 1.0 发布门槛与发布信心包的约束优先级高于本计划中的非阻塞优化项。

## 0.1 现有基建盘点（本计划直接复用，不重建）

| 基建 | 位置 | 状态 | 本计划中的用途 |
|---|---|---|---|
| 真实 WebView 基准 | `scripts/run-preview-webview-benchmark.mjs` | 上次运行 2026-06-17（1MB/3MB fixture，测打开/滚动/搜索/右键） | 阶段一渠道 1 的核心工具；更新报告日期后重跑，得到当前基线 |
| Node 侧性能测试 | `src/app/documentDiagnostics.performance.test.ts` 等 | 随 vitest 运行 | 快速回归信号（非发布证据） |
| 历史性能基线 | `docs/verification/prism-performance-baseline-2026-05-30.md`、`prism-preview-webview-benchmark-2026-06-17.{md,json}` | 已归档 | 对比参照，判断趋势 |
| 全功能测试用例 | `docs/verification/prism-full-functional-test-cases.md` | 已有 | 功能审计的检查底稿 |
| Issue tracker | GitHub Issues（AlexPlum405/Prism）+ triage 标签 | 已有规范（`docs/agents/issue-tracker.md`、`triage-labels.md`） | 所有审计发现的统一汇入口 |
| Superpowers 工作流 | brainstorming → writing-plans → executing-plans | 已有规范 | 阶段三每轮修复的执行框架 |
| 视觉快照脚本 | `scripts/run-theme-visual-snapshots.mjs`、`run-shell-density-snapshots.mjs`、`run-preview-typography-snapshots.mjs` | 已有 | UI 审计与回归证据 |
| 多视角评审 | `docs/reviews/prism-multi-perspective-review-2026-06-16.md` | 已有 | 避免重复发现已知问题 |

---

## 1. 阶段一：系统性问题发现（目标 1~2 周）

四条渠道并行，各自产出**写入磁盘的证据文档 + GitHub Issues**。

### 渠道 1：性能审计（客观测量）

**目标**：为每个关键场景建立"当前数字"，替代"感觉卡"。

#### 1.1 指标与目标值

| # | 指标 | 测量方式 | 参考目标 |
|---|---|---|---|
| P-1 | 冷启动到可输入 | WebView 基准（app 启动 → 编辑器 focus） | < 1.5s |
| P-2 | 打开 1MB Markdown（编辑模式） | 现有 WebView 基准 | < 500ms |
| P-3 | 打开 3MB Markdown（编辑模式） | 现有 WebView 基准 | < 1.5s |
| P-4 | 切换到预览 / 分栏（1MB/3MB） | 现有 WebView 基准 | < 1s / < 3s |
| P-5 | 大文档滚动流畅度 | 现有 WebView 基准（scroll action 耗时） | 无长帧（>50ms）连续出现 |
| P-6 | 预览内搜索 | 现有 WebView 基准（search action） | < 300ms |
| P-7 | 输入延迟（大文档连续输入） | vite dev + Chrome DevTools trace（JS 侧）；WebView 侧观察值 | p95 < 16ms（JS 侧） |
| P-8 | 编辑 → 预览刷新延迟（分栏） | DevTools trace + 目测帧 | < 100ms（普通段落） |
| P-9 | 重公式/重图表文档（500 KaTeX / 30 Mermaid） | 新增 torture fixture | 打开可交互 < 3s，渲染渐进不冻结 |
| P-10 | 大工作区文件树（2000+ 文件） | fixture 工作区 + 现有测试 | 首次加载 < 1s，切换文档不卡 |
| P-11 | 长时间使用内存 | 堆快照 ×3（打开→重度操作→关闭文档后） | 关闭文档后可回收，无单调增长 |
| P-12 | 导出耗时与峰值内存（1MB 文档 → PDF/HTML/DOCX/PNG） | 手动计时 + 活动监视器 / Instruments | 记录基线，暂不设目标 |

#### 1.2 执行步骤

1. **重跑真实 WebView 基准**：
   - 更新 `run-preview-webview-benchmark.mjs` 中的报告输出路径为 2026-07-26。
   - `npm run macos:build-fast` 构建当前分支的 `.app`，重跑基准。
   - 与 2026-06-17 报告逐项对比，标注回归/改善。
2. **新增 torture fixtures**（补现有基准未覆盖的形态）：
   - `heavy-katex.md`：500+ 行内公式 + 50 块级公式。
   - `heavy-mermaid.md`：30 个 Mermaid 图（含大 flowchart / sequence）。
   - `heavy-table.md`：200 行 × 12 列大表 + 深层嵌套列表。
   - `mixed-long.md`：1MB 混合真实长文（标题层级、代码块、图片引用、Callout、Toggle）。
   - 生成脚本落 `scripts/generate-perf-fixtures.mjs`，产物写入 `.codex-smoke/`（不进 git），文档内容确定性可复现。
3. **JS 侧 trace**（vite dev + Chrome DevTools）：定位输入延迟、预览重渲染、字号调整等交互的 JS 热点。**注意**：此为定位手段，不作为预览策略改动的发布证据（见约束 2）。
4. **内存**：DevTools 堆快照三点采样 + 长时操作后对比；如需 Rust 侧证据，用 Instruments（Time Profiler / Allocations）挂 `tauri dev`。
5. **产出**：`docs/reviews/prism-perf-baseline-2026-07-26.md` —— 指标表（当前值 vs 目标值 vs 2026-06-17 值）、火焰图/快照证据路径、每个未达标项开一条 issue（标签 `perf` + `needs-triage`）。

### 渠道 2：竞品功能与体验差距审计

**目标**：产出"差距清单"，其中"有但体验差"的项优先于"没有"的项。

- 对标对象：**Typora、妙言（MiaoYan）、iA Writer**（主对标）；Obsidian 仅对照链接/反链/图谱部分（与 `CONTEXT.md` 轻量图谱边界互核）。
- 对比维度（行）：
  1. 编辑核心：表格编辑体验、图片粘贴与本地管理、查找替换、多光标、大纲导航、字数目标、拼写检查、Vim/Emacs 键位。
  2. 预览与排版：主题数量与质量、自定义 CSS、打字机/专注模式细节、数学/图表覆盖。
  3. 文件与工作区：文件树体验、快速打开、全局搜索、最近文件、文件监听外部变更。
  4. 导出：格式覆盖、保真度、样式模板、批量导出。
  5. 系统集成：文件关联、拖放、URL scheme、快速预览（QuickLook）、菜单栏完整性。
  6. 打磨细节：首启体验、空状态、偏好设置组织、更新机制、崩溃恢复。
- 每格取值：`有/无/有但体验差/超出（Prism 更好）/超出定位（不做）`。
- Prism 侧现状**必须对照代码与真实 app 确认**，不凭印象填写。
- **产出**：`docs/reviews/prism-competitor-feature-matrix-2026-07-26.md` —— 矩阵 + 差距清单（按"有但体验差 > 缺失高频 > 缺失低频"排序）+ 每条差距一条 issue（标签 `feature` 或 `ui`）。

### 渠道 3：Dogfooding（真实使用摩擦记录）

- **规则**：接下来两周所有 Markdown 写作只用 Prism（包括本计划的执行笔记）。
- 每次摩擦立刻 `gh issue create --label needs-triage`，一句话现象 + 触发场景即可，**只记不修**。
- 建议记录模板：`[dogfood] 现象一句话`，body 写：做什么时发生 / 期望 / 实际。
- 两周后统计：重复出现 ≥2 次的摩擦自动升为高优先级。
- 此渠道由维护者本人执行，AI 协作者不代填。

### 渠道 4：代码质量与架构审计（可选，随阶段一并行）

- 用 code review 流程扫高风险模块：保存/恢复链路、导出管线、工作区索引、窗口管理。
- 关注点：缺测试的关键路径、过度复杂组件（>500 行 / 多职责）、Rust 命令层错误处理一致性、React 重渲染热点。
- **产出**：`docs/reviews/prism-code-audit-2026-07-XX.md` + issue（标签 `quality`）。此渠道产出主要影响"改起来快不快"，排序时权重低于用户可感知问题。

---

## 2. 阶段二：归类与排序（1~2 天，阶段一收尾后集中做）

1. **汇总**：四条渠道所有发现均已是 GitHub Issues；补打维度标签 `perf` / `feature` / `ui` / `quality`。
2. **打分**：每条 issue 按 影响(1~3) × 频率(1~3) 打分，写进 issue body；≥6 分为高优先级。凭直觉打分即可，不搞复杂模型。
3. **与既有路线合并**：
   - 落在 `CONTEXT.md` 12 项增量顺序上的 → 并入对应项。
   - 不在线上的高分项 → 按分数插入队列。
   - 与产品边界冲突的 → 关闭并注明 `wontfix` + 理由。
4. **产出**：`docs/plans/prism-upgrade-backlog-2026-08.md` —— 排序后的 20~30 条升级清单，每条含：问题、证据链接（基准数字 / 矩阵行 / dogfood issue）、预估规模（S/M/L）、验收标准。

## 3. 阶段三：增量升级循环（长期节奏）

每轮循环（建议 1~2 周一轮）：

```
取 backlog 前 2~3 项
  → superpowers 工作流（brainstorming → writing-plans → executing-plans）
  → 跑相关测试 + 性能基准（确认无回归）
  → 自用验证（dogfood 场景重演）
  → 关 issue，更新 backlog，进下一轮
```

**硬性纪律**：

1. 性能类改动必须有前后数字（基准报告 diff），"感觉快了"不算完成。
2. UI 类改动改前后跑视觉快照脚本，截图存 `docs/verification/` 对应目录；对齐令牌体系（ADR-0008），不新增 OpenAI-only token。
3. 预览渲染策略类改动必须先有真实 WebView 基准证据（约束 2）。
4. 每 3~4 轮重跑一次阶段一的性能基准与矩阵复核（此时成本已很低），重排 backlog。
5. 单轮不混做超过 1 个高风险链路（保存/导出/索引/文件关联）。

## 4. 时间线

| 周 | 内容 |
|---|---|
| 第 1 周 | 渠道 1 性能基准重建完成；渠道 2 竞品矩阵完成；渠道 3 dogfooding 开始 |
| 第 2 周 | 渠道 3 持续；渠道 4 代码审计；补测阶段一遗漏项 |
| 第 2 周末 | 阶段二集中 triage，产出 backlog |
| 第 3 周起 | 阶段三循环启动 |

## 5. 本次会话立即执行项（2026-07-26）

1. ✅ 本计划落盘（本文档）。
2. 性能基准重建：更新基准脚本报告日期 → 构建 `.app` → 重跑 WebView 基准 → 跑 Node 侧性能测试 → 产出 `docs/reviews/prism-perf-baseline-2026-07-26.md`。
3. 竞品矩阵：调研 Typora / 妙言 / iA Writer 当前功能 → 对照代码确认 Prism 现状 → 产出 `docs/reviews/prism-competitor-feature-matrix-2026-07-26.md`。
4. Torture fixtures 生成脚本 `scripts/generate-perf-fixtures.mjs`。

## 6. 风险与边界

- 当前分支 `codex/prism-full-optimization` 有大量未提交改动；本次基线测的是**当前工作区状态**，报告中须注明 git 状态，避免与已发布版本混淆。
- WebView 基准会启动打包后的真实 app 并临时改写 `~/Library/Application Support/com.prism.editor.v1/config.json`（脚本自带备份恢复）；运行期间不要手动操作 Prism。
- 竞品功能矩阵是差距参照，不是抄袭清单；任何"补齐"决策仍受写作器定位约束。
- 本计划文档本身按需更新；阶段二产出的 backlog 是后续执行的唯一权威队列，避免多份清单并存。
