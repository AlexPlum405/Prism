import {
  getSaveDialogOverwriteText,
  getSaveDialogPrimaryLabel,
  getSaveDialogTitle,
  type SaveDialogState,
} from '../useSaveExportDialogModel';
import { Toast } from '../../components/shell/Toast';
import { getExportFormatLabel } from '../../domains/export';
import {
  getLocalizedExportQualityPreset,
  getLocalizedExportQualityPresets,
  normalizeExportQualityScale,
} from '../../domains/export/quality';
import { t } from '../../domains/i18n';
import type { ExportFailureState } from '../../hooks/useExportTaskUi';
import type { ToastState } from '../../lib/toast';

interface ExportUiControllerProps {
  actionableIssueCount: number;
  chooseSaveDirectory: () => void | Promise<void>;
  closeSaveDialog: (result?: string | { path: string; qualityScale?: number } | null) => void;
  confirmSaveDialog: (allowOverwrite?: boolean) => void | Promise<void>;
  copyExportFailureDiagnostic: () => void | Promise<void>;
  dismissExportFailure: () => void;
  dismissToast: () => void;
  exportFailure: ExportFailureState | null;
  exportProgress: string | null;
  exportProgressInBackground: boolean;
  exportPngScale: number;
  saveDialog: SaveDialogState | null;
  saveDialogOverwriteFilename: string | null;
  sendExportProgressToBackground: () => void;
  toast: ToastState | null;
  updateSaveDialogFilename: (filename: string) => void;
  updateSaveDialogQualityScale: (qualityScale: number) => void;
}

