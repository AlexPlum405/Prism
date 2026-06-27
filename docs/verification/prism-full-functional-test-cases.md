# Prism 全功能测试用例集

> 版本：2026-06-27  
> 适用对象：Prism Tauri 桌面应用、前端 Vitest 单元/集成测试、真实 App 人工回归。  
> 产品口径：Prism 是本地优先、Markdown-first、单活动文档窗口的跨平台写作器。Markdown Document 与 Text Document 能力边界按 ADR-0007 执行。

本文档是标准测试用例集，不是一次执行报告。执行结果、截图、失败项和产物路径应写入单独的回归报告或 manifest。

## 测试分层

| 类型 | 说明 | 推荐执行方式 |
|---|---|---|
| UT | 纯函数、store、命令注册、渲染/导出转换、索引计算 | `npm test -- --run` 或单文件 Vitest |
| INT | React 组件、hook、命令流、文件/导出服务 mock 集成 | Vitest + React Testing Library |
| APP | 真实 Tauri App、系统文件权限、窗口、菜单、文件关联 | `npm run tauri:build:app-smoke` 后人工/脚本验证 |
| VIS | 视觉/截图验收 | 真实 App 截图，记录主题、窗口尺寸、平台 |
| PERF | 性能与稳定性 | 真实 WebView 长文档、导出、滚动、输入基准 |

## 执行前置

1. 记录 `git rev-parse --short HEAD`、`git status --short`、Prism 版本、平台、CPU 架构。
2. 执行基础自动化：`npm test -- --run`、`npm run build`。
3. 真实 App 验证优先使用本次构建产物：`npm run tauri:build:app-smoke`。
4. APP/VIS 用例必须记录截图或产物路径；环境缺失写“阻塞”，不要用推测结果替代。
5. Windows/Linux 文件关联、安装器、标题栏必须在真实平台验证，macOS 结果不能替代。

## 标准测试数据包

执行全功能测试前，在临时目录准备一个固定 workspace，避免每轮手工临时造数据导致结果不可比。

```text
prism-full-test-workspace/
  01-basic.md
  02-long-document.md
  03-rendering.md
  04-links/
    index.md
    target.md
    nested/deep-target.md
  05-frontmatter-invalid.md
  06-tables.md
  07-export.md
  08-presentation.md
  text/
    sample.txt
    data.json
    query.sql
    config.yaml
    env.env
  unsupported/
    app.ts
    style.css
  assets/
    local-image.png
    vector.svg
```

必备内容要求：

| 文件 | 必须包含 | 用途 |
|---|---|---|
| `01-basic.md` | 中文/英文段落、标题 H1-H4、列表、任务列表、引用、链接、脚注 | 基础编辑、预览、大纲、复制 |
| `02-long-document.md` | 至少 120 个二级标题、约 1MB 内容、多个 Mermaid/KaTeX 块 | 长文输入、滚动同步、搜索、性能 |
| `03-rendering.md` | 代码块、表格、Callout、Toggle、Mermaid、KaTeX、图片、缺失图片、非法 Mermaid/KaTeX | 渲染、诊断、导出保真 |
| `04-links/index.md` | 相对链接、标题锚点链接、断链、wiki link、外链、mailto | 出链、反链、图谱、诊断 |
| `05-frontmatter-invalid.md` | 一份合法 YAML front matter、一段故意非法 YAML | 属性面板、诊断、导出字段 |
| `06-tables.md` | 含中文、英文、空单元格、逗号、制表符、数字列的 Markdown 表格 | 表格编辑、排序、CSV/TSV 复制 |
| `07-export.md` | front matter、TOC、Callout、Toggle、Mermaid、KaTeX、本地图片、长表格 | HTML/PDF/PNG/DOCX 导出 |
| `08-presentation.md` | 至少 3 页 slide 分隔内容 | 演示模式 |
| `text/*` | 支持的 Text Document 扩展 | Text Document 能力边界 |
| `unsupported/*` | 不在白名单中的源码文件 | 文件关联和索引排除 |

每轮验收报告至少记录：workspace 路径、是否复用旧数据、是否重建数据、是否清空 appData、是否安装 Pandoc、是否具备 Windows/Linux 测试机。

## 覆盖矩阵

| 功能域 | P0 | P1 | P2 |
|---|---:|---:|---:|
| 启动、窗口、文件打开 | 12 | 8 | 3 |
| 文档编辑、保存、安全 | 12 | 6 | 2 |
| 视图、预览、渲染 | 12 | 7 | 3 |
| 工作区、搜索、导航 | 7 | 6 | 2 |
| Markdown 增强能力 | 18 | 10 | 2 |
| 导出、诊断、设置 | 14 | 5 | 3 |
| Shell、命令、平台发布 | 5 | 2 | 3 |

## P0 发布阻断用例

