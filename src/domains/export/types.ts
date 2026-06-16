import type {
  ContentTheme,
  CitationSettings,
  DocxFontPolicy,
  ExportTemplateId,
  PandocSettings,
  PdfMargin,
  PdfPaper,
} from '../settings/types';
import { t } from '../i18n/runtime';
import type { AppLocale, LocalePreference } from '../i18n/types';
import type { ExportFrontMatter } from './frontMatter';

export type ExportFormat = 'html' | 'pdf' | 'docx' | 'png';

export interface ExportDocumentInput {
  content: string;
  filename: string;
  documentPath?: string;
  title?: string;
  author?: string;
  date?: string;
  contentTheme: ContentTheme;
  htmlIncludeTheme?: boolean;
  pngScale?: number;
  pdfPaper?: PdfPaper;
  pdfMargin?: PdfMargin;
  pdfPageNumbers?: boolean;
  pageHeaderFooter?: boolean;
  pageHeaderText?: string;
  pageFooterText?: string;
  toc?: boolean;
  frontMatter?: ExportFrontMatter | null;
  templateId?: ExportTemplateId;
  codeStyle?: 'theme' | 'boxed' | 'plain';
  tableStyle?: 'theme' | 'grid' | 'minimal';
  citation?: CitationSettings;
  pandoc?: PandocSettings;
  docxFontFamily?: string;
  docxFontFile?: {
    filename: string;
    path: string;
    format: 'ttf' | 'otf' | 'woff' | 'woff2';
  };
  docxFontPolicy?: DocxFontPolicy;
  locale?: AppLocale;
  localePreference?: LocalePreference;
  onProgress?: (message: string) => void;
  onWarning?: (message: string) => void;
}

export const exportFormatLabels: Record<ExportFormat, string> = {
  html: 'HTML',
  pdf: 'PDF',
  docx: 'Word',
  png: 'PNG Image',
};

export function getExportFormatLabel(format: ExportFormat) {
  switch (format) {
    case 'html':
      return t('export.format.html');
    case 'pdf':
      return t('export.format.pdf');
    case 'docx':
      return t('export.format.docx');
    case 'png':
      return t('export.format.png');
    default:
      return exportFormatLabels[format];
  }
}
