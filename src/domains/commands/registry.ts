import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { checkForAppUpdate, downloadAndInstallUpdate } from '../update/updateService';
import type {
  CommandContext,
  CommandDefinition,
  CommandId,
} from './types';
import {
  getCurrentPlatform,
  getShortcutDisplayPlatform,
  getShortcutLabel,
  shortcutMatchesEvent,
  type ShortcutDisplayStyle,
} from './platform';
import { createDocumentInfoCommands } from './categories/documentInfoCommands';
import { createEditorCommands } from './categories/editorCommands';
import { createExportCommands } from './categories/exportCommands';
import { createFileCommands } from './categories/fileCommands';
import { createHelpCommands } from './categories/helpCommands';
import { createThemeCommands } from './categories/themeCommands';
import { createViewCommands } from './categories/viewCommands';
import { createWindowCommands } from './categories/windowCommands';
import { t } from '../i18n';
import { createWorkspaceCommands } from './categories/workspaceCommands';
import { emitAppEvent } from '../../platform/events/appEvents';
import { openExternalUrl } from '../../platform/tauri/opener';
import { askDialog } from '../../platform/tauri/dialogs';
import { invokeNativeCommand } from '../../platform/tauri/nativeCommands';
import { PRISM_MIGRATION_GUIDE_URL } from '../../lib/brand';

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err instanceof Event) return err.type || t('common.unknownEventError');
  return String(err);
}

function hasDocument(context: CommandContext): boolean {
  return Boolean(context.documentStore.currentDocument);
}

function emitEditorCommand(command: string, detail: Record<string, unknown> = {}): void {
  emitAppEvent('editor.command', { command, ...detail });
}

function emitInlineFormat(format: string): void {
  emitAppEvent('editor.format', { format });
}

function emitHeading(level: string): void {
  emitAppEvent('editor.heading', { level });
}

function emitBlockFormat(format: string): void {
  emitAppEvent('editor.blockFormat', { format });
}

async function handleFullscreen(context: CommandContext): Promise<void> {
  const win = getCurrentWindow();
  const isFull = await win.isFullscreen();
  await win.setFullscreen(!isFull);
  context.workspaceStore.setFullscreen(!isFull);
}

async function handleAlwaysOnTop(context: CommandContext): Promise<void> {
  const win = getCurrentWindow();
  const isOnTop = await win.isAlwaysOnTop?.();
  if (isOnTop !== undefined) {
    await win.setAlwaysOnTop(!isOnTop);
    context.workspaceStore.setAlwaysOnTop(!isOnTop);
  }
}

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
let currentZoom = 1;

async function handleZoom(direction: 'in' | 'out' | 'reset', context: CommandContext): Promise<void> {
  const next =
    direction === 'reset'
      ? 1
      : direction === 'in'
        ? Math.min(currentZoom + ZOOM_STEP, ZOOM_MAX)
        : Math.max(currentZoom - ZOOM_STEP, ZOOM_MIN);

  currentZoom = Math.round(next * 100) / 100;

  try {
    await getCurrentWebview().setZoom(currentZoom);
    document.documentElement.style.setProperty('--app-zoom', '1');
  } catch (error) {
    document.documentElement.style.setProperty('--app-zoom', String(currentZoom));
    console.warn('[Command] Webview zoom unavailable, falling back to CSS zoom', error);
  }

  context.showToast?.(t('command.zoomPercent', { percent: Math.round(currentZoom * 100) }));
}

async function handleDevTools(context: CommandContext): Promise<void> {
  try {
    await invokeNativeCommand('plugin:webview|internal_toggle_devtools');
  } catch (error) {
    console.error('[Command] DevTools toggle failed', error);
    context.showToast?.(t('command.devToolsUnavailable'));
  }
}

async function handleHelpLink(command: CommandId): Promise<void> {
  const urls: Partial<Record<CommandId, string>> = {
    mdReference: 'https://www.markdownguide.org/basic-syntax/',
    migrationGuide: PRISM_MIGRATION_GUIDE_URL,
    github: 'https://github.com/AlexPlum405/Prism',
    feedback: 'https://github.com/AlexPlum405/Prism/issues',
  };

  const url = urls[command];
  if (url) await openExternalUrl(url);
}