| ID | 类型 | 覆盖点 | 步骤 | 预期 |
|---|---|---|---|---|
| P0-001 | APP | 首次启动空状态 | 启动 Prism，不传 `file/folder/new/empty` 参数 | 窗口正常显示；无旧文档残留；空状态入口可见；无控制台致命错误 |
| P0-002 | APP | 新建 Markdown 文档 | 使用菜单/快捷键新建，在正文输入标题和段落 | 当前窗口无文档时直接创建；已有文档时新窗口创建；标题区显示未保存状态 |
| P0-003 | APP | 打开 Markdown 文件 | 通过打开对话框选择 `.md` | 文件内容进入编辑器；文件名、路径、最近文件和工作区上下文正确 |
| P0-004 | APP | 打开 Text Document | 分别打开 `.txt`、`.json`、`.sql` | 可编辑、保存、搜索；预览/导出/关系图谱入口不承诺 Markdown 能力 |
| P0-005 | APP | 系统启动打开文件 | 从 Finder/命令行以 `?file=` 或系统文件打开方式启动 | 指定文件优先于 last session；中文和空格路径正确解码 |
| P0-006 | APP | 多个系统打开文件 | 启动时传入多个 pending files | 第一个文件在当前窗口打开；其余文件进入新 Prism 窗口；失败有日志但不阻塞首文件 |
| P0-007 | APP | 打开文件夹工作区 | 打开包含 Markdown/Text/assets 的目录 | 文件树加载；目录权限已授权；根目录名和状态栏工作区信息正确 |
| P0-008 | INT | 单活动文档保护 | 当前文档 dirty 后从文件树打开其他文件 | 出现 dirty switch 确认；保存/丢弃/取消结果正确；不会静默丢稿 |
| P0-009 | APP | 最近文件 | 打开多个文件后重启或打开最近列表 | 最近文件去重、按最近打开排序；点击可打开；不存在文件有可理解失败反馈 |
| P0-010 | APP | 在文件管理器中显示 | 有当前文件和仅有工作区两种状态分别触发“在访达/文件管理器中显示” | 有文件时 reveal 文件；无文件但有工作区时打开目录；都没有时 toast 说明 |
| P0-011 | INT | 文档 profile 边界 | 以 `.md`、`.markdown`、`.json`、`.env`、`.ts` 构造 profile | Markdown/Text/unsupported 分类符合 ADR-0007；不把源码语言默认纳入产品承诺 |
| P0-012 | APP | 窗口新建/空窗口 | 触发新窗口、新建文档、空窗口参数 | 每个窗口只有一个活动文档；无标签页；窗口间状态不串扰 |
| P0-013 | APP | 基础编辑输入 | 在 Markdown 中输入中文、英文、标点、emoji、代码片段 | 内容稳定输入；光标不跳；状态栏字数和行列跟随 |
| P0-014 | APP | 撤销/重做/剪切复制粘贴 | 用快捷键和菜单执行 undo/redo/cut/copy/paste | 命令只在有文档时启用；内容结果正确；无文档时不报错 |
| P0-015 | APP | 查找与替换 | 打开查找、替换，执行下一项、上一项、单次替换、全部替换 | 匹配高亮准确；替换只在可编辑模式生效；预览模式限制有说明 |
| P0-016 | INT | 自动保存 | 编辑已保存文档，等待自动保存周期 | 写入目标文件；保存中/已保存/失败状态正确；不会重复写入已关闭文档 |
| P0-017 | INT | 手动保存未命名文档 | 新建文档后触发保存并选择路径 | 写入新路径；文档路径和名称更新；最近文件记录新增 |
| P0-018 | INT | 另存为 | 已保存文档另存到新路径 | 新路径写入成功；当前文档切换到新路径；旧路径恢复快照清理策略正确 |
| P0-019 | INT | 外部文件冲突 | 打开文档后模拟磁盘内容被外部修改，再保存 | 阻止覆盖或弹出冲突提示；用户能选择保留本地/磁盘版本；不丢内容 |
| P0-020 | INT | 保存失败恢复快照 | 模拟写文件失败 | 标记保存失败；生成或保留恢复快照；错误信息可读 |
| P0-021 | INT | 异常恢复队列 | 构造 recovery snapshots 后启动 | 恢复弹窗列出快照；恢复/删除/忽略动作有效 |
| P0-022 | APP | 外部文件变化监控 | 打开文档后在外部编辑器修改文件 | Prism 检测变化；若当前 dirty，进入冲突策略；若未 dirty，可刷新或提示 |
| P0-023 | APP | 关闭 dirty 文档 | dirty 文档触发关闭 | 保存后关闭、取消关闭、保存失败保持文档三种路径都正确 |
| P0-024 | PERF | 30 秒连续输入 | 长文档分栏模式下连续输入 30 秒 | 输入不中断；预览可延迟但不长时间空白；自动保存最终完成 |
| P0-025 | APP | 三视图模式 | 对 Markdown 切换 edit/split/preview | 模式互斥；标题栏和菜单 checked 状态一致；内容不丢失 |
| P0-026 | APP | Text Document 视图限制 | 打开 `.json` 后尝试 split/preview/export | 不出现不可用预览；相关命令禁用或有明确说明 |
| P0-027 | VIS | 基础 Markdown 预览 | 文档含标题、段落、列表、引用、代码、表格、链接 | 预览排版完整；代码高亮、表格、引用样式符合当前主题 |
| P0-028 | VIS | Mermaid 渲染 | 文档含合法 Mermaid 和非法 Mermaid | 合法图可见；非法图显示错误块并计入诊断 |
| P0-029 | VIS | KaTeX 渲染 | 文档含行内公式、块级公式和非法公式 | 合法公式可读；非法公式有错误状态，不破坏整页预览 |
| P0-030 | VIS | 图片渲染 | 文档含相对图片、绝对图片、缺失图片 | 可访问图片显示；缺失图片显示诊断；导出前可发现风险 |
| P0-031 | APP | 预览滚动同步 | 长文档分栏，从源码和预览双向滚动 | 双向大致对齐；无抢滚、反向抖动或空白 |
| P0-032 | APP | 预览点击定位源码 | 点击预览标题、段落、代码块 | 源码定位到对应行附近；Text Document 不触发 Markdown 定位语义 |
| P0-033 | APP | 专注模式 | `F8` 开关专注模式并 hover shell 区域 | 侧栏/标题栏/菜单栏弱化；hover 恢复；不等同全屏 |
| P0-034 | APP | 打字机模式 | `F9` 开启后在长文中段和底部连续输入 | 当前输入行保持在舒适可视区域；与专注模式可同时开启 |
| P0-035 | APP | 自动换行 | 切换 word wrap | 编辑器换行状态立即改变；设置持久化；长行不撑破布局 |
| P0-036 | APP | 状态栏核心信息 | 有/无文档、编辑/预览、Markdown/Text 分别观察状态栏 | 显示字数、行列、诊断、导出状态；不显示非承诺入口 |
| P0-037 | APP | 文件树浏览 | 展开/折叠目录、切换文件、空目录 | 排序和层级正确；选中态跟当前文档同步 |
| P0-038 | APP | 文件树上下文菜单 | 对文件/目录/工作区分别右键 | 打开、在新窗口打开、重命名、显示位置等动作可用且 Esc 可关闭 |
| P0-039 | APP | 快速打开 | `Cmd/Ctrl+P` 搜索文件名、路径、预览文本 | 最近文件优先；Markdown/Text 都可进入；回车打开当前窗口 |
| P0-040 | APP | 工作区全文搜索 | `Cmd/Ctrl+Shift+F` 搜索正文、标题、路径 | 结果含 snippet；点击打开并定位；无工作区时命令禁用 |
| P0-041 | APP | 大纲 | Markdown 标题层级变化后查看大纲 | 标题层级、顺序、点击跳转正确；Text Document 不显示 Markdown 大纲 |
| P0-042 | INT | 工作区索引 | 包含 Markdown/Text/二进制/unsupported 文件的工作区 | 只索引承诺文件；生成标题、链接、recentRank、搜索缓存正确 |
| P0-043 | INT | 路径归一化 | macOS/Windows 路径、大小写、尾斜杠 | `isSamePath`、反链、最近文件去重行为稳定 |
| P0-044 | APP | 浮动选区工具栏 | 选中文本后使用加粗、斜体、删除线、代码、链接、引用 | 工具栏位置正确；格式作用到选区；取消选择后关闭 |
| P0-045 | APP | 编辑器右键菜单 | 无选区、有选区、表格内、链接附近分别右键 | 菜单状态匹配上下文；复制/链接/表格动作不误禁用 |
| P0-046 | APP | 行内格式命令 | 快捷键/菜单触发 bold/italic/underline/strike/inlineCode/link | Markdown 语法正确包裹；已有选区和空光标都可处理 |
| P0-047 | APP | 块格式命令 | 引用、代码块、数学块、有序/无序/任务列表、分割线 | 插入标准 Markdown；undo 一步可回退 |
| P0-048 | APP | 斜杠菜单 | 输入 `/`、`/mer`、键盘上下、Enter、Esc | 仅源码编辑区触发；过滤和插入正确；Esc 关闭 |
| P0-049 | APP | Callout | 插入 NOTE/TIP/WARNING/IMPORTANT 并预览 | 源码为可读 blockquote；预览为轻量提示块；导出不丢内容 |
| P0-050 | APP | Toggle | 插入 details/summary，预览折叠展开 | 源码保持 HTML；预览可交互；导出 HTML/PDF/DOCX 尽量保留 |
| P0-051 | APP | 表格插入与编辑 | 插入表格、增加/删除行列、对齐列、格式化 | Markdown 表格合法；工具栏/右键/命令路径一致 |
| P0-052 | APP | 表格复制格式 | 表格复制 Markdown、HTML、CSV、TSV | 粘贴结果格式正确；含逗号、制表、空单元格时转义正确 |
| P0-053 | APP | 任务列表 checkbox | 预览或编辑中切换任务项 | Markdown `- [ ]` / `- [x]` 正确更新；保存后持久 |
| P0-054 | APP | 图片插入/粘贴 | 通过命令或粘贴插入图片 | 文件复制/路径写入符合权限；预览可见；失败有 toast |
| P0-055 | APP | 页面链接补全 | 输入 `[[` 搜索文件和标题 | 插入标准 Markdown 链接；搜索只对 Markdown 文档产生关系语义 |
| P0-056 | APP | 反向链接 | 当前文档被其他 Markdown 链接后打开反链面板 | 列出来源、片段和路径；点击跳转；Text Document 不显示关系语义 |
| P0-057 | APP | 当前文档链接 | 打开出链面板 | 显示可解析、断链、外链分类；点击可跳转或给出错误 |
| P0-058 | APP | 关系图谱入口 | 有关系/无关系/Text Document 三种场景 | 只有 Markdown 且有文档关系时入口可用；图谱节点点击可打开 |
| P0-059 | APP | 文档属性面板 | 打开含 YAML Front Matter 的文档并编辑字段 | 字段解析、保存回写、非法 YAML 错误态正确 |
| P0-060 | INT | 诊断聚合 | 构造断链、缺图、渲染失败、标题锚点冲突、导出风险 | `ERROR n` 只统计需处理问题；分类、严重度、定位信息正确 |
| P0-061 | APP | 诊断面板 | 点击 `ERROR n` | 面板从状态栏上方弹出；问题分组、跳转、关闭行为正确 |
| P0-062 | APP | HTML 导出 | Markdown 文档导出 HTML | 输出文件存在；主题/代码/公式/图/图片尽量保真；成功反馈可见 |
| P0-063 | APP | PDF 导出 | Markdown 文档导出 PDF | 输出文件存在；分页不明显切断核心块；失败可诊断 |
| P0-064 | APP | PNG 导出 | 选择不同清晰度导出 PNG | 图片清晰度档位生效；大文档超限有提示 |
| P0-065 | APP | DOCX 导出 | 含标题、表格、图片、Callout、公式的文档导出 DOCX | 文件可打开；复杂块尽量图片化保真；字体策略生效 |
| P0-066 | APP | Text Document 导出禁用 | 打开 `.json/.sql` 查看导出菜单和按钮 | 导出入口禁用或解释不可导出；不会生成错误空文件 |
| P0-067 | APP | 导出预检失败 | 文档含缺失图片、断链、渲染错误后导出 | 先展示风险；用户可修复或选择继续；失败详情包含阶段和路径 |
| P0-068 | APP | 后台导出状态 | 启动导出并观察状态栏/toast | 导出中、已导出、导出失败状态稳定；可打开结果或失败详情 |
| P0-069 | INT | 导出历史 | 成功导出后使用“使用上次设置导出/覆盖上次导出” | 上次格式、路径、设置恢复；文件不存在或格式不支持有提示 |
| P0-070 | APP | 导出设置 | 设置默认格式、PDF 页面、页眉页脚、TOC、主题、DOCX 字体 | 设置即时保存；下一次导出读取当前设置 |
| P0-071 | APP | 通用设置 | 语言、默认视图、快捷键风格 | 控件可切换并持久化；重启后仍生效 |
| P0-072 | APP | 写作设置 | 行号/自动保存策略/字体/字号/行高/自动换行 | 设置影响编辑器；非法值被限制；长文本不溢出 |
| P0-073 | APP | 外观主题 | 切换 Miaoyan/Inkstone/Slate/Mono/Nocturne/Carbon | 编辑器、预览、搜索、导出相关色彩一致；无一色块崩坏 |
| P0-074 | INT | 设置持久化迁移 | 模拟新旧 config、legacy recentFiles、损坏 JSON | 可恢复默认；能迁移 legacy；不因配置坏掉启动失败 |
| P0-075 | APP | 命令菜单 | 文件/编辑/插入/格式/视图/窗口/帮助菜单逐项打开 | 分组、禁用态、checked 态、快捷键显示正确；Esc/点击外部可关闭 |
| P0-076 | APP | 快捷键 | 核心快捷键 `New/Open/Save/Search/QuickOpen/View/Focus/Typewriter` | macOS/Windows/Linux 修饰键按平台显示并触发正确动作 |
| P0-077 | APP | Toast 与错误反馈 | 触发保存成功、保存失败、导出失败、设置导入失败 | 文案可读；不会遮挡核心操作；错误 toast 保留足够时间 |
| P0-078 | APP | 帮助与关于 | 打开快捷键、关于、Markdown 参考、迁移指南、GitHub、反馈 | 内部弹窗和外部链接正确；离线或失败有提示 |
| P0-079 | APP | 检查更新 | 在线/离线分别触发检查更新 | 显示检查中和最终态；latest/失败/发现更新三类文案可区分 |
| P0-080 | PERF | 真实预览性能基准 | 1MB/3MB 文档打开、切预览、滚动、搜索、右键、源码定位 | 响应无明显冻结；记录耗时；结果不只依赖 jsdom |

