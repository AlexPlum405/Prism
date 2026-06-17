# CSS 令牌命名沿用原型的 `--c-*` 语义词

状态：已被 ADR-0008 收束。`--c-*` 仍作为历史核心层保留，但 `--bg-*` / `--text-*` / `--accent*` 过渡别名并未一次性移除；后续按组件渐进迁移，新增 UI 不再扩展旧别名。

2026-05-10：`global.css` 重写时直接采用原型的语义色命名 `--c-void / --c-canvas / --c-fog / --c-chalk / --c-graphite / --c-ash / --c-hair / --c-hover / --c-selection`，而非行业常见的 `--bg-primary / --text-primary / --border-subtle` 等功能命名。全代码库 module CSS 的引用随之迁移。

## Considered Options
- **沿用旧的 `--bg-surface / --accent` 命名，只换值**：不改 module CSS 引用；但每次看代码都要手工把原型里的 `--c-fog` 映射到 `--bg-divider`，长期是不断的认知税。
- **双层别名（新旧共存）**：过渡期无痛，但引入永久的重定向层，属于"未来永远不会清理"的技术债。

## Consequences
- 全项目 CSS 引用迁移是一次性的工作量，必须在 Batch 1 完成，否则后续批次会两套并存。
- 颜色以外的 token（间距、动画曲线等）沿用原型写法，保持整套命名的视觉一致。
