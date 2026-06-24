# Prism 内置内容主题优化计划

日期：2026-06-23

范围：Inkstone Light、Slate Manual、Mono Lab、Nocturne Dark。MiaoYan 主题本轮已按 MiaoYan 源码校准编辑区 inset 与预览宽度语义，本计划用于保证其他内置主题的质量不低于 MiaoYan，但不把它们做成 MiaoYan 的换皮。

## 当前结论

MiaoYan 的质量标准不是“所有主题都全宽”，而是主题的编辑、预览、导出、代码块、表格、长文档阅读和跨平台字体 fallback 有一致的设计逻辑。MiaoYan 主题要复刻 MiaoYan 源码，因此预览使用 `#write { max-width: 100%; padding: 0 28px 80px; }`，编辑区使用默认全宽和 24px inset。

其他主题应保持各自定位：

- Inkstone Light：中文长文和纸感阅读，重视段落节奏和低疲劳。
- Slate Manual：技术手册和产品文档，重视表格、代码、层级扫描。
- Mono Lab：工程笔记、日志、纯文本和代码密集内容，重视等宽密度。
- Nocturne Dark：夜间长读和暗色写作，重视低眩光、对比度和可持续阅读。

## 证据基线

- MiaoYan 源码预览基线：`/Users/Alex/AI/project/MiaoYan/Resources/DownView.bundle/css/typography.css` 中 `#write` 为 `margin: 0`、`max-width: 100%`、`padding: 0 28px 80px`。
- MiaoYan 源码基础基线：`/Users/Alex/AI/project/MiaoYan/Resources/DownView.bundle/css/base.css` 中 `.heti` 和 `.markdown-body` 都是 `max-width: 100%`。
- MiaoYan 源码编辑基线：`/Users/Alex/AI/project/MiaoYan/Helpers/UserDefaultsManagement.swift` 中 `lineWidth = 1000`、`marginSize = 24`；`/Users/Alex/AI/project/MiaoYan/Views/EditTextView.swift` 在 `lineWidth == 1000` 时只设置左右 margin，不做居中限宽。
- Prism 当前其他主题预览基线：`/Users/Alex/AI/project/Prism/src/styles/content-themes.css` 中 Inkstone、Slate、Mono 为 `--preview-max-width: 1000px`，Nocturne 为 `920px`。
- Prism 当前其他主题编辑基线：`/Users/Alex/AI/project/Prism/src/styles/editor.css` 中四套非 MiaoYan 主题均使用 24px gutter、14px 顶部 padding、96px 底部 padding，Inkstone、Slate、Mono、Nocturne 都使用 `max-width: calc(1000px + gutter * 2)`。
- Prism 当前主题契约基线：`/Users/Alex/AI/project/Prism/src/domains/themes/themeContract.ts` 中 Inkstone、Slate、Mono 的 `preview.maxWidth` 为 1000，Nocturne 为 920。

## 统一质量门槛

每套主题进入实现前必须满足这些设计验收口径：

- 编辑与预览有同一套字体策略：正文、代码、Markdown token、搜索命中、选区、光标不能各自散开。
- `preview.maxWidth` 必须表达主题真实意图：MiaoYan 可以是 `none`，其他主题若使用有界阅读宽度，需要在 CSS 变量、`#write` 规则和 `themeContract` 中一致。
- 标题层级必须可扫描：H1/H2/H3 的字号、上间距、下间距和字重有明确层级，不能只靠颜色变化。
- 长文阅读不疲劳：1440px、1024px、窄窗口下正文每行长度、段距、行高稳定，滚动到底部不出现布局漂移。
- 代码和表格必须优先验收：主题不能只在普通段落好看，代码块、行内代码、表格、引用、callout、Mermaid、KaTeX 都必须可读。
- 编辑和导出不能割裂：PDF、HTML、DOCX 至少保留主题字体、文本色、强调色、代码背景和表格边界的同一气质。
- 跨平台字体 fallback 明确：macOS、Windows、Linux 都要给出中英文正文字体和 monospace fallback，不依赖某个闭源或未安装字体才成立。

