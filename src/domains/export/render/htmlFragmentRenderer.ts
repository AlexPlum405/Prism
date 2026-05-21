export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isUnsafeExportUrl(value: unknown, allowedProtocols: Set<string>) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('#')
    || trimmed.startsWith('//')
    || trimmed.startsWith('/')
    || trimmed.startsWith('./')
    || trimmed.startsWith('../')
    || trimmed.startsWith('?')
  ) {
    return false;
  }

  const protocolCandidate = trimmed.replace(/[\u0000-\u001F\u007F]+/g, '');
  const protocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.exec(protocolCandidate)?.[0].toLowerCase();
  return Boolean(protocol && !allowedProtocols.has(protocol));
}

export function sanitizeExportHtmlFragment(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script, iframe, object, embed, base, link, meta').forEach((node) => {
    node.remove();
  });

  const linkProtocols = new Set(['http:', 'https:', 'mailto:']);
  const mediaProtocols = new Set(['http:', 'https:']);

  template.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        return;
      }
      if (name === 'style') {
        const value = attribute.value;
        if (/expression\s*\(|javascript:|url\s*\(\s*['"]?javascript:/i.test(value)) {
          element.removeAttribute(attribute.name);
        }
        return;
      }

      if ((name === 'href' || name.endsWith(':href')) && isUnsafeExportUrl(attribute.value, linkProtocols)) {
        element.removeAttribute(attribute.name);
        return;
      }

      if (name === 'src' && isUnsafeExportUrl(attribute.value, mediaProtocols)) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return template.innerHTML;
}
