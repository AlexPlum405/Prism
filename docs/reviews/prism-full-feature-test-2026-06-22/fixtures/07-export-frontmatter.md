---
title: Export Fixture
subtitle: Verifies export front matter
author: Prism QA
date: 2026-06-22
toc: true
pageNumbers: true
---

# Export Fixture

This document is used for PDF, Word, HTML, and PNG export smoke tests.

## Content

The exported output should include headings, paragraphs, a table, and a code block.

| Format | Expected |
| --- | --- |
| PDF | Document file created |
| HTML | Theme inclusion option works |
| DOCX | Font policy applied |
| PNG | Image export completes |

```sql
select id, title from documents where status = 'ready';
```
