export function nextExportFrame(timeoutMs = 250) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    if (typeof window.requestAnimationFrame !== 'function') {
      finish();
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
  });
}

export function withExportTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function stripRasterUnsafeColorDeclarations(css: string) {
  return css.replace(
    /([{\s;])[-\w]+\s*:\s*[^;{}]*\b(?:color-mix|color|lab|lch|oklab|oklch)\([^;{}]*\)[^;{}]*(?:;|(?=}))/gi,
    '$1',
  );
}

function normalizeRasterColorChannel(value: string, scale: number) {
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) {
    return Number.parseFloat(trimmed) / 100 * scale;
  }
  const numeric = Number.parseFloat(trimmed);
  return numeric <= 1 ? numeric * scale : numeric;
}

export function normalizeCssColorFunctionsForRaster(value: string) {
  if (!value) return value;
  return value.replace(
    /color\(\s*(?:srgb|display-p3)\s+([+-]?\d*\.?\d+%?)\s+([+-]?\d*\.?\d+%?)\s+([+-]?\d*\.?\d+%?)(?:\s*\/\s*([+-]?\d*\.?\d+%?))?\s*\)/gi,
    (_match, red: string, green: string, blue: string, alpha?: string) => {
      const r = Math.round(Math.max(0, Math.min(255, normalizeRasterColorChannel(red, 255))));
      const g = Math.round(Math.max(0, Math.min(255, normalizeRasterColorChannel(green, 255))));
      const b = Math.round(Math.max(0, Math.min(255, normalizeRasterColorChannel(blue, 255))));
      if (!alpha) return `rgb(${r}, ${g}, ${b})`;
      const a = Math.max(0, Math.min(1, normalizeRasterColorChannel(alpha, 1)));
      return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
    },
  );
}

const rasterColorProperties = [
  'background-color',
  'border-bottom-color',
  'border-left-color',
  'border-right-color',
  'border-top-color',
  'box-shadow',
  'caret-color',
  'color',
  'column-rule-color',
  'fill',
  'outline-color',
  'stroke',
  'text-decoration-color',
  'text-shadow',
] as const;

export function normalizeRasterComputedColors(root: HTMLElement) {
  const view = root.ownerDocument.defaultView;
  if (!view) return;
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement | SVGElement>('*'))];
  elements.forEach((element) => {
    let computed: CSSStyleDeclaration;
    try {
      computed = view.getComputedStyle(element);
    } catch {
      return;
    }
    rasterColorProperties.forEach((property) => {
      try {
        const value = computed.getPropertyValue(property);
        const normalized = normalizeCssColorFunctionsForRaster(value);
        if (normalized !== value) {
          element.style.setProperty(property, normalized, 'important');
        }
      } catch {
        // Some jsdom/SVG style properties are incomplete. Raster export can keep the original value.
      }
    });
  });
}