## P1 深度功能与回归用例

| ID | 类型 | 覆盖点 | 步骤 | 预期 |
|---|---|---|---|---|
| P1-001 | APP | 首次启动种子文档 | 清空 appData 后首次启动 | 如启用 seed docs，则复制到工作区或显示引导；不重复复制 |
| P1-002 | APP | 文件夹启动参数 | 使用 `?folder=` 启动 | 授权目录并加载文件树；不覆盖显式 `?file=` 优先级 |
| P1-003 | INT | 大文件确认 | 打开超过 large-file 阈值文档 | 普通打开需要确认；startup/open-system 可按策略跳过确认 |
| P1-004 | APP | 只读/权限不足路径 | 打开只读目录或无写权限文件后保存 | 保存失败可读；另存为可用；不误标已保存 |
| P1-005 | APP | 文件树重命名 | 对文件执行内联重命名 | 文件系统更新、当前文档路径同步、冲突文件名阻止 |
| P1-006 | APP | 文件树新增/删除 | 新建文件夹/文件、删除文件 | 文件树刷新；删除当前文档有确认；错误有 toast |
| P1-007 | APP | 工作区焦点刷新 | 外部增删文件后 Prism 获得焦点 | 文件树和索引刷新；展开状态尽量保留 |
| P1-008 | INT | 最近文件 localStorage 兼容 | settings recentFiles 为空，legacy cache 存在 | 回退读取 cache；添加/清空时同步 legacy 行为 |
| P1-009 | APP | Rich copy | 选区复制纯文本、Markdown、HTML | 剪贴板 MIME/内容正确；代码块、链接、表格不丢结构 |
| P1-010 | APP | 自动格式化 | 输入常见 Markdown 触发 auto format | 不破坏代码块；可 undo；关闭相关能力后不触发 |
| P1-011 | APP | 标题升降级 | 对当前标题执行 increase/decrease heading | Markdown heading 等级正确变化；正文段落不误处理 |
| P1-012 | APP | 段落移动/复制/删除 | 当前段落上移、下移、复制、删除 | 段落边界正确；列表/引用/代码块不被切坏 |
| P1-013 | APP | 章节移动/复制/折叠 | 对当前标题章节执行操作 | 标题树边界正确；折叠状态不影响保存内容 |
| P1-014 | APP | 选区转格式 | 选区转引用、Callout、任务列表、有/无序列表 | 多行选区语法正确；undo 一步回退 |
| P1-015 | APP | 模板插入 | 插入会议纪要、PRD、技术方案、周报、公众号、学术笔记等 | 空文档可作为整篇模板；非空文档插入光标处；占位符替换正确 |
| P1-016 | APP | YAML 与导出设置联动 | Front Matter 含 title/export/tags/date | 属性面板解析；导出标题/TOC/页面设置按策略应用 |
| P1-017 | APP | 脚注/TOC | 文档含脚注和目录命令 | 预览跳转、导出 TOC 和脚注格式正确 |
| P1-018 | APP | HTML 表格转换 | 粘贴或命令转换 HTML table 到 Markdown | 表头、单元格、转义和对齐正确 |
| P1-019 | APP | 表格排序/移动 | 选择表格列排序、移动行列 | 数据行顺序正确；表头不参与错误排序 |
| P1-020 | APP | Markmap | 文档含 markmap 代码块 | 渲染成功；库加载失败时 fallback 可读 |
| P1-021 | APP | PlantUML/Graphviz | 文档含 PlantUML/Graphviz 代码块 | 渲染成功或错误块可诊断；不阻塞普通预览 |
| P1-022 | APP | Presentation mode | 文档含 slide 分隔符后进入演示模式 | 无 slides 时 toast；有 slides 时 overlay 可导航、退出 |
| P1-023 | APP | Wiki link 兼容 | 文档含既有 `[[文档名]]` | 预览可识别并跳转；保存不强制改写 |
| P1-024 | APP | 图谱范围和搜索 | 图谱面板切换当前文档/当前工作区，搜索节点 | 节点和边准确；点击节点打开文档；无关系空态合理 |
| P1-025 | INT | 反链解析边界 | 相对链接、标题锚点、大小写、外链、mailto | 只把工作区 Markdown 文档计入关系；外链不计图谱 |
| P1-026 | APP | 导出取消 | 打开保存面板后取消导出 | 不创建 job 或文件；状态栏不残留导出中 |
| P1-027 | APP | 导出保存面板默认路径 | 对已保存/未保存文档分别导出 | 默认文件名、扩展名、目录符合设置；覆盖确认生效 |
| P1-028 | APP | HTML 包含主题开关 | 导出 HTML 时切换 include theme | 开启时独立可读；关闭时结构仍存在但不注入主题 CSS |
| P1-029 | APP | PDF 页眉页脚 | 开启页眉页脚并设置 `{title}`/`{filename}` | PDF 对应区域出现正确替换文本 |
| P1-030 | APP | DOCX 字体策略 | theme/preview/custom 三种 DOCX 字体策略 | DOCX 内容字体符合设置；缺失自定义字体时提示 |
| P1-031 | APP | Pandoc 引用 | 设置 bibliography 和 CSL 后导出 HTML/DOCX | Pandoc ready 时引用和参考文献正确；未安装时标记阻塞或提示 |
| P1-032 | APP | 主题导入 | 导入合法/重复/非法主题包 | 合法主题入库并可应用；重复主题有替换确认；非法主题说明原因 |
| P1-033 | APP | 自定义字体导入/删除 | 导入 ttf/otf/woff 字体并应用到编辑器/预览 | 字体注册、持久化、删除回退正确 |
| P1-034 | INT | i18n 资源完整性 | 切换语言或扫描命令/设置文案 key | 无明显缺失 key；命令 label/category 在菜单和命令面板一致 |
| P1-035 | APP | 通用命令面板 | 如保留命令面板，打开默认态并搜索命令 | 命令列表、分组、禁用态、快捷键、执行路径正确 |
| P1-036 | APP | 浮层统一关闭 | 快速打开、搜索、右键菜单、设置弹窗、诊断面板按 Esc | 一次 Esc 关闭当前浮层；焦点回到合理位置 |
| P1-037 | VIS | 窄窗口布局 | 900px、700px 宽度打开核心界面 | 文字不重叠；工具按钮不挤压内容；核心操作仍可达 |
| P1-038 | VIS | 低高度窗口布局 | 高度约 560px 打开设置/导出/图谱 | 弹窗可滚动；底部按钮可见；无截断 |
| P1-039 | PERF | 导出大文档 | 复杂长文导出 PDF/PNG/DOCX | 不超过可接受时间；失败时给出资源/分页/图片风险 |
| P1-040 | PERF | 工作区索引性能 | 1000 个文档、混合 Markdown/Text/assets | 索引不阻塞 UI；搜索结果合理；内存无持续增长 |
| P1-041 | INT | 命令注册覆盖 | 扫描 commandRegistry | ID 唯一；快捷键冲突可解释；palette/menu 可见性符合产品口径 |
| P1-042 | INT | 主题契约 | 内置主题 contract 与 CSS 变量 | 主题 token 完整；导出/搜索/Mermaid 变量存在 |
| P1-043 | APP | 打印命令 | 触发 print | 系统打印面板可打开或不可用时 toast；不崩溃 |
| P1-044 | APP | DevTools/缩放 | 触发缩放、重置、DevTools | WebView zoom 或 CSS fallback 生效；DevTools 不可用时提示 |

