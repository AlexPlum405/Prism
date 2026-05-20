import type { SettingsState } from '../settings/types';
import { getThemeEntry } from '../themes';
import { getExportFormatLabel, type ExportFormat } from './types';

function formatExportDiagnosticError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error instanceof Event) return error.type || '未知事件错误';
  return String(error);
}

function hasSupportedCitationPathExtension(path: string, extensions: string[]) {
  const normalized = path.trim().toLowerCase();
  return normalized.length === 0 || extensions.some((extension) => normalized.endsWith(extension));
}

export function getExportCitationPathValidation(citation: SettingsState['citation']) {
  const issues: string[] = [];
  if (!hasSupportedCitationPathExtension(citation.bibliographyPath, ['.bib', '.bibtex', '.json'])) {
    issues.push('参考文献文件后缀需为 .bib / .bibtex / .json');
  }
  if (!hasSupportedCitationPathExtension(citation.cslStylePath, ['.csl'])) {
    issues.push('CSL 样式文件后缀需为 .csl');
  }
  if (!citation.bibliographyPath.trim() && citation.cslStylePath.trim()) {
    issues.push('缺少参考文献文件');
  }
  return issues.length > 0 ? issues.join('；') : '通过';
}

export function buildExportFailureDiagnostic(input: {
  format: ExportFormat;
  documentName: string;
  documentPath: string;
  outputPath?: string | null;
  stage: string;
  settings: SettingsState;
  warnings?: string[];
  error: unknown;
}) {
  const errorMessage = formatExportDiagnosticError(input.error);
  const stack = input.error instanceof Error && input.error.stack
    ? input.error.stack
    : '';
  const pandoc = input.settings.pandoc;
  const themeEntry = getThemeEntry(input.settings.contentTheme);
  const themeSource = themeEntry?.source ?? 'fallback';
  const pandocStatus = pandoc.lastCheckedAt === null
    ? '未检测'
    : pandoc.detected
      ? '可用'
      : '不可用';
  const citation = input.settings.citation;
  const citationPathValidation = getExportCitationPathValidation(citation);
  const citationPandocReady = pandoc.detected && Boolean(citation.bibliographyPath) && citationPathValidation === '通过';
  return [
    'Prism 导出失败诊断',
    `时间: ${new Date().toISOString()}`,
    `格式: ${getExportFormatLabel(input.format)} (${input.format})`,
    `阶段: ${input.stage}`,
    `文档: ${input.documentName}`,
    `文档路径: ${input.documentPath || '(未保存)'}`,
    `输出路径: ${input.outputPath || '(未选择)'}`,
    `内容主题: ${input.settings.contentTheme}`,
    `主题名称: ${themeEntry?.label ?? 'Miaoyan fallback'}`,
    `主题来源: ${themeSource}`,
    `用户主题 CSS: ${themeEntry?.source === 'user' ? '启用' : '未启用'}`,
    themeEntry?.error ? `主题异常: ${themeEntry.error}` : '',
    `导出模板: ${input.settings.exportDefaults.templateId}`,
    `Front matter 覆盖: ${input.settings.exportDefaults.frontMatterOverrides ? '开启' : '关闭'}`,
    `目录: ${input.settings.exportDefaults.toc ? '开启' : '关闭'}`,
    `默认导出位置: ${input.settings.exportDefaults.defaultLocation}`,
    `PDF 纸张: ${input.settings.exportDefaults.pdfPaper}`,
    `PDF 边距: ${input.settings.exportDefaults.pdfMargin}`,
    `页码: ${input.settings.exportDefaults.pdfPageNumbers ? '开启' : '关闭'}`,
    `页眉页脚: ${input.settings.exportDefaults.pageHeaderFooter ? '开启' : '关闭'}`,
    `页眉文本: ${input.settings.exportDefaults.pageHeaderText || '(空)'}`,
    `页脚文本: ${input.settings.exportDefaults.pageFooterText || '(空)'}`,
    `导出清晰度: ${input.settings.exportDefaults.pngScale}x`,
    `HTML 内联主题: ${input.settings.exportDefaults.htmlIncludeTheme ? '是' : '否'}`,
    `DOCX 字体策略: ${input.settings.exportDefaults.docxFontPolicy}`,
    `DOCX 自定义字体: ${input.settings.exportDefaults.docxCustomFontId || '(未指定)'}`,
    `参考文献文件: ${citation.bibliographyPath || '(未配置)'}`,
    `CSL 样式文件: ${citation.cslStylePath || '(未配置)'}`,
    `引用路径校验: ${citationPathValidation}`,
    `Pandoc 引用条件: ${citationPandocReady ? '满足' : '未满足'}`,
    `Pandoc 状态: ${pandocStatus}`,
    `Pandoc 路径: ${pandoc.path || '(系统 pandoc)'}`,
    pandoc.version ? `Pandoc 版本: ${pandoc.version}` : '',
    pandoc.lastError ? `Pandoc 错误: ${pandoc.lastError}` : '',
    input.warnings?.length
      ? `导出警告:\n${input.warnings.map((message) => `- ${message}`).join('\n')}`
      : '',
    `错误: ${errorMessage}`,
    stack ? `堆栈:\n${stack}` : '',
  ].filter(Boolean).join('\n');
}
