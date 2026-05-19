export type MarkdownTemplateId =
  | 'readme'
  | 'prd'
  | 'meeting'
  | 'weekly'
  | 'technicalPlan'
  | 'article'
  | 'paperDraft'
  | 'readingNote'
  | 'researchSummary'
  | 'whitePaper';

interface MarkdownTemplate {
  content: string;
  filename: string;
  id: MarkdownTemplateId;
  label: string;
}

export interface MarkdownTemplateVariables {
  author?: string;
  date?: string;
  title?: string;
}

interface MarkdownTemplateInsertEdit {
  from: number;
  insert: string;
  selectionFrom: number;
  selectionTo: number;
  to: number;
}

export const MARKDOWN_TEMPLATES: Record<MarkdownTemplateId, MarkdownTemplate> = {
  readme: {
    id: 'readme',
    label: 'README',
    filename: 'README.md',
    content: `# 项目名称

## 简介

一句话说明这个项目解决什么问题。

## 快速开始

\`\`\`bash
npm install
npm run dev
\`\`\`

## 核心能力

- 能力一
- 能力二
- 能力三

## 项目结构

\`\`\`text
.
├── src/
└── docs/
\`\`\`

## 许可证

MIT
`,
  },
  prd: {
    id: 'prd',
    label: 'PRD',
    filename: 'prd.md',
    content: `# PRD：{{title}}

## 背景

说明用户问题、业务背景和当前限制。

## 目标

- 目标一
- 目标二

## 非目标

- 本期不做的事项

## 用户故事

作为用户，我希望……，以便……

## 功能范围

### 必须有

- 

### 可以后置

- 

## 验收标准

- [ ] 

## 风险与依赖

- 
`,
  },
  meeting: {
    id: 'meeting',
    label: '会议纪要',
    filename: 'meeting-notes.md',
    content: `# 会议纪要：{{title}}

## 基本信息

- 时间：{{date}}
- 参与人：{{author}}
- 主题：{{title}}

## 结论

- 

## 讨论要点

- 

## 行动项

| 事项 | 负责人 | 截止时间 | 状态 |
| --- | --- | --- | --- |
|  |  |  |  |

## 待确认

- 
`,
  },
  weekly: {
    id: 'weekly',
    label: '周报',
    filename: 'weekly-report.md',
    content: `# 周报：{{date}}

## 本周完成

- 

## 关键进展

- 

## 问题与风险

- 

## 下周计划

- 

## 需要协助

- 
`,
  },
  technicalPlan: {
    id: 'technicalPlan',
    label: '技术方案',
    filename: 'technical-plan.md',
    content: `# 技术方案：{{title}}

## 背景与目标

说明为什么要做，以及成功标准。

## 当前现状

- 

## 方案设计

### 架构

- 

### 数据模型

- 

### 流程

- 

## 兼容性与迁移

- 

## 测试计划

- [ ] 单元测试
- [ ] 集成测试
- [ ] 手动 smoke

## 风险

- 
`,
  },
  article: {
    id: 'article',
    label: '公众号长文',
    filename: 'article.md',
    content: `# {{title}}

## 开场

用一个具体场景或问题引入。

## 核心观点

一句话说明本文要表达的判断。

## 正文

### 第一部分

-

### 第二部分

-

### 第三部分

-

## 总结

收束观点，并给出可执行的下一步。
`,
  },
  paperDraft: {
    id: 'paperDraft',
    label: '论文草稿',
    filename: 'paper-draft.md',
    content: `# {{title}}

## 摘要

用 150-300 字说明研究问题、方法、主要发现和贡献。

## 关键词

- 关键词一
- 关键词二
- 关键词三

## 1. 引言

### 研究背景

说明问题来源、现实或理论背景。

### 研究问题

- 问题一：
- 问题二：

### 本文贡献

- 

## 2. 相关研究

按主题组织已有研究，不只按作者罗列。

## 3. 方法

说明数据来源、研究设计、分析方法和限制。

## 4. 结果

### 主要发现

- 

### 稳健性或补充分析

- 

## 5. 讨论

解释结果含义、适用边界和可能机制。

## 6. 结论

总结回答研究问题，并说明后续研究方向。

## 参考文献

- 
`,
  },
  readingNote: {
    id: 'readingNote',
    label: '读书笔记',
    filename: 'reading-note.md',
    content: `# 读书笔记：{{title}}

## 基本信息

- 作者：
- 出版信息：
- 阅读日期：{{date}}
- 主题标签：

## 一句话总结

用一句话说明这本书最重要的判断。

## 核心观点

1. 
2. 
3. 

## 关键摘录

> 

## 我的理解

这本书解决了什么问题？哪些论证最有价值？

## 可迁移的方法

- 

## 仍需追问

- 
`,
  },
  researchSummary: {
    id: 'researchSummary',
    label: '研究摘要',
    filename: 'research-summary.md',
    content: `# 研究摘要：{{title}}

## 研究问题

本摘要试图回答什么问题？

## 背景与动机

- 

## 资料来源

| 来源 | 类型 | 可信度 | 备注 |
| --- | --- | --- | --- |
|  |  |  |  |

## 关键发现

1. 
2. 
3. 

## 证据链

- 发现：
  - 证据：
  - 解释：

## 不确定性

- 

## 下一步

- 
`,
  },
  whitePaper: {
    id: 'whitePaper',
    label: '白皮书',
    filename: 'white-paper.md',
    content: `# {{title}}

## 执行摘要

说明问题、机会、方案和预期影响。

## 背景

- 行业现状：
- 用户痛点：
- 约束条件：

## 核心判断

1. 
2. 
3. 

## 方案

### 目标

- 

### 能力边界

- 

### 实施路径

| 阶段 | 目标 | 交付物 | 风险 |
| --- | --- | --- | --- |
|  |  |  |  |

## 影响评估

- 用户价值：
- 业务价值：
- 成本与风险：

## 结论

给出明确建议和下一步行动。
`,
  },
};

export function isMarkdownTemplateId(value: unknown): value is MarkdownTemplateId {
  return typeof value === 'string' && value in MARKDOWN_TEMPLATES;
}

function defaultTemplateDate() {
  return new Date().toISOString().slice(0, 10);
}

export function resolveMarkdownTemplateContent(
  content: string,
  variables: MarkdownTemplateVariables = {},
): string {
  const values: Required<MarkdownTemplateVariables> = {
    author: variables.author ?? '',
    date: variables.date ?? defaultTemplateDate(),
    title: variables.title ?? '未命名',
  };

  return content.replace(/\{\{(date|title|author)\}\}/g, (_match, key: keyof MarkdownTemplateVariables) => values[key]);
}

export function getMarkdownTemplateInsertEdit(
  doc: string,
  selectionFrom: number,
  selectionTo: number,
  templateId: MarkdownTemplateId,
  variables: MarkdownTemplateVariables = {},
): MarkdownTemplateInsertEdit {
  const template = MARKDOWN_TEMPLATES[templateId];
  const content = resolveMarkdownTemplateContent(template.content, variables);
  const leadingNewline = selectionFrom > 0 && doc[selectionFrom - 1] !== '\n' ? '\n\n' : '';
  const trailingNewline = selectionTo < doc.length && doc[selectionTo] !== '\n' ? '\n\n' : '';
  const insert = `${leadingNewline}${content.trimEnd()}${trailingNewline}`;
  const selection = selectionFrom + insert.length;

  return {
    from: selectionFrom,
    to: selectionTo,
    insert,
    selectionFrom: selection,
    selectionTo: selection,
  };
}