## P2 平台、可用性与发布用例

| ID | 类型 | 覆盖点 | 步骤 | 预期 |
|---|---|---|---|---|
| P2-001 | APP | macOS Finder 文件关联 | 设置 Prism 为 `.md/.markdown/.txt/.json/.sql` 默认打开方式 | 双击文件进入 Prism；bundle id 为 `com.prism.editor.v1` |
| P2-002 | APP | macOS 标题栏/全屏/最小化 | 最小化、恢复、全屏、退出全屏 | 窗口状态同步；布局恢复；焦点不丢 |
| P2-003 | APP | macOS 拖拽图片 | Finder 普通拖拽和 Option 拖拽图片到编辑器 | 普通拖拷贝到 assets；Option 尽量保留原路径或提示限制 |
| P2-004 | APP | Windows 安装器 | 安装/卸载 Windows 包 | 开始菜单、卸载项、文件关联、权限正常 |
| P2-005 | APP | Windows 文件关联 | 双击 `.md/.txt/.json/.sql` | Prism 打开对应文件；路径含中文和空格正常 |
| P2-006 | VIS | Windows 标题栏 | Windows 下打开主界面、设置、导出 | 标题栏控件位置正确；不套用 macOS-only 表达 |
| P2-007 | APP | Linux 包 | 安装 Linux 包并启动 | 菜单、文件打开、权限提示、字体 fallback 正常 |
| P2-008 | APP | Linux 文件关联 | Linux 桌面双击支持文件 | 打开到当前 Prism；失败则记录桌面环境限制 |
| P2-009 | VIS | 跨平台字体 fallback | macOS/Windows/Linux 对比中文、英文、代码、公式 | 字体回退可读；行高和预览排版不明显崩坏 |
| P2-010 | APP | Updater artifacts | 正式构建并生成 `.sig/latest.json` | manifest 版本、URL、signature 正确；`--check` 能发现不一致 |
| P2-011 | APP | DMG fallback | macOS Finder AppleScript 超时时使用 skip-finder DMG | DMG 可 verify；说明仅跳过布局美化，不替代签名公证 |
| P2-012 | APP | 签名/公证前检查 | 检查 bundle id、entitlements、capabilities | 无静态全盘 `**` scope；release note 如实说明签名/公证状态 |
| P2-013 | A11Y | 键盘可达性 | 仅键盘完成打开、搜索、切视图、保存、导出设置 | 焦点顺序合理；关键按钮有 aria-label 或可读文本 |
| P2-014 | A11Y | 高对比/暗色可读性 | 暗色主题、系统暗色、不同内容主题 | 文本对比足够；选区、链接、错误不只靠颜色 |
| P2-015 | APP | 离线外链失败 | 离线时打开 GitHub/更新/外部帮助 | 失败不崩溃；有明确说明 |
| P2-016 | PERF | 长时运行 | 连续编辑、搜索、切预览、导出 30 分钟 | 内存无明显泄漏；快捷键和保存仍响应 |
| P2-017 | APP | 崩溃后恢复 | 强制结束进程后重新打开 | 恢复快照出现；last session 不覆盖系统打开文件 |
| P2-018 | VIS | 发布截图基线 | 1200/1440/1920 宽度截图：空状态、编辑、分栏、预览、设置 | 视觉符合跨平台写作器气质；无重叠、截断、异常滚动条 |

