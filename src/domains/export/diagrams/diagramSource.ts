/**
 * 判断一段代码围栏到底是哪种图表，用来决定导出时是当代码块还是当图渲染。
 *
 * 只看语言标记不够：很多编辑器把 mermaid 的围栏写成 ```text 或干脆不写，
 * 所以还要看首行特征。markmap 更麻烦，它和「mindmap 语法的普通缩进列表」
 * 长得一样，因此额外要求出现标题或列表符号才认。
 */
export function isMermaidSource(value: string, lang?: string | null) {
  const normalizedLang = (lang ?? '').trim().toLowerCase();
  if (normalizedLang === 'mermaid' || normalizedLang === 'mmd') return true;
  const source = value.trimStart();
  return /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|quadrantChart|requirementDiagram|gitGraph|C4Context)\b/.test(source);
}

export function normalizeDiagramLanguage(language: unknown) {
  return String(language ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export function isPlantUmlSource(value: string, lang?: string | null) {
  const normalizedLang = normalizeDiagramLanguage(lang);
  if (normalizedLang === 'plantuml' || normalizedLang === 'puml') return true;
  return /^\s*@startuml\b/i.test(value);
}

export function isMarkmapSource(value: string, lang?: string | null) {
  const normalizedLang = normalizeDiagramLanguage(lang);
  if (normalizedLang === 'markmap') return true;
  return normalizedLang === 'mindmap'
    && /^\s{0,3}(?:#{1,6}\s+\S|[-+*]\s+\S|\d+[.)]\s+\S)/m.test(value);
}