## P0：先固定主题 contract 与验收脚手架

状态：本轮已开始。

任务：

- 让 `ThemeContract.preview.maxWidth` 支持 `number | 'none'`，MiaoYan 使用 `none`，其他内置主题继续用明确数字。
- 用户主题导入允许 `preview.maxWidth: "none"`，数字值继续按 520 到 1280 clamp。
- 在 CSS 测试中锁定 MiaoYan 预览全宽和编辑 24px inset，防止后续被旧的 1000px 居中逻辑覆盖。

验收：

- `npm test -- --run src/domains/themes/themeContract.test.ts src/domains/themes/themePackage.test.ts src/styles/global.test.ts`
- `npm run build`
- MiaoYan contract 为 `preview.maxWidth === 'none'`。
- Inkstone、Slate、Mono、Nocturne contract 仍有数字阅读宽度。

## P1：Inkstone Light 优化计划

定位：中文长文、读书笔记、散文、公众号草稿。它不应该像 MiaoYan 一样完全跟随源码复刻，也不应该像技术文档主题一样高密度。核心是“暖纸、缓慢阅读、中文段落友好”。

当前问题：

- 预览宽度固定 1000px，中文长文在 1440px 窗口中可接受，但窄窗口、表格和图片的处理没有独立策略。
- 编辑区和预览区虽然都是 1.74 line-height，但标题、引用、代码块仍偏通用，没有形成纸感主题自己的节奏。
- `Kaiti SC` fallback 适合中文气质，但 Windows/Linux 没有同等品质 fallback 策略，跨平台可能掉到普通 serif。

推荐改法：

- 预览：保留有界阅读宽度，但将 `#write` 改为 `max-width: min(100%, 980px)` 或 CSS 变量 `--preview-max-width: 980px`，左右 padding 从 28px 提升到 32px，窄窗口使用 22px。
- 正文：保持 16px，行高从 1.74 评估到 1.78，段落上下间距保持 MiaoYan 级别但弱化标题前后拥挤。
- 标题：H1/H2 使用更沉稳的墨绿或暖褐，字重不要过重，H3 以下保持正文附近比例，避免像报告模板。
- 编辑区：gutter 维持 24px 到 28px，正文 max-width 与预览同源，但在分栏模式允许编辑区稍窄以减少横向跳动。
- 代码块：背景保持暖灰，不使用高饱和语法色；行内代码应有轻微纸面压印感，但不能影响中文行高。
- 表格：表头使用极浅暖底色，边框透明度降低，长表格允许横向滚动，不能把整列压得不可读。
- 图片、公式、Mermaid：图片最大宽度 100%，公式居中但不加额外卡片，Mermaid 节点使用纸色填充和墨绿边框。
- 导出：DOCX 字体优先 `Kaiti SC`、`STKaiti`、`Songti SC`，HTML 与 PDF 使用同一 CSS 变量，表格和代码块颜色与预览一致。

验收指标：

- `01-markdown-showcase.md` 在 1440x960、1024x768、窄窗口下无正文溢出。
- 中文段落每行字数目标约 32 到 42 个汉字，窄窗口不低于 18 个汉字。
- 表格、代码块、引用、公式、Mermaid 截图均可读，暗色系统模式不影响浅色主题。
- HTML/PDF 导出截图与预览首屏色彩差异不超过肉眼明显漂移。

风险：

- 过度纸感会降低技术文档可读性。Inkstone 不应承担所有场景，只服务中文长文。
- Kai 字体跨平台 fallback 可能波动，需要实机截图验证。

## P1：Slate Manual 优化计划

定位：技术手册、产品文档、API 文档、知识库页面。核心是“清晰、稳定、表格和代码优先”。

当前问题：

- 目前与 Inkstone、Mono 一样使用 1000px 宽度和相近行高，主题差异主要来自颜色与字体，功能性差异不够强。
- 技术文档常见的表格、代码块、二级标题扫描没有单独优化。
- 编辑区仍有 0.5px letter-spacing，对英文、代码密集文档可能显得松。

推荐改法：