## 全量详细追踪矩阵

本节是执行层规格。上面的 P0/P1/P2 是管理视图；真正执行时按本节逐项打勾。每项至少记录 `Pass / Fail / Blocked / Not executed`，失败必须给出复现路径和证据。

### A. 文件类型与 Document Profile

| ID | 优先级 | 覆盖项 | 前置数据 | 操作 | 必验断言 | 证据 |
|---|---|---|---|---|---|---|
| D-PROFILE-001 | P0 | Markdown 扩展 | `.md`、`.markdown` | 打开、编辑、预览、导出、索引、链接补全 | profile 为 `markdown`；预览/导出/关系图谱/Markdown 链接均可用 | UI 截图 + 单测 |
| D-PROFILE-002 | P0 | Text 基础扩展 | `.txt`、`.text` | 打开、编辑、保存、搜索 | profile 为 `text`；可编辑保存；无 Markdown 预览和导出承诺 | UI 截图 + 单测 |
| D-PROFILE-003 | P0 | 数据/配置文本 | `.sql`、`.json`、`.jsonc`、`.yaml`、`.yml`、`.toml`、`.xml`、`.csv`、`.tsv`、`.log`、`.ini`、`.conf`、`.env` | 逐个打开并执行保存、另存、搜索、最近文件 | 均按 Text Document 处理；不进入 Markdown 关系图谱 | manifest 明细 |
| D-PROFILE-004 | P0 | Unsupported 源码 | `.js`、`.ts`、`.tsx`、`.py`、`.rs`、`.go`、`.java`、`.css`、`.html` | 在打开对话框、文件关联、索引中检查 | 不作为默认支持文件；若通过高级路径打开，不扩大产品承诺 | 截图/单测 |
| D-PROFILE-005 | P1 | 大小写扩展 | `README.MD`、`DATA.JSON` | 打开与索引 | 扩展名大小写不影响 profile 判定 | 单测 |
| D-PROFILE-006 | P1 | 无扩展和隐藏文件 | `.env`、`README`、`.gitignore` | 打开/索引 | `.env` 支持；未列入白名单的无扩展文件不进入默认承诺 | 单测 |

### B. 启动、窗口和会话恢复

| ID | 优先级 | 覆盖项 | 操作 | 必验断言 | 证据 |
|---|---|---|---|---|---|
| D-BOOT-001 | P0 | 普通启动 | 清空 appData 后启动 | 不崩溃；空状态、标题栏、侧栏状态一致；无旧会话污染 | 首屏截图 |
| D-BOOT-002 | P0 | `?file=` 显式文件 | 用含空格/中文路径启动 | 显式文件优先于 last session；路径解码正确 | 截图 + 日志 |
| D-BOOT-003 | P0 | `?folder=` 显式目录 | 用 workspace 目录启动 | 目录权限授权；文件树和索引加载；无当前文档时停留工作区 | 截图 |
| D-BOOT-004 | P0 | `?new=1` | 有 last session 时启动新文档 | 创建未命名文档；不恢复旧文件 | 截图 |
| D-BOOT-005 | P0 | `?empty=1` | 有 last session 时启动空窗口 | 不创建新文档，不恢复旧文件 | 截图 |
| D-BOOT-006 | P0 | pending startup files | 模拟 1 个 pending file | 在当前窗口打开；不再恢复 last session | 单测/APP |
| D-BOOT-007 | P0 | 多 pending files | 模拟 3 个 pending files | 第一个当前窗口，后两个新窗口；失败不阻断首文件 | 单测/APP |
| D-BOOT-008 | P1 | macOS 延迟 pending | pending 第一次为空第二次出现 | 延迟轮询后打开 pending，不提前恢复 last session | 单测 |
| D-BOOT-009 | P1 | 首启种子文档 | 清空 appData、保留 bundle resources | 只在首次复制；重复启动不覆盖用户改动 | APP |
| D-WINDOW-001 | P0 | 单活动文档窗口 | 文件树切换、系统打开、新建窗口 | 无标签页；每窗口只有一个 active document | 截图 |
| D-WINDOW-002 | P0 | 新窗口参数 | `newWindow`、多文件打开、打开文件夹且当前有文档 | 新窗口隔离 store；当前窗口不被覆盖 | APP |
| D-WINDOW-003 | P2 | 全屏/最小化/置顶 | `fullscreen`、`minimize`、`alwaysOnTop` | 窗口状态与 store 同步；恢复后布局不乱 | 平台截图 |

### C. 文件操作、保存和防丢稿

| ID | 优先级 | 覆盖项 | 操作 | 必验断言 | 证据 |
|---|---|---|---|---|---|
| D-FILE-001 | P0 | `new` | 无文档/有文档两种状态执行 | 无文档当前窗口创建；有文档时新窗口创建 | 截图/单测 |
| D-FILE-002 | P0 | `open` | 打开 Markdown/Text/取消选择 | 成功打开支持文件；取消无副作用；错误弹窗可读 | APP |
| D-FILE-003 | P0 | `save` 未命名 | 新建文档保存到新路径 | 写入磁盘；路径、名称、dirty 状态更新 | 产物 + 截图 |
| D-FILE-004 | P0 | `save` 已命名 | 编辑已有文件保存 | 写入磁盘；恢复快照按策略清理 | 产物 |
| D-FILE-005 | P0 | `saveAs` | 已保存和未保存文档另存 | 当前文档切换到新路径；recent files 更新 | 产物 |
| D-FILE-006 | P0 | `closeDocument` 干净文档 | 直接关闭 | 当前文档清空；工作区保留 | 截图 |
| D-FILE-007 | P0 | `closeDocument` dirty 文档 | 保存/取消/保存失败三条路径 | 不静默丢稿；失败后文档仍打开 | APP |
| D-FILE-008 | P0 | 外部冲突 | 打开后外部改文件再保存 | 标记 save conflict；用户可处理；不覆盖外部内容 | APP/单测 |
| D-FILE-009 | P0 | 保存失败 | mock 写入失败或只读目录 | dirty 状态保留；错误和恢复快照可见 | 单测/APP |
| D-FILE-010 | P0 | recovery snapshots | 构造 manual-save/save-failed/crash 快照 | 弹窗列出；恢复/删除/清理行为正确 | 单测/APP |
| D-FILE-011 | P0 | 最近文件 | 添加重复路径、超过上限、清空 | 去重、排序、上限、legacy cache 同步 | 单测 |
| D-FILE-012 | P1 | `openCurrentLocation` | 当前文件/仅工作区/都没有 | reveal 文件、打开目录、toast 三种结果正确 | APP |
| D-FILE-013 | P1 | 打印 | 执行 `print` | 系统打印面板可打开；不可用时有 toast | APP |

### D. 编辑器基础命令和搜索

