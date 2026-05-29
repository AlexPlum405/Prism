import type { useDocumentStore } from '../document/store';
import type { useSettingsStore } from '../settings/store';
import type { useWorkspaceStore } from '../workspace/store';
import type { ExportFormat } from '../export';
import type { ToastInput } from '../../lib/toast';

export type CommandCategory =
  | 'file'
  | 'edit'
  | 'insert'
  | 'format'
  | 'view'
  | 'theme'
  | 'window'
  | 'help';

export type CommandId =
  | 'new'
  | 'newWindow'
  | 'open'
  | 'openFolder'
  | 'quickOpen'
  | 'save'
  | 'saveAs'
  | 'openDocumentProperties'
  | 'showDocumentLinks'
  | 'showBacklinks'
  | 'showRelationGraph'
  | 'templateReadme'
  | 'templatePrd'
  | 'templateMeeting'
  | 'templateWeekly'
  | 'templateTechnicalPlan'
  | 'templateArticle'
  | 'templatePaperDraft'
  | 'templateReadingNote'
  | 'templateResearchSummary'
  | 'templateWhitePaper'
  | 'print'
  | 'openCurrentLocation'
  | 'closeDocument'
  | 'exportHtml'
  | 'exportPdf'
  | 'exportDocx'
  | 'exportPng'
  | 'exportWithPrevious'
  | 'exportOverwritePrevious'
  | 'exportSettings'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'pastePlain'
  | 'selectAll'
  | 'showSearch'
  | 'workspaceSearch'
  | 'showReplace'
  | 'copyPlain'
  | 'copyMd'
  | 'copyHtml'
  | 'link'
  | 'insertImage'
  | 'insertCallout'
  | 'insertToggle'
  | 'codeBlock'
  | 'mathBlock'
  | 'quote'
  | 'orderedList'
  | 'unorderedList'
  | 'taskList'
  | 'insertTable'
  | 'formatTable'
  | 'addTableRow'
  | 'addTableColumn'
  | 'deleteTableRow'
  | 'deleteTableColumn'
  | 'alignTableColumnLeft'
  | 'alignTableColumnCenter'
  | 'alignTableColumnRight'
  | 'insertTableRowAbove'
  | 'insertTableRowBelow'
  | 'insertTableColumnLeft'
  | 'insertTableColumnRight'
  | 'moveTableRowUp'
  | 'moveTableRowDown'
  | 'moveTableColumnLeft'
  | 'moveTableColumnRight'
  | 'selectTable'
  | 'copyTableMarkdown'
  | 'copyTableHtml'
  | 'copyTableCsv'
  | 'copyTableTsv'
  | 'sortTableAsc'
  | 'sortTableDesc'
  | 'convertTableToHtml'
  | 'convertHtmlTableToMarkdown'
  | 'hr'
  | 'footnote'
  | 'linkReference'
  | 'toc'
  | 'yaml'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'inlineCode'
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'increaseHeading'
  | 'decreaseHeading'
  | 'clearFormat'
  | 'moveParagraphUp'
  | 'moveParagraphDown'
  | 'duplicateParagraph'
  | 'deleteParagraph'
  | 'moveSectionUp'
  | 'moveSectionDown'
  | 'duplicateSection'
  | 'foldCurrentHeading'
  | 'selectionQuote'
  | 'selectionCallout'
  | 'selectionCalloutNote'
  | 'selectionCalloutWarning'
  | 'selectionCalloutTip'
  | 'selectionCalloutImportant'
  | 'selectionUnorderedList'
  | 'selectionOrderedList'
  | 'selectionTaskList'
  | 'sourceMode'
  | 'splitMode'
  | 'previewMode'
  | 'toggleSidebar'
  | 'showFiles'
  | 'showDocs'
  | 'showOutline'
  | 'focusMode'
  | 'typewriterMode'
  | 'wordWrap'
  | 'statusBar'
  | 'actualSize'
  | 'zoomIn'
  | 'zoomOut'
  | 'devTools'
  | 'themeMiaoyan'
  | 'themeInkstone'
  | 'themeSlate'
  | 'themeMono'
  | 'themeNocturne'
  | 'minimize'
  | 'fullscreen'
  | 'alwaysOnTop'
  | 'preferences'
  | 'mdReference'
  | 'showShortcuts'
  | 'checkUpdate'
  | 'github'
  | 'feedback'
  | 'about';

export type AppPlatform = 'mac' | 'windows';

export interface ShortcutBinding {
  code: string;
  platforms?: AppPlatform[];
  mod?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  label?: string | Partial<Record<AppPlatform, string>>;
}

export interface CommandContext {
  documentStore: ReturnType<typeof useDocumentStore.getState>;
  settingsStore: ReturnType<typeof useSettingsStore.getState>;
  workspaceStore: ReturnType<typeof useWorkspaceStore.getState>;
  showToast?: (toast: ToastInput) => void;
  requestExportPath?: (input: {
    format: ExportFormat;
    filename: string;
    documentPath?: string;
    suggestedPath?: string;
  }) => Promise<string | { path: string; qualityScale?: number } | null>;
  requestSavePath?: (input: {
    filename: string;
    documentPath?: string;
  }) => Promise<string | null>;
  openAbout?: () => void;
  openSettings?: (section?: 'general' | 'writing' | 'appearance' | 'export' | 'citation' | 'files') => void;
  openShortcuts?: () => void;
  openQuickOpen?: () => void;
  openWorkspaceSearch?: () => void;
  openDocumentProperties?: () => void;
  openDocumentLinks?: () => void;
  openBacklinks?: () => void;
  openRelationGraph?: () => void;
}

export interface CommandDefinition {
  id: CommandId;
  category: CommandCategory;
  keywords?: string[];
  shortcuts?: ShortcutBinding[];
  palette?: boolean;
  enabled?: (context: CommandContext) => boolean;
  checked?: (context: CommandContext) => boolean;
  run: (context: CommandContext) => void | Promise<void>;
}
