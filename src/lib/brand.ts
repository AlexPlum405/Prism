import type { I18nKey } from '../domains/i18n';

export const PRISM_MIGRATION_GUIDE_URL =
  'https://github.com/AlexPlum405/Prism/blob/codex/prism-full-optimization/docs/help/prism-migration-guide.md';

export const PRISM_BRAND_PILLARS = [
  {
    id: 'local',
    titleKey: 'brand.pillar.local.title',
    bodyKey: 'brand.pillar.local.body',
  },
  {
    id: 'preview',
    titleKey: 'brand.pillar.preview.title',
    bodyKey: 'brand.pillar.preview.body',
  },
  {
    id: 'export',
    titleKey: 'brand.pillar.export.title',
    bodyKey: 'brand.pillar.export.body',
  },
] satisfies Array<{
  id: 'local' | 'preview' | 'export';
  titleKey: I18nKey;
  bodyKey: I18nKey;
}>;