| ID | 优先级 | 覆盖项 | 操作 | 必验断言 | 证据 |
|---|---|---|---|---|---|
| D-EDIT-001 | P0 | undo/redo | 输入多段后执行 `undo`、`redo` | 内容、预览、dirty 状态同步回退/恢复 | APP |
| D-EDIT-002 | P0 | cut/copy/paste/pastePlain/selectAll | 有选区、无选区、跨段落选区 | 剪贴板内容正确；纯文本粘贴去格式；无文档禁用 | APP |
| D-EDIT-003 | P0 | 查找 | 搜索中文、英文、大小写、无结果 | 匹配计数、上下跳转、滚动定位、关闭行为正确 | APP |
| D-EDIT-004 | P0 | 替换 | 单次替换、全部替换、预览模式触发 | 编辑模式可替换；预览模式不沉默降级 | APP |
| D-EDIT-005 | P0 | copyPlain/copyMd/copyHtml | 选中标题、列表、表格、代码 | 三种输出格式符合语义；HTML 不注入危险脚本 | APP/单测 |
| D-EDIT-006 | P1 | rich copy 边界 | 选区跨代码块、链接、图片、表格 | 格式不丢结构；失败有回退 | APP |
| D-EDIT-007 | P1 | 自动格式化 | 对乱序列表、表格、标题间距执行 `autoFormat` | 只整理 Markdown，不破坏代码块和 front matter | 单测/APP |
| D-EDIT-008 | P1 | 光标与状态栏 | 输入、点击、选区、多行移动 | `字数 · 行:列` 更新；预览无光标时隐藏行列 | APP |

### E. 格式、插入和块操作命令

| ID | 优先级 | 覆盖项 | 命令/入口 | 必验断言 | 证据 |
|---|---|---|---|---|---|
| D-FMT-001 | P0 | 行内格式 | `bold`、`italic`、`underline`、`strikethrough`、`inlineCode`、`link` | 选区和空光标都产生正确 Markdown/HTML；undo 一步回退 | APP/单测 |
| D-FMT-002 | P0 | 段落/标题 | `paragraph`、H1-H6、`increaseHeading`、`decreaseHeading`、`clearFormat` | 标题等级正确；清除格式不删正文 | APP |
| D-INS-001 | P0 | 基础块插入 | `codeBlock`、`mathBlock`、`quote`、`orderedList`、`unorderedList`、`taskList`、`hr` | 插入标准 Markdown；预览显示正确 | APP |
| D-INS-002 | P0 | 图片 | `insertImage`、粘贴图片、拖拽图片 | 资源复制/路径写入/预览/保存后重开均正确 | APP |
| D-INS-003 | P0 | Callout/Toggle | `insertCallout`、`insertToggle`、Callout picker | 源码可读；预览轻量；导出保留 | APP |
| D-INS-004 | P1 | footnote/linkReference/toc/yaml | 插入并预览/导出 | 脚注跳转、引用定义、TOC、YAML 均合法 | APP |
| D-BLOCK-001 | P1 | 段落操作 | `moveParagraphUp/Down`、`duplicateParagraph`、`deleteParagraph` | 段落边界准确；列表/引用不被切坏 | 单测/APP |
| D-BLOCK-002 | P1 | 章节操作 | `moveSectionUp/Down`、`duplicateSection`、`foldCurrentHeading` | 以标题层级为边界；折叠不改内容 | APP |
| D-BLOCK-003 | P1 | 选区转换 | `selectionQuote`、`selectionCallout*`、`selectionUnorderedList`、`selectionOrderedList`、`selectionTaskList` | 多行选区正确加前缀；Callout 类型 NOTE/TIP/WARNING/IMPORTANT 全覆盖 | 单测/APP |

### F. 表格全操作

| ID | 优先级 | 覆盖项 | 命令/入口 | 必验断言 | 证据 |
|---|---|---|---|---|---|
| D-TABLE-001 | P0 | 插入与格式化 | `insertTable`、popover 网格、`formatTable` | 表头、分隔行、对齐语法合法；格式化保留内容 | APP/单测 |
| D-TABLE-002 | P0 | 行列增删 | `addTableRow`、`addTableColumn`、`deleteTableRow`、`deleteTableColumn`、`insertTableRowAbove/Below`、`insertTableColumnLeft/Right` | 当前单元格定位准确；表格最小结构不被删坏 | APP |
| D-TABLE-003 | P0 | 对齐 | `alignTableColumnLeft/Center/Right` | Markdown 对齐标记和预览对齐一致 | APP |
| D-TABLE-004 | P0 | 选择与复制 | `selectTable`、`copyTableMarkdown`、`copyTableHtml`、`copyTableCsv`、`copyTableTsv` | Markdown/HTML/CSV/TSV 均可复制；逗号、引号、制表符转义正确 | APP/单测 |
| D-TABLE-005 | P1 | 移动行列 | `moveTableRowUp/Down`、`moveTableColumnLeft/Right` | 表头和数据列不乱；移动边界无副作用 | APP |
| D-TABLE-006 | P1 | 排序 | `sortTableAsc`、`sortTableDesc` | 数字、中文、空值排序可解释；表头不参与数据排序 | APP/单测 |
| D-TABLE-007 | P1 | HTML 转换 | `convertTableToHtml`、`convertHtmlTableToMarkdown` | 转换后结构等价；不引入危险 HTML | 单测/APP |

### G. 斜杠菜单、模板和演示模式

| ID | 优先级 | 覆盖项 | 操作 | 必验断言 | 证据 |
|---|---|---|---|---|---|
| D-SLASH-001 | P0 | 触发与过滤 | 在源码编辑区输入 `/`、`/mer`、`/table` | 仅编辑区触发；过滤结果准确；Esc 关闭 | APP |
| D-SLASH-002 | P0 | 键盘交互 | 上下键、Enter、鼠标点击 | 插入到正确光标位置；焦点回编辑器 | APP |
| D-TEMPLATE-001 | P0 | 全部内置模板 | README、PRD、会议纪要、周报、技术方案、公众号长文、论文草稿、读书笔记、研究摘要、白皮书 | 空文档作为整篇模板；非空文档插入光标；文件名建议正确 | APP/单测 |
| D-TEMPLATE-002 | P1 | 占位符 | `{{date}}`、`{{title}}`、`{{author}}` | 替换正确；未知占位符不破坏 Markdown | 单测 |
| D-PRESENT-001 | P1 | 演示模式 | 无 slides 文档、有 slides 文档、退出 overlay | 无 slides toast；有 slides 可翻页、退出、保持文档内容 | APP |

### H. 预览、渲染和视觉主题

| ID | 优先级 | 覆盖项 | 数据 | 必验断言 | 证据 |
|---|---|---|---|---|---|
| D-PREVIEW-001 | P0 | 基础排版 | 标题、段落、列表、引用、代码、表格、链接、脚注 | 排版、间距、代码高亮、链接可读 | 截图 |
| D-PREVIEW-002 | P0 | Mermaid | flowchart、sequence、非法语法 | 合法渲染；非法错误块进入诊断 | 截图/单测 |
| D-PREVIEW-003 | P0 | KaTeX | 行内、块级、非法公式 | 合法公式清晰；非法公式不破坏全页 | 截图 |
| D-PREVIEW-004 | P0 | 图片 | 相对、绝对、SVG、缺失图片 | 可访问图片显示；缺失图片诊断可定位 | 截图 |
| D-PREVIEW-005 | P0 | Callout/Toggle | NOTE/TIP/WARNING/IMPORTANT、details | 样式克制；Toggle 可展开；源码可读 | 截图 |
| D-PREVIEW-006 | P0 | 滚动同步 | 长文源码滚动、预览滚动、快速滚动 | 大致对齐；无抢滚和空白 | 录屏/截图 |
| D-PREVIEW-007 | P0 | 点击定位 | 标题、段落、代码、图片附近点击 | 源码定位到对应行附近 | APP |
| D-THEME-001 | P0 | 内置内容主题 | Miaoyan、Inkstone、Slate、Mono、Nocturne、Carbon | 编辑器、预览、搜索、Mermaid、导出预览主题一致 | 6 组截图 |
| D-THEME-002 | P1 | 主题导入管理 | 文件夹/压缩包导入、重复 ID、删除当前用户主题、reload | 合法导入；重复确认；非法说明原因；删除回退 | APP |
| D-VIS-001 | P1 | 窗口尺寸 | 900x700、1200x800、1440x900、低高度 560 | 无重叠、截断；弹窗可滚动；状态栏不挤压内容 | 截图 |
| D-VIS-002 | P2 | 平台外观 | macOS、Windows、Linux | 主工作区一致；平台 chrome/文件管理器措辞平台化 | 平台截图 |

