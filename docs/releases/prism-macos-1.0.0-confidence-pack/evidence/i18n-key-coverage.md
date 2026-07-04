# i18n Key Coverage Evidence

> Captured: 2026-07-04 02:29:27 CST
> Source: `src/domains/i18n/resources.ts`

## Initial Finding

The release confidence pass found that English had complete key coverage, while Japanese had 36 UI keys falling back to English through `...enUS`.

The missing Japanese-owned keys were:

```text
common.appName
command.yaml
command.themeMiaoyan
command.themeInkstone
command.themeSlate
command.themeMono
command.themeNocturne
command.themeCarbon
about.footnote
settings.shortcutStyle.auto
settings.shortcutStyle.mac
settings.shortcutStyle.windows
settings.contentTheme.hint
settings.themeManagement.userHint
settings.themeManagement.hint
settings.themeManagement.localTheme
settings.importFont.hint
settings.pdfPaper.hint
settings.frontMatterOverrides.hint
settings.toc.hint
settings.pdfMargin.hint
settings.pageNumbers.hint
settings.headerFooter.hint
settings.headerText.hint
settings.footerText.hint
settings.customExportDirectory.hint
settings.docxFont.hint
settings.docxCustomFont.hint
settings.htmlIncludeTheme.hint
settings.pandocPath.placeholder
settings.pandoc.hint
settings.bibliography.placeholder
settings.csl.placeholder
export.format.html
export.format.pdf
export.format.docx
```

## Fix

The keys above were added to `jaJP` in `src/domains/i18n/resources.ts`.

## Coverage Check Command

```bash
node - <<'NODE'
const fs=require('fs');
const s=fs.readFileSync('src/domains/i18n/resources.ts','utf8');
function body(name){ const start=s.indexOf(name); const brace=s.indexOf('{', start); let depth=0, inStr=false, quote='', esc=false; for(let i=brace;i<s.length;i++){ const c=s[i]; if(inStr){ if(esc) esc=false; else if(c==='\\\\') esc=true; else if(c===quote) inStr=false; continue; } if(c==='"'||c==="'"||c==='`'){ inStr=true; quote=c; continue; } if(c==='{') depth++; if(c==='}') { depth--; if(depth===0) return s.slice(brace+1,i); } } }
function keys(b){ const re=/['"]([^'"]+)['"]\s*:/g; let m,a=[]; while((m=re.exec(b))) a.push(m[1]); return a; }
const zh=keys(body('export const zhCN'));
const en=keys(body('const enUS'));
const ja=keys(body('const jaJP'));
const set=a=>new Set(a);
function missing(a,b){ const sb=set(b); return a.filter(k=>!sb.has(k)); }
console.log(JSON.stringify({zh:zh.length,en:en.length,ja:ja.length,missingInEn:missing(zh,en),missingInJa:missing(zh,ja),extraInEn:missing(en,zh),extraInJa:missing(ja,zh)}, null, 2));
NODE
```

## Coverage Check Result

```json
{
  "zh": 1106,
  "en": 1106,
  "ja": 1106,
  "missingInEn": [],
  "missingInJa": [],
  "extraInEn": [],
  "extraInJa": []
}
```

## Unit Test Command

```bash
npm test -- --run src/domains/i18n/i18n.test.ts
```

## Unit Test Result

```text
Test Files  1 passed (1)
Tests  3 passed (3)
```

## Release Interpretation

- Chinese, English, and Japanese now have complete i18n key coverage.
- This closes the missing-key part of the language release gate.
- A real UI screenshot pass in English and Japanese is still required before final Go, because key coverage does not prove layout fit or native phrasing in context.
