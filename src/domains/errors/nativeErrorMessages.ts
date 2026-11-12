import type { I18nKey } from '../i18n/resources';
import { PrismNativeError } from '../../platform/tauri/result';

/**
 * Rust 侧错误码到用户文案的映射。
 *
 * Rust 命令返回 `PrismCommandError { code, message, hint }`，但 message 是英文
 * 技术描述、写死在 Rust 里，中文用户看到的是 "File does not exist"。`code` 才是
 * 稳定契约——文案放在前端，语言切换时才跟得上。
 *
 * 只收录「信息完整、可以直接展示」的码。带 `{error}` 占位符的（permission_denied、
 * write_failed 等）消息里含具体原因，翻译成固定文案反而丢信息，继续用 message。
 */
export const NATIVE_ERROR_MESSAGE_KEYS: Record<string, I18nKey> = {
  external_modified: 'errors.externalModified',
  external_deleted: 'errors.externalDeleted',
  file_not_found: 'errors.fileNotFound',
  not_a_file: 'errors.notAFile',
  not_a_directory: 'errors.notADirectory',
  invalid_path: 'errors.invalidPath',
  unsupported_file_type: 'errors.unsupportedFileType',
  invalid_workspace: 'errors.invalidWorkspace',
  invalid_theme_id: 'errors.invalidThemeId',
  export_failed: 'errors.exportFailed',
  export_job_not_found: 'errors.exportJobNotFound',
  workspace_index_cancelled: 'errors.workspaceIndexCancelled',
  workspace_index_job_not_ready: 'errors.workspaceIndexNotReady',
};

/**
 * 取错误对应的文案 key；没有映射时返回 null，调用方回退到 message。
 */
export function getNativeErrorI18nKey(error: unknown): I18nKey | null {
  if (!(error instanceof PrismNativeError)) return null;
  return NATIVE_ERROR_MESSAGE_KEYS[error.code] ?? null;
}
