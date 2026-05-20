export type ThemeErrorCode =
  | 'invalid_theme'
  | 'theme_exists'
  | 'built_in_theme_id'
  | 'missing_theme'
  | 'unsafe_css'
  | 'io_error';

export class ThemeError extends Error {
  code: ThemeErrorCode;
  themeId?: string;

  constructor(code: ThemeErrorCode, message: string, themeId?: string) {
    super(message);
    this.name = 'ThemeError';
    this.code = code;
    this.themeId = themeId;
  }
}

export function getThemeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return '主题操作失败';
}