async function handleCheckUpdate(context: CommandContext): Promise<void> {
  context.showToast?.(t('command.updateChecking'));

  try {
    const result = await checkForAppUpdate();
    if (result.status === 'none') {
      context.showToast?.(t('command.updateLatest'));
      return;
    }
    if (result.status === 'unavailable') {
      context.showToast?.(t('command.updateUnavailable', { reason: result.reason }));
      return;
    }

    const updateMessage = t('command.updateAvailable', {
      currentVersion: result.currentVersion,
      version: result.version,
    });

    if (context.showToast) {
      context.showToast({
        actions: [
          {
            label: t('command.installUpdate'),
            onClick: async () => {
              context.showToast?.(t('command.downloadingUpdate'));
              try {
                await downloadAndInstallUpdate(result.update, (progress) => {
                  if (progress.contentLength) {
                    const percent = Math.round((progress.chunkLength / progress.contentLength) * 100);
                    context.showToast?.(t('command.downloadingProgress', { percent }));
                  }
                });
              } catch (error) {
                context.showToast?.(t('command.updateFailed', { message: formatError(error) }));
              }
            },
          },
          {
            label: t('command.viewOnGitHub'),
            onClick: () => openExternalUrl('https://github.com/AlexPlum405/Prism/releases/latest'),
          },
        ],
        message: updateMessage,
        title: t('command.checkUpdate'),
      });
      return;
    }

    const shouldInstall = await askDialog(
      updateMessage + '\n\n' + t('command.installUpdatePrompt'),
      { title: t('command.checkUpdate'), kind: 'info' },
    );
    if (shouldInstall) {
      await downloadAndInstallUpdate(result.update);
    }
  } catch (error) {
    context.showToast?.(t('command.updateFailed', { message: formatError(error) }));
  }
}

export const commandRegistry = [
  ...createFileCommands(),
  ...createWorkspaceCommands(),
  ...createDocumentInfoCommands(),
  ...createExportCommands({ hasDocument }),

  ...createEditorCommands({
    hasDocument,
    emitEditorCommand,
    emitInlineFormat,
    emitBlockFormat,
    emitHeading,
  }),

  ...createViewCommands({
    hasDocument,
    handleZoom,
    handleDevTools,
  }),
  ...createThemeCommands(),
  ...createWindowCommands({
    handleFullscreen,
    handleAlwaysOnTop,
    minimize: () => getCurrentWindow().minimize(),
  }),
  ...createHelpCommands({
    handleHelpLink,
    handleCheckUpdate,
  }),
] satisfies CommandDefinition[];

export const commandRegistryById = new Map<CommandId, CommandDefinition>(
  commandRegistry.map((definition) => [definition.id, definition]),
);

export function getCommandDefinition(id: CommandId): CommandDefinition {
  const definition = commandRegistryById.get(id);
  if (!definition) throw new Error(t('app.unknownCommand', { action: id }));
  return definition;
}

export function isCommandId(value: string): value is CommandId {
  return commandRegistryById.has(value as CommandId);
}

export function isCommandEnabled(id: CommandId, context: CommandContext): boolean {
  const definition = getCommandDefinition(id);
  return definition.enabled ? definition.enabled(context) : true;
}

export async function runCommand(id: CommandId, context: CommandContext): Promise<void> {
  const definition = getCommandDefinition(id);
  if (!isCommandEnabled(id, context)) return;

  try {
    await definition.run(context);
  } catch (err) {
    console.error(`[Command] ${id} failed:`, err);
    context.showToast?.(t('command.operationFailed', { message: formatError(err) }));
  }
}

export function findCommandByKeyboardEvent(event: KeyboardEvent): CommandDefinition | null {
  const platform = getCurrentPlatform();

  for (const definition of commandRegistry) {
    if (!definition.shortcuts?.length) continue;
    if (definition.shortcuts.some((shortcut) => shortcutMatchesEvent(shortcut, event, platform))) {
      return definition;
    }
  }

  return null;
}

export function getPrimaryShortcutLabel(
  id: CommandId,
  displayStyle: ShortcutDisplayStyle = 'auto',
): string | undefined {
  const shortcut = getCommandDefinition(id).shortcuts?.[0];
  return getShortcutLabel(shortcut, getShortcutDisplayPlatform(displayStyle));
}