- 预览：保留 `--preview-max-width: 1000px` 到 `1040px`，但表格和代码块允许局部突破 `#write` 形成横向滚动容器。
- 正文：正文 16px、line-height 1.68 到 1.72；英文段落不要额外字距，中文保持系统字距。
- 标题：H2/H3 要更适合扫描，H2 可增加轻量 divider 或下边距，但不要做卡片式标题。
- 编辑区：`letter-spacing` 对 Slate 降为 0，Markdown token 保持轻度颜色区分，heading 可 500 字重，但不改变行高。
- 代码块：优先改善 token 对比度、行号、复制区域和横向滚动；代码字体 fallback 为 `SFMono-Regular, Menlo, Consolas, Liberation Mono`。
- 表格：表头 sticky 暂不做，先优化表头底色、列间距、边框、窄窗口横向滚动。
- 引用和 callout：使用窄左边线和淡色背景，不使用大面积装饰色。
- 导出：PDF/HTML 保持技术手册风格，DOCX 使用 Arial 或 Aptos fallback，代码块使用 Menlo/Consolas。

验收指标：

- 包含 8 列表格和多语言代码块的文档，在预览和导出 HTML 中不横向污染整页。
- H1/H2/H3 从截图中可在 3 秒内区分层级。
- 代码块 token 在浅色背景上符合最小可辨对比，注释不低于正文背景的可读阈值。
- 编辑区英文和代码密集段落不出现松散发虚的字距。

风险：

- 如果过度强化技术感，Slate 会和 Mono 重叠。Slate 应偏“手册”，Mono 偏“实验室日志”。

## P1：Mono Lab 优化计划

定位：工程日志、纯文本、SQL/JSON/TXT、代码片段密集 Markdown。核心是“等宽、高密度、可对齐”。

当前问题：

- 预览宽度和 Slate、Inkstone 一样为 1000px，未体现等宽文本对行长的特殊要求。
- 16px 等宽正文在长文档中可能过宽，表格和代码则需要更大的横向空间，二者冲突没有被拆开。
- 预览中中文与 monospace 混排需要更强 fallback，避免中文也被错误压成等宽感。

推荐改法：

- 预览：正文列宽设为 1040px 到 1120px，但代码块、表格、Mermaid 使用 `max-width: 100%` 和横向滚动，不强行折行破坏对齐。
- 正文：默认 15px 或 15.5px 评估，line-height 1.62 到 1.68，段落间距比 Inkstone 更紧。
- 编辑区：允许更宽 max-width，gutter 24px，letter-spacing 改为 0，保持等宽对齐。
- Markdown token：heading、link、inline code 的颜色要清楚，但不能改变字体大小或行高。
- 代码块：优先保证 SQL、JSON、TS、Shell 的 token 差异，字符串、关键字、数字、注释必须有稳定层级。
- 表格：Markdown 表格源码编辑时列对齐可读，预览表格间距更紧，长字段允许横向滚动。
- 普通文本文件：Mono 是 `.sql`、`.json`、`.txt` 文本模式最合理的默认候选之一，后续可评估文件类型到主题推荐，但本阶段不自动切换。
- 导出：DOCX 的正文不建议全部等宽，除非用户选择 Mono 导出模板；PDF/HTML 保留等宽气质。

验收指标：

- SQL、JSON、Markdown 表格、代码围栏在编辑区不因 letter-spacing 破坏对齐。
- 1440px 下代码块可横向滚动，页面主体不被撑破。
- 中文段落仍能阅读，不出现明显字符挤压或 fallback 锯齿。
- 导出 HTML 中代码块宽度、背景和字体与预览一致。

风险：

- 全文等宽会牺牲长中文阅读。Mono 不应被设计成默认长文主题。

## P1：Nocturne Dark 优化计划

定位：夜间长读、暗色写作、低眩光预览。核心是“暗而不糊、低刺激但可区分”。

当前问题：

- Nocturne 已经使用 920px 阅读宽度，更接近夜间长读，但编辑区 max-width 仍为 1000px 加 gutter，编辑和预览的阅读节奏不一致。
- 暗色代码块、引用、表格、链接、搜索命中需要单独验收，否则容易出现对比度过低或局部刺眼。
- DOCX 是浅色导出色板，导出和暗色预览之间需要明确预期，不能让用户误以为 DOCX 会是暗色页面。

