import { emit, emitTo, listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import 'katex/dist/katex.min.css';
import './styles/global.css';
import { exportDocumentLocal } from './domains/export/localExport';
import { applyThemeRuntime, initializeThemeRegistry } from './domains/themes';
import {
  EXPORT_WORKER_PROGRESS_EVENT,
  EXPORT_WORKER_READY_EVENT,
  EXPORT_WORKER_RESULT_EVENT,
  EXPORT_WORKER_RUN_EVENT,
  EXPORT_WORKER_WARNING_EVENT,
  type ExportWorkerRunPayload,
} from './domains/export/workerProtocol';

type WorkerWindow = Window & { __PRISM_EXPORT_WORKER__?: boolean };

function getErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message || '导出失败',
      stack: error.stack,
    };
  }
  return {
    message: typeof error === 'string' ? error : '导出失败',
  };
}

async function main() {
  (window as WorkerWindow).__PRISM_EXPORT_WORKER__ = true;

  const current = getCurrentWebviewWindow();
  await listen<ExportWorkerRunPayload>(EXPORT_WORKER_RUN_EVENT, async (event) => {
    const { taskId, replyTarget, input, format, outputPath } = event.payload;
    try {
      await initializeThemeRegistry();
      await applyThemeRuntime(input.contentTheme);
      const exported = await exportDocumentLocal({
        ...input,
        onProgress: (message) => {
          void emitTo(replyTarget, EXPORT_WORKER_PROGRESS_EVENT, { taskId, message });
        },
        onWarning: (message) => {
          void emitTo(replyTarget, EXPORT_WORKER_WARNING_EVENT, { taskId, message });
        },
      }, format, outputPath);

      await emitTo(replyTarget, EXPORT_WORKER_RESULT_EVENT, {
        taskId,
        ok: true,
        exported,
      });
    } catch (error) {
      await emitTo(replyTarget, EXPORT_WORKER_RESULT_EVENT, {
        taskId,
        ok: false,
        ...getErrorPayload(error),
      });
    } finally {
      window.setTimeout(() => {
        void current.close();
      }, 60);
    }
  });

  await emit(EXPORT_WORKER_READY_EVENT, { label: current.label });
}

void main();
