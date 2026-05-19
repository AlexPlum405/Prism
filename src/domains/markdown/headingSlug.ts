export function getMarkdownHeadingSlug(text: string): string {
  return text
    .replace(/[`*_~[\]()]/g, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+$/g, '');
}