推荐改法：

- 预览：保留 `--preview-max-width: 920px`，窄窗口 padding 24px，低高度窗口底部 padding 不低于 88px。
- 正文：16px、line-height 1.78，正文色保持暖白但降低纯亮度，二级文字不低于可读对比。
- 标题：不要使用高亮霓虹色，H1/H2 通过大小、间距、轻微暖色区分。
- 编辑区：max-width 与预览统一为 `calc(920px + gutter * 2)` 或明确解释编辑区更宽；建议第一阶段统一到 920px 口径。
- 选区和搜索：当前命中必须清楚可见，非当前命中不能只靠低透明背景。
- 代码块：背景比页面略亮，注释、字符串、关键字在暗色上分层明显，行内代码不能像链接。
- 表格：边框和表头需要可见但不刺眼，表格 hover 暂不做。
- 导出：PDF/HTML 可保留暗色主题，DOCX 默认仍导出浅色可打印版，并在导出设置或文档中明确。

验收指标：

- 30 分钟长文阅读模拟截图中，正文、引用、代码块、表格均无高亮刺眼区域。
- 搜索当前命中和普通命中在暗色背景上可一眼区分。
- Mermaid 节点和边在暗色预览中不丢边框。
- PDF/HTML 暗色导出可读，DOCX 浅色导出策略有明确测试覆盖。

风险：

- 暗色主题最容易被局部 token 颜色破坏，需优先跑代码块和 Mermaid 截图。

## 实施顺序

第一阶段：主题语义与测试基座

- 完成 `preview.maxWidth` 的 `number | 'none'` 语义。
- 为每套内置主题加 CSS 宽度和 editor max-width 回归测试。
- 为 `themePackage` 增加自定义主题 `maxWidth: "none"` 和数字 clamp 测试。

第二阶段：按主题逐个落地

- 先做 Nocturne：暗色主题风险最高，且当前 preview/editor 宽度不一致最明显。
- 再做 Slate：技术文档、表格、代码块覆盖面最广。
- 再做 Inkstone：中文长文细节多，需要截图调参。
- 最后做 Mono：需要确认等宽正文是否作为默认效果，避免影响普通 Markdown。

第三阶段：导出和跨平台验证

- HTML/PDF 与预览一致性验证。
- DOCX 字体 fallback 和浅色/暗色导出策略验证。
- Windows/Linux 只记录真实环境验证，不用推测截图代替。

## 建议验证命令

基础测试：

```bash
npm test -- --run src/domains/themes/themeContract.test.ts src/domains/themes/themePackage.test.ts src/styles/global.test.ts
```

编辑和预览相关回归：

```bash
npm test -- --run src/domains/editor/components/PreviewPane.test.tsx src/domains/export/render/standaloneHtml.test.ts src/domains/export/exportSettings.test.ts
```

构建和静态检查：

```bash
npm run build
git diff --check
```

截图验收建议：

```bash
node scripts/run-prism-issue-regression.mjs --app /Applications/Prism.app --baseline docs/reviews/prism-full-feature-test-2026-06-22
```

需要补充的截图矩阵：

- 每个主题：源码模式、分栏模式、完整预览。
- 每个主题：标题、段落、列表、引用、callout、代码块、表格、图片、KaTeX、Mermaid。
- 每个主题：1440x960、1024x768、窄窗口、低高度窗口。
- Nocturne 额外覆盖暗色搜索命中、选区、Mermaid。
- Mono 额外覆盖 `.sql`、`.json`、`.txt` 普通文本文件。

## 暂不做

- 不把 Inkstone、Slate、Mono、Nocturne 全部改成 MiaoYan 的 `max-width: none`。
- 不把其他主题的品牌气质抹平为同一种字体和间距。
- 不在没有 Windows/Linux 真机截图前声称跨平台验收通过。
- 不把 DOCX 暗色导出默认化，除非后续产品决策确认。