### I. 工作区、索引、搜索、链接和图谱

| ID | 优先级 | 覆盖项 | 操作 | 必验断言 | 证据 |
|---|---|---|---|---|---|
| D-WS-001 | P0 | 打开工作区 | `openFolder` 选择测试 workspace | 授权、文件树、状态栏、索引加载正确 | 截图 |
| D-WS-002 | P0 | 文件树导航 | 展开/折叠/选中/当前文档同步 | 层级、排序、选中态正确；dirty 切换受保护 | APP |
| D-WS-003 | P0 | 文件树菜单 | 文件、目录、工作区右键 | 打开、在新窗口打开、显示位置、重命名等状态正确；Esc 关闭 | APP |
| D-WS-004 | P0 | 快速打开 | 文件名、路径、preview、空查询、recent boost | 排名可解释；limit 生效；回车打开 | APP/单测 |
| D-WS-005 | P0 | 全文搜索 | 标题、正文、路径、无结果 | snippet、排序、点击打开/定位正确 | APP/单测 |
| D-WS-006 | P0 | 大纲 | H1-H4、重复标题、修改标题后刷新 | 层级和跳转正确；空文档空态 | APP |
| D-LINK-001 | P0 | 页面链接补全 | 输入 `[[` 搜索文件和标题 | 插入标准 Markdown link；标题 anchor 正确 | APP/单测 |
| D-LINK-002 | P0 | 出链面板 | 普通相对链接、标题链接、外链、断链、wiki link | 分类和状态准确；点击行为正确 | APP |
| D-LINK-003 | P0 | 反链面板 | 多文档链接当前文档 | 来源、片段、路径、点击跳转正确 | APP/单测 |
| D-LINK-004 | P0 | 关系图谱 | 有关系、无关系、Text Document、外链-only | 入口启用逻辑正确；节点/边准确；点击打开文档 | APP/单测 |
| D-LINK-005 | P1 | 图谱高级交互 | 当前文档/全工作区范围、搜索节点、1-2 跳关系 | 范围切换和搜索不丢当前选择；空态清楚 | APP |
| D-WS-007 | P1 | 工作区刷新 | 外部新增/删除/重命名文件后回到 Prism | 文件树和索引刷新；展开状态尽量保留 | APP |
| D-WS-008 | P1 | 索引性能 | 1000 文件 workspace | UI 不冻结；搜索结果可用；内存不过度增长 | PERF |

### J. 诊断、属性和 Front Matter

| ID | 优先级 | 覆盖项 | 数据 | 必验断言 | 证据 |
|---|---|---|---|---|---|
| D-DIAG-001 | P0 | ERROR 统计 | 断链、缺图、Mermaid 失败、KaTeX 失败、锚点冲突、导出阻断 | 只统计需处理问题；backlink/outlink 数量不计 ERROR | APP/单测 |
| D-DIAG-002 | P0 | 诊断面板 | 点击 `ERROR n` | 360-420px 左右轻量浮层；分类、严重度、位置、操作正确 | 截图 |
| D-DIAG-003 | P0 | 跳转定位 | 点击诊断项 | 编辑器跳到对应源码附近；预览同步 | APP |
| D-PROP-001 | P0 | 合法 Front Matter | title、tags、description、author、date、status、export | 属性面板显示和保存回写正确 | APP/单测 |
| D-PROP-002 | P0 | 非法 YAML | 缩进错误、未闭合字符串 | 面板错误态清楚；不会覆盖原文 | APP |
| D-PROP-003 | P1 | 导出字段联动 | front matter 覆盖导出 title、author、date、toc、paper | 设置开启时生效；关闭时不覆盖 | APP/单测 |

### K. 导出全链路

| ID | 优先级 | 覆盖项 | 操作 | 必验断言 | 证据 |
|---|---|---|---|---|---|
| D-EXPORT-001 | P0 | HTML 导出 | 导出 `07-export.md` | 文件存在；主题、代码、Callout、Toggle、Mermaid、KaTeX、图片保真 | 产物 + 截图 |
| D-EXPORT-002 | P0 | PDF 导出 | A4/Letter、compact/standard/wide | 文件可打开；分页不明显切断核心块；页边距生效 | 产物 |
| D-EXPORT-003 | P0 | PNG 导出 | 1x/2x/3x/4x 清晰度 | 输出尺寸和清晰度匹配；超限风险可诊断 | 产物 |
| D-EXPORT-004 | P0 | DOCX 导出 | theme/preview/custom 字体策略 | DOCX 可打开；复杂块尽量保真；字体策略可见 | 产物 |
| D-EXPORT-005 | P0 | Text Document 禁用 | `.json`、`.sql` 触发导出入口 | 导出命令禁用或明确说明；无空文件 | 截图 |
| D-EXPORT-006 | P0 | 保存面板取消 | 任一格式打开保存面板后取消 | 不创建文件；状态栏不残留 job | APP |
| D-EXPORT-007 | P0 | 导出中/成功/失败反馈 | 成功导出、缺图失败、渲染失败 | 状态栏和 toast 稳定；失败含阶段、路径、下一步 | APP |
| D-EXPORT-008 | P0 | 历史导出 | `exportWithPrevious`、`exportOverwritePrevious` | 读取上次设置；覆盖路径确认；历史不存在时禁用 | APP/单测 |
| D-EXPORT-009 | P1 | HTML include theme | 开/关 `htmlIncludeTheme` | 开启可独立阅读；关闭仍结构完整 | 产物 |
| D-EXPORT-010 | P1 | 页眉页脚和页码 | 开启 page numbers、header/footer `{title}`/`{filename}` | PDF 页眉页脚替换正确 | 产物 |
| D-EXPORT-011 | P1 | TOC | 设置和 front matter 双路径开启 TOC | 导出出现目录；锚点唯一 | 产物 |
| D-EXPORT-012 | P1 | Pandoc 引用 | 有/无 pandoc、合法/非法 bibliography、CSL | ready 时引用生成；not ready 时提示，不误成功 | APP/产物 |
| D-EXPORT-013 | P1 | 大文档导出 | 1MB/3MB 长文，含图表公式 | 不长时间无反馈；失败可诊断；内存不过度增长 | PERF |

### L. 设置中心全控件

