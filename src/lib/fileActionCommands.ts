import { t } from '../domains/i18n';

export type FileActionInput =
  | string
  | {
      action: string;
      path?: string;
      name?: string;
    };

export interface ParsedFileAction {
  command: string;
  path?: string;
  name?: string;
}

export const SUPPORTED_FILE_ACTION_COMMANDS = [
  'openFile',
  'openNewWindow',
  'newFile',
  'newFolder',
  'rename',
  'commitRename',
  'duplicate',
  'delete',
  'openRootLocation',
  'openLocation',
  'copyRootPath',
  'copyPath',
  'properties',
  'refreshFolder',
  'viewList',
  'viewTree',
  'sortByName',
  'sortByModified',
  'sortByCreated',
  'sortBySize',
  'searchInFolder',
] as const;

export type FileActionCommand = typeof SUPPORTED_FILE_ACTION_COMMANDS[number];

const supportedFileActionCommandSet = new Set<string>(SUPPORTED_FILE_ACTION_COMMANDS);

export function parseFileAction(input: FileActionInput): ParsedFileAction {
  if (typeof input !== 'string') {
    const separatorIndex = input.action.indexOf(':');
    if (separatorIndex === -1) {
      return {
        command: input.action,
        path: input.path,
        name: input.name,
      };
    }

    return {
      command: input.action.slice(0, separatorIndex),
      path: input.path ?? input.action.slice(separatorIndex + 1),
      name: input.name,
    };
  }

  const separatorIndex = input.indexOf(':');
  if (separatorIndex === -1) {
    return { command: input };
  }

  return {
    command: input.slice(0, separatorIndex),
    path: input.slice(separatorIndex + 1),
  };
}

export function isSupportedFileActionCommand(input: FileActionInput): boolean {
  return supportedFileActionCommandSet.has(parseFileAction(input).command);
}

export function getUnsupportedFileActionMessage(command: string): string {
  return t('file.unsupportedAction', { command });
}
