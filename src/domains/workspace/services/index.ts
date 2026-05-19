export {
  MARKDOWN_FILE_FILTERS,
  SUPPORTED_MARKDOWN_EXTENSIONS,
  isSupportedMarkdownPath,
} from './fileAssociation';
export {
  collectDirectoryPaths,
  flattenFiles,
  isDirectoryNode,
  searchWorkspaceNodes,
  sortFileNodes,
  type FlatFileNode,
} from './fileTree';
export {
  getFileManagerName,
  getRuntimePlatform,
  getShowInFileManagerLabel,
  type RuntimePlatform,
} from './platform';
export {
  basename,
  dirname,
  isPathInside,
  isSamePath,
  joinPath,
  normalizePathForCompare,
  replacePathPrefix,
} from './path';
export {
  addRecentFile,
  clearRecentFiles,
  getRecentFiles,
  type RecentFile,
} from './recentFiles';
export {
  rankQuickOpenFiles,
  type QuickOpenRecentFile,
  type QuickOpenResult,
} from './quickOpen';
export {
  computeWritingStats,
  type WritingStats,
} from './writingStats';
export {
  scanBacklinks,
  type BacklinkReference,
  type BacklinkSourceDocument,
} from './backlinks';
export {
  extractDocumentLinks,
  resolveDocumentLinkTarget,
  type DocumentLinkReference,
  type DocumentLinkFile,
  type DocumentLinkKind,
  type ResolvedDocumentLink,
} from './documentLinks';
export {
  buildWorkspaceIndex,
  getWorkspaceIndexBacklinks,
  getWorkspaceIndexLinkFiles,
  rankWorkspaceIndexDocuments,
  searchWorkspaceIndex,
  type WorkspaceIndex,
  type WorkspaceIndexBacklink,
  type WorkspaceIndexBuildInput,
  type WorkspaceIndexedDocument,
  type WorkspaceIndexFrontMatter,
  type WorkspaceIndexHeading,
  type WorkspaceIndexLink,
  type WorkspaceIndexRecentFile,
  type WorkspaceIndexSearchResult,
  type WorkspaceIndexSourceDocument,
} from './workspaceIndex';
