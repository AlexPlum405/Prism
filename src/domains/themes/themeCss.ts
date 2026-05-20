import { ThemeError } from './themeErrors';

const CSS_URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
const THEME_STYLE_ATTRIBUTE = 'data-prism-theme-style';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCssComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function getThemeScopePattern(themeId: string) {
  const escaped = escapeRegExp(themeId);
  return new RegExp(
    `html\\s*\\[\\s*data-content-theme\\s*=\\s*(?:['"]${escaped}['"])\\s*\\]`,
    'i',
  );
}

function isRemoteOrUnsafeUrl(rawUrl: string) {
  const url = rawUrl.trim().replace(/^['"]|['"]$/g, '');
  return /^(?:https?:)?\/\//i.test(url)
    || /^(?:javascript|vbscript|file):/i.test(url)
    || /[\u0000-\u001f\u007f]/.test(url);
}

function isRelativeAssetUrl(rawUrl: string) {
  const url = rawUrl.trim().replace(/^['"]|['"]$/g, '');
  if (!url || url.startsWith('#') || url.startsWith('data:') || url.startsWith('blob:')) return false;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(url)) return false;
  return !url.startsWith('/') && !url.startsWith('\\') && !url.includes('..');
}

function validateScopedSelectors(css: string, themeId: string) {
  const scopePattern = getThemeScopePattern(themeId);
  const errors: string[] = [];
  const rulePattern = /(^|})\s*([^@{}][^{]+)\{/g;
  let match: RegExpExecArray | null;

  while ((match = rulePattern.exec(css)) !== null) {
    const selectorList = match[2]
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean);

    for (const selector of selectorList) {
      if (!scopePattern.test(selector)) {
        errors.push(`选择器必须 scoped 到 html[data-content-theme='${themeId}']：${selector}`);
      }
    }
  }

  return errors;
}

function validateDangerousDeclarations(css: string) {
  const errors: string[] = [];
  const blockPattern = /([^{}]+)\{([^{}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(css)) !== null) {
    const selector = match[1].trim();
    const declarations = match[2];
    const affectsCoreSurface =
      /\.(?:app-sidebar|app-main|cm-editor|preview-compat|modal|settings-|statusbar|cmdk|custom-context-menu)/.test(selector)
      || /\bbody\b|\bhtml\b/.test(selector);

    if (!affectsCoreSurface) continue;

    if (/\bdisplay\s*:\s*none\b/i.test(declarations)) {
      errors.push(`不能隐藏核心界面：${selector}`);
    }
    if (/\bpointer-events\s*:\s*none\b/i.test(declarations)) {
      errors.push(`不能让核心界面不可点击：${selector}`);
    }
    if (/\bposition\s*:\s*fixed\b/i.test(declarations) && /\binset\s*:\s*0\b/i.test(declarations)) {
      errors.push(`不能创建覆盖整个窗口的 fixed 层：${selector}`);
    }
    const zIndex = /\bz-index\s*:\s*(-?\d+)/i.exec(declarations)?.[1];
    if (zIndex && Number(zIndex) > 999) {
      errors.push(`z-index 不能超过 999：${selector}`);
    }
  }

  return errors;
}

export function validateThemeCss(css: string, themeId: string) {
  const normalizedCss = stripCssComments(css);
  const errors: string[] = [];

  if (!normalizedCss.trim()) {
    errors.push('theme.css 不能为空');
  }
  if (/@import\b/i.test(normalizedCss)) {
    errors.push('theme.css 不允许使用 @import');
  }
  if (/@font-face\b/i.test(normalizedCss)) {
    errors.push('字体请通过 theme.json fonts 声明，theme.css 不允许 @font-face');
  }
  if (/(?:expression\s*\(|javascript:|vbscript:)/i.test(normalizedCss)) {
    errors.push('theme.css 包含危险脚本表达式');
  }

  for (const match of normalizedCss.matchAll(CSS_URL_PATTERN)) {
    const url = match[2];
    if (isRemoteOrUnsafeUrl(url)) {
      errors.push(`theme.css 不允许远程或危险资源：${url}`);
    }
    if (!isRelativeAssetUrl(url) && !url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('#')) {
      errors.push(`theme.css 只允许相对本地资源：${url}`);
    }
  }

  errors.push(...validateScopedSelectors(normalizedCss, themeId));
  errors.push(...validateDangerousDeclarations(normalizedCss));

  if (errors.length > 0) {
    throw new ThemeError('unsafe_css', errors[0], themeId);
  }
}

export function getThemeCssAssetUrls(css: string) {
  return Array.from(css.matchAll(CSS_URL_PATTERN))
    .map((match) => match[2].trim())
    .filter((url) => isRelativeAssetUrl(url));
}

export function replaceThemeCssAssetUrls(css: string, replacements: Map<string, string>) {
  return css.replace(CSS_URL_PATTERN, (full, quote: string, rawUrl: string) => {
    const replacement = replacements.get(rawUrl.trim());
    return replacement ? `url(${quote}${replacement}${quote})` : full;
  });
}

export function removeInjectedThemeStyles() {
  document.head.querySelectorAll<HTMLStyleElement>(`style[${THEME_STYLE_ATTRIBUTE}]`).forEach((element) => {
    element.remove();
  });
}

export function injectThemeCss(themeId: string, css: string) {
  removeInjectedThemeStyles();
  const style = document.createElement('style');
  style.setAttribute(THEME_STYLE_ATTRIBUTE, themeId);
  style.textContent = css;
  document.head.appendChild(style);
}

export const __themeCssTesting = {
  isRelativeAssetUrl,
  stripCssComments,
};