| ID | 优先级 | 设置项 | 操作 | 必验断言 |
|---|---|---|---|---|
| D-SET-GEN-001 | P0 | 语言、默认视图、快捷键风格 | 逐项切换并重启 | 值持久化；UI 和快捷键显示同步 |
| D-SET-WRITE-001 | P0 | 行号、自动保存、自动保存策略 | 开关和 instant/balanced/battery 切换 | 编辑器显示和保存节奏变化；非法值归一 |
| D-SET-WRITE-002 | P0 | 编辑器字体、字号、行高 | builtin/system/custom/theme 来源切换 | 编辑区样式即时更新；文字不溢出 |
| D-SET-APP-001 | P0 | 内容主题、预览字体、预览字号 | 切换所有内置主题和字号 | 预览、编辑、导出读取一致 |
| D-SET-APP-002 | P1 | 主题管理 | 导入并应用、只导入、打开主题目录、重载、删除 | 每个按钮有结果反馈；确认弹窗可取消 |
| D-SET-APP-003 | P1 | 字体导入/删除 | 支持 ttf/otf/woff/woff2 和不支持格式 | 支持格式注册；不支持格式错误清楚 |
| D-SET-EXPORT-001 | P0 | 导出模板、PDF 纸张、Front Matter 覆盖、TOC、页边距 | 逐项切换后导出 | 导出结果反映设置 |
| D-SET-EXPORT-002 | P0 | 页码、页眉页脚、页眉文本、页脚文本 | 开关和文本输入 | UI 条件显示正确；导出替换正确 |
| D-SET-EXPORT-003 | P0 | 默认导出位置、自定义目录 | ask/document/downloads/custom | 默认路径符合设置；无权限有提示 |
| D-SET-EXPORT-004 | P0 | DOCX 字体、HTML 包含主题、导出清晰度 | 所有选项切换 | 设置持久化；导出读取正确 |
| D-SET-CITE-001 | P1 | Pandoc path、bibliography、CSL、状态 | 输入、清空、检测 | 状态可区分 ready/not-ready/error |
| D-SET-FILE-001 | P0 | 恢复上次会话、最近文件上限、清空最近文件 | 切换/输入/清空并重启 | last session 策略和 recent files 符合设置 |

### M. 命令、菜单、快捷键和帮助

| ID | 优先级 | 覆盖项 | 必测命令 | 必验断言 |
|---|---|---|---|---|
| D-CMD-001 | P0 | File/Window 命令 | `new`、`newWindow`、`open`、`save`、`saveAs`、`print`、`openCurrentLocation`、`closeDocument`、`minimize`、`fullscreen`、`alwaysOnTop` | enabled/disabled、菜单、快捷键和执行结果一致 |
| D-CMD-002 | P0 | Edit 命令 | `undo`、`redo`、`cut`、`copy`、`paste`、`pastePlain`、`selectAll`、`showSearch`、`showReplace`、`workspaceSearch` | 无文档时禁用；有文档执行正确 |
| D-CMD-003 | P0 | Insert/Format 命令 | 所有 `insert*`、表格命令、heading、inline format、block operations、selection operations | 命令面板/菜单/快捷键/右键入口不互相矛盾 |
| D-CMD-004 | P0 | View 命令 | `sourceMode`、`splitMode`、`previewMode`、`toggleSidebar`、`showFiles`、`showOutline`、`focusMode`、`typewriterMode`、`wordWrap`、`statusBar` | checked 状态准确；Text Document 限制正确 |
| D-CMD-005 | P1 | Zoom/DevTools | `actualSize`、`zoomIn`、`zoomOut`、`devTools` | WebView API 可用时生效，不可用时 fallback/toast |
| D-CMD-006 | P0 | Document info | `openDocumentProperties`、`showDocumentLinks`、`showBacklinks`、`showRelationGraph` | Markdown 有效；Text Document 不承诺；无关系时禁用图谱 |
| D-CMD-007 | P0 | Export commands | `exportPdf`、`exportDocx`、`exportHtml`、`exportPng`、`exportWithPrevious`、`exportOverwritePrevious`、`exportSettings` | 导出能力和历史状态决定启用态 |
| D-CMD-008 | P1 | Theme commands | `themeMiaoyan`、`themeInkstone`、`themeSlate`、`themeMono`、`themeNocturne`、`themeCarbon` | 菜单 checked 和设置中心一致 |
| D-CMD-009 | P0 | Help commands | `preferences`、`mdReference`、`migrationGuide`、`showShortcuts`、`checkUpdate`、`github`、`feedback`、`about` | 弹窗/外链/更新最终态均可验证 |
| D-CMD-010 | P1 | 命令注册质量 | 扫描 registry | ID 唯一；快捷键冲突可解释；i18n label/category 完整 |

### N. 平台、发布和长期稳定性

| ID | 优先级 | 覆盖项 | 操作 | 必验断言 |
|---|---|---|---|---|
| D-PLAT-001 | P2 | macOS app identity | `plutil -p Prism.app/Contents/Info.plist` | `CFBundleIdentifier=com.prism.editor.v1`；文档类型注册正确 |
| D-PLAT-002 | P2 | macOS 文件关联 | Finder 双击 `.md/.markdown/.txt/.json/.sql` | Prism 打开对应文件；多文件策略正确 |
| D-PLAT-003 | P2 | Windows 安装器和文件关联 | 安装、双击文件、卸载 | 开始菜单、卸载、文件关联、路径含中文空格均正常 |
| D-PLAT-004 | P2 | Linux 包和文件关联 | 安装、打开文件、卸载 | 桌面环境差异写清楚；不能用 macOS 代替 |
| D-PLAT-005 | P2 | Updater assets | 正式构建、生成 manifest、`--check` | `.sig`、URL、version、pub_date 正确；signature 改变会失败 |
| D-SEC-001 | P0 | 文件系统权限 | 检查 `src-tauri/capabilities` 和真实授权 | 无静态全盘 `**` scope；打开目录后只授权需要范围 |
| D-A11Y-001 | P2 | 键盘可达 | 只用键盘完成打开、搜索、切视图、保存、导出设置 | 焦点顺序合理；Esc/Enter/Tab 行为一致 |
| D-A11Y-002 | P2 | 可读性 | 明暗主题、高对比、缩放 125%/150% | 文字不重叠；错误/选区/链接不只靠颜色 |
| D-PERF-001 | P0 | 真实预览性能 | 1MB/3MB 文档打开、切预览、滚动、搜索、右键、源码定位 | 记录耗时；不能只用 jsdom 结论 |
| D-PERF-002 | P1 | 导出性能 | 复杂长文 PDF/PNG/DOCX | 长任务有反馈；失败可诊断；不会卡死 |
| D-PERF-003 | P2 | 长时运行 | 连续编辑/搜索/预览/导出 30 分钟 | 内存无持续增长；自动保存和快捷键仍响应 |

## 自动化落地建议

1. UT/INT 优先补齐：Document Profile、recent files、workspace index query、command registry、export diagnostics、settings migration、theme contract。
2. APP smoke 优先覆盖：启动打开文件、多 pending files、保存冲突、分栏预览、快速打开、导出成功/失败、设置持久化。
3. VIS 截图基线按主题和窗口尺寸采样，不要求每个控件都截图，但 P0 用户路径必须有真实 App 证据。
4. 性能用例必须在真实 Tauri WebView 里跑，不能只用 jsdom/Node 基准替代。
5. 每次发布至少执行全部 P0；P1 根据变更范围选择；P2 在发布包、平台适配或视觉变更时执行。

## 执行记录模板

```text
执行日期：
Prism 版本 / commit：
平台 / 架构：
构建产物：
测试范围：P0 全量 / P1 子集 / P2 平台项
未执行原因：
失败用例：
截图目录：
导出产物：
结论：通过 / 未通过 / 阻塞
```