export function ExportUiController({
  actionableIssueCount,
  chooseSaveDirectory,
  closeSaveDialog,
  confirmSaveDialog,
  copyExportFailureDiagnostic,
  dismissExportFailure,
  dismissToast,
  exportFailure,
  exportProgress,
  exportProgressInBackground,
  exportPngScale,
  saveDialog,
  saveDialogOverwriteFilename,
  sendExportProgressToBackground,
  toast,
  updateSaveDialogFilename,
  updateSaveDialogQualityScale,
}: ExportUiControllerProps) {
  return (
    <>
      {saveDialog && (
        <>
          <div className="modal-overlay" onClick={() => closeSaveDialog(null)} />
          <div className="modal prism-export-save-modal" role="dialog" aria-label={getSaveDialogTitle(saveDialog)}>
            <div className="modal-header">
              <div className="modal-title">{getSaveDialogTitle(saveDialog)}</div>
              <button className="modal-close" onClick={() => closeSaveDialog(null)} aria-label={t('common.close')}>&times;</button>
            </div>
            <div className="modal-body prism-export-save-body">
              <label className="prism-export-save-field">
                <span>{t('app.filename')}</span>
                <input
                  autoFocus
                  value={saveDialog.filename}
                  onChange={(event) => updateSaveDialogFilename(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      confirmSaveDialog(false);
                    }
                  }}
                />
              </label>

              <div className="prism-export-save-field">
                <span>{t('app.location')}</span>
                <div className="prism-export-save-location">
                  <div title={saveDialog.directory}>{saveDialog.directory}</div>
                  <button type="button" onClick={chooseSaveDirectory}>{t('common.change')}</button>
                </div>
              </div>

              {saveDialog.kind === 'export' && (
                <>
                  <label className="prism-export-save-field">
                    <span>{t('app.exportQuality')}</span>
                    <select
                      value={normalizeExportQualityScale(saveDialog.qualityScale, exportPngScale)}
                      onChange={(event) => updateSaveDialogQualityScale(Number(event.target.value))}
                    >
                      {getLocalizedExportQualityPresets().map((preset) => (
                        <option key={preset.scale} value={preset.scale}>
                          {preset.shortLabel}
                        </option>
                      ))}
                    </select>
                    <small>
                      {getLocalizedExportQualityPreset(
                        normalizeExportQualityScale(saveDialog.qualityScale, exportPngScale),
                      ).description}
                    </small>
                  </label>
                  <div className="prism-export-quality-note">
                    {t('app.exportQualityNote')}
                  </div>
                  <div className="prism-export-preflight" aria-label={t('app.exportPreflight')}>
                    <div className="prism-export-preflight-row">
                      <span>{t('app.target')}</span>
                      <b>{saveDialog.format ? getExportFormatLabel(saveDialog.format) : t('common.export')} · {saveDialog.filename}</b>
                    </div>
                    <div className="prism-export-preflight-row">
                      <span>{t('app.quality')}</span>
                      <b>
                        {getLocalizedExportQualityPreset(
                          normalizeExportQualityScale(saveDialog.qualityScale, exportPngScale),
                        ).shortLabel}
                      </b>
                    </div>
                    <div className="prism-export-preflight-row">
                      <span>{t('app.risk')}</span>
                      <b>{actionableIssueCount > 0 ? t('app.errorRisk', { count: actionableIssueCount }) : t('app.noBlockingDocumentErrors')}</b>
                    </div>
                  </div>
                </>
              )}

              {saveDialog.error && (
                <div className="prism-export-save-error">{saveDialog.error}</div>
              )}

              {saveDialog.pendingOverwritePath && (
                <div className="prism-export-overwrite">
                  <div className="prism-export-overwrite-title">
                    {t('app.fileAlreadyExists', { filename: saveDialogOverwriteFilename ?? saveDialog.filename })}
                  </div>
                  <div className="prism-export-overwrite-text">
                    {getSaveDialogOverwriteText(saveDialog)}
                  </div>
                </div>
              )}
            </div>
            <div className="prism-export-save-footer">
              <button type="button" onClick={() => closeSaveDialog(null)}>{t('common.cancel')}</button>
              {saveDialog.pendingOverwritePath ? (
                <button type="button" className="danger" onClick={() => confirmSaveDialog(true)}>
                  {t('app.replaceAndAction', { action: getSaveDialogPrimaryLabel(saveDialog) })}
                </button>
              ) : (
                <button type="button" className="primary" onClick={() => confirmSaveDialog(false)}>
                  {getSaveDialogPrimaryLabel(saveDialog)}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {(toast || (exportProgress && !exportProgressInBackground)) && (
        <div className="prism-toast-region">
          {toast && <Toast toast={toast} onDismiss={dismissToast} />}

          {exportProgress && !exportProgressInBackground && (
            <div role="status" aria-live="polite" className="prism-toast prism-toast--loading prism-export-progress">
              <span className="prism-toast-icon prism-export-spinner" aria-hidden="true" />
              <span className="prism-toast-copy">
                <span className="prism-toast-title">{t('app.exportingForeground')}</span>
                <span className="prism-toast-message">{exportProgress}</span>
                <span className="prism-toast-message prism-toast-message--secondary">{t('app.exportBackgroundHint')}</span>
              </span>
              <span className="prism-toast-actions">
                <button
                  type="button"
                  className="prism-toast-action"
                  onClick={sendExportProgressToBackground}
                >
                  {t('app.background')}
                </button>
              </span>
              <span className="prism-toast-progressbar" aria-hidden="true"><span /></span>
            </div>
          )}
        </div>
      )}

      {exportFailure && (
        <>
          <div className="modal-overlay" onClick={dismissExportFailure} />
          <div className="modal prism-export-failure-modal" role="dialog" aria-label={exportFailure.title}>
            <div className="modal-header">
              <div className="modal-title">{exportFailure.title}</div>
              <button className="modal-close" onClick={dismissExportFailure} aria-label={t('common.close')}>&times;</button>
            </div>
            <div className="modal-body prism-export-failure-body">
              <div className="prism-export-failure-summary">
                {t('app.exportFailureSummary')}
              </div>
              <div className="prism-export-failure-actions">
                <span>{t('app.recoveryAdvice')}</span>
                <b>{t('app.recoveryAdviceText')}</b>
              </div>
              <textarea readOnly value={exportFailure.diagnostic} />
            </div>
            <div className="prism-export-save-footer">
              <button type="button" onClick={dismissExportFailure}>{t('common.close')}</button>
              <button type="button" className="primary" onClick={copyExportFailureDiagnostic}>
                {t('app.copyDiagnostic')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
