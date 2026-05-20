import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { BackgroundThrottlingPolicy } from '@tauri-apps/api/window';
import { t } from '../i18n';
import type { ExportDocumentInput, ExportFormat } from './types';
import {
  EXPORT_WORKER_PROGRESS_EVENT,
  EXPORT_WORKER_READY_EVENT,
  EXPORT_WORKER_RESULT_EVENT,
  EXPORT_WORKER_RUN_EVENT,
  EXPORT_WORKER_WARNING_EVENT,
  type ExportWorkerProgressPayload,
  type ExportWorkerReadyPayload,
  type ExportWorkerResultPayload,
  type ExportWorkerWarningPayload,
  type SerializableExportDocumentInput,
} from './workerProtocol';

let exportWorkerCounter = 0;
const EXPORT_WORKER_READY_TIMEOUT_MS = 10_000;
const EXPORT_WORKER_TASK_TIMEOUT_MS = 20 * 60_000;
const EXPORT_WORKER_STALL_TIMEOUT_MS = 90_000;
const EXPORT_WORKER_PARKING_SIZE = 24;
const EXPORT_WORKER_PARKING_OFFSET = 12;
const DISABLED_BACKGROUND_THROTTLING = 'disabled' as BackgroundThrottlingPolicy;

function toSerializableInput(input: ExportDocumentInput): SerializableExportDocumentInput {
  const serializableInput: Partial<ExportDocumentInput> = { ...input };
  delete serializableInput.onProgress;
  delete serializableInput.onWarning;
  return serializableInput as SerializableExportDocumentInput;
}

function createWorkerLabel() {
  exportWorkerCounter += 1;
  return `prism-export-worker-${Date.now()}-${exportWorkerCounter}`;
}

function createExportError(payload: Extract<ExportWorkerResultPayload, { ok: false }>) {
  const error = new Error(payload.message);
  if (payload.stack) error.stack = payload.stack;
  return error;
}

async function getWorkerParkingPosition() {
  try {
    const position = await getCurrentWebviewWindow().outerPosition();
    return {
      x: position.x + EXPORT_WORKER_PARKING_OFFSET,
      y: position.y + EXPORT_WORKER_PARKING_OFFSET,
    };
  } catch {
    return {
      x: EXPORT_WORKER_PARKING_OFFSET,
      y: EXPORT_WORKER_PARKING_OFFSET,
    };
  }
}

export async function exportDocumentInIsolatedWebview(
  input: ExportDocumentInput,
  format: ExportFormat,
  outputPath?: string,
) {
  const label = createWorkerLabel();
  const taskId = `${label}-task`;
  const currentWindow = getCurrentWebviewWindow();
  const replyTarget = currentWindow.label;
  const unlisteners: UnlistenFn[] = [];
  let worker: WebviewWindow | null = null;
  let readyTimeout: number | null = null;
  let taskTimeout: number | null = null;
  let stallTimeout: number | null = null;
  let rejectReady: (error: Error) => void = () => undefined;
  let rejectResult: (error: Error) => void = () => undefined;
  let lastProgress = t('export.worker.prepare');

  const cleanup = async () => {
    if (readyTimeout !== null) {
      window.clearTimeout(readyTimeout);
      readyTimeout = null;
    }
    if (taskTimeout !== null) {
      window.clearTimeout(taskTimeout);
      taskTimeout = null;
    }
    if (stallTimeout !== null) {
      window.clearTimeout(stallTimeout);
      stallTimeout = null;
    }
    while (unlisteners.length > 0) {
      unlisteners.pop()?.();
    }
    if (worker) {
      await worker.close().catch(() => undefined);
      worker = null;
    }
  };

  try {
    let resolveReady: () => void = () => undefined;
    const readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
      readyTimeout = window.setTimeout(() => {
        reject(new Error(t('export.worker.startTimeout')));
      }, EXPORT_WORKER_READY_TIMEOUT_MS);
    });

    let resolveResult: (exported: boolean) => void = () => undefined;
    const resultPromise = new Promise<boolean>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
      taskTimeout = window.setTimeout(() => {
        reject(new Error(t('export.worker.executionTimeout')));
      }, EXPORT_WORKER_TASK_TIMEOUT_MS);
    });
    const resetStallTimeout = () => {
      if (stallTimeout !== null) {
        window.clearTimeout(stallTimeout);
      }
      stallTimeout = window.setTimeout(() => {
        rejectResult(new Error(
          t('export.worker.stallTimeout', {
            seconds: Math.round(EXPORT_WORKER_STALL_TIMEOUT_MS / 1000),
            stage: lastProgress,
          }),
        ));
      }, EXPORT_WORKER_STALL_TIMEOUT_MS);
    };

    unlisteners.push(...await Promise.all([
      listen<ExportWorkerReadyPayload>(EXPORT_WORKER_READY_EVENT, (event) => {
        if (event.payload.label !== label) return;
        resolveReady();
      }),
      listen<ExportWorkerProgressPayload>(EXPORT_WORKER_PROGRESS_EVENT, (event) => {
        if (event.payload.taskId !== taskId) return;
        lastProgress = event.payload.message || lastProgress;
        input.onProgress?.(lastProgress);
        resetStallTimeout();
      }),
      listen<ExportWorkerWarningPayload>(EXPORT_WORKER_WARNING_EVENT, (event) => {
        if (event.payload.taskId !== taskId) return;
        input.onWarning?.(event.payload.message);
      }),
      listen<ExportWorkerResultPayload>(EXPORT_WORKER_RESULT_EVENT, (event) => {
        if (event.payload.taskId !== taskId) return;
        if (event.payload.ok) {
          resolveResult(event.payload.exported);
          return;
        }
        rejectResult(createExportError(event.payload));
      }),
    ]));

    const parkingPosition = await getWorkerParkingPosition();
    worker = new WebviewWindow(label, {
      url: '/export-worker.html',
      title: 'Prism Export Worker',
      width: EXPORT_WORKER_PARKING_SIZE,
      height: EXPORT_WORKER_PARKING_SIZE,
      x: parkingPosition.x,
      y: parkingPosition.y,
      visible: true,
      focus: false,
      focusable: false,
      decorations: false,
      resizable: false,
      preventOverflow: true,
      skipTaskbar: true,
      alwaysOnBottom: true,
      shadow: false,
      backgroundThrottling: DISABLED_BACKGROUND_THROTTLING,
    });
    void worker.once('tauri://error', (event) => {
      rejectReady(new Error(t('export.worker.createFailed', { message: String(event.payload) })));
    });

    await readyPromise;
    resetStallTimeout();
    await emitTo(label, EXPORT_WORKER_RUN_EVENT, {
      taskId,
      replyTarget,
      input: toSerializableInput(input),
      format,
      outputPath,
    });

    return await resultPromise;
  } finally {
    await cleanup();
  }
}
