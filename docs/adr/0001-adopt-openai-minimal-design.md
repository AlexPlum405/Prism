# 采用 OpenAI 极简作为唯一设计方向

状态：已被 ADR-0005 取代。2026-05-19 起，Prism 当前主视觉方向调整为妙言风格；本文仅记录 2026-05-10 的历史决策背景。

2026-05-10：将视觉与交互的唯一参考标准从原根目录 `prism.html`（Win11 Fluent Design，现归档到 `docs/archive/dirty-data-2026-05-30/history/prism.html`）切换为 `docs/prism-openai-redesign.html`（OpenAI 极简，纯黑白双锚点 / 药丸 + 近方形卡片两种形状 / Inter + JetBrains Mono 字体 / 留白替代阴影）。两者为互斥的视觉语言，不存在融合中间态，因此直接替换而非并行保留。放弃与 Windows 11 原生外观一致性，换取更高的"留白即主体"产品叙事。
