# Claude 工作指南

## 语言偏好

**始终使用中文与用户交流。**

- 所有对话、问题、设计讨论都用中文
- 代码注释可以用英文（遵循行业惯例）
- 文档、设计文档、规划文档都用中文
- commit message 用中文

## 项目背景

Prism 是一个 Markdown 桌面编辑器，基于 Tauri 2 + React + TypeScript，当前采用 **妙言风格（Miaoyan-style）** 作为主视觉方向。

视觉与交互以当前 app 的妙言式 macOS Markdown 写作器体验为主。`docs/prism-openai-redesign.html` 是历史 OpenAI 极简原型，只作为早期参考保留，不再是唯一标准。领域术语与核心决策见 `CONTEXT.md`，架构决策见 `docs/adr/`。

当前状态：
- 核心编辑功能已实现（编辑/分栏/预览、自动保存、KaTeX、Mermaid）
- 产品定位为 Typora 式单文档单窗口
- 视觉主方向已从历史 OpenAI 极简原型调整为当前妙言风格

## 工作原则

1. **使用 superpowers 工作流**
   - 任何新功能或重构都先走 brainstorming → writing-plans → executing-plans
   - 不要跳过设计阶段直接写代码

2. **原型对齐优先**
   - 当前 app 的妙言风格是视觉和交互的主参考
   - 实现时要对齐现有界面的令牌、间距、颜色、动画、交互反馈
   - 术语、设计哲学与关键决策请先读 `CONTEXT.md` 与 `docs/adr/`

3. **产品决策权在用户**
   - 如果用户说"这个不对"或"改成这样"，立即调整
   - 不要坚持技术方案或设计理念，用户体验优先

4. **诚实汇报进度**
   - 不要说"完成了"除非真的完成了
   - 遇到问题或不确定时，明确说出来

## 当前待办

历史 OpenAI 风格重构批次仅作为已发生背景，不再作为新功能的唯一视觉路线。后续优化以 `CONTEXT.md` 中确认的妙言风格和增量计划为准：

1. 不破坏现有妙言风格视觉
2. 不移动已确认保留的入口
3. 按状态栏、命令面板、斜杠菜单、工作区索引、链接/反链/图谱、属性、模板、块操作、导出保真的顺序增量推进

## Agent skills

### Issue tracker

使用 GitHub Issues（仓库：AlexPlum405/Prism），通过 `gh` CLI 操作。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用规范默认标签：needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文布局：仓库根目录一份 `CONTEXT.md` + `docs/adr/`。详见 `docs/agents/domain.md`。
