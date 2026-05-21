import { useMemo } from 'react';
import { t as translate } from '../../../domains/i18n';

interface CitationSettingsModelInput {
  bibliographyPath: string;
  cslStylePath: string;
  pandocDetected: boolean;
}

export function hasSupportedPathExtension(path: string, extensions: string[]) {
  const normalized = path.trim().toLowerCase();
  return normalized.length === 0 || extensions.some((extension) => normalized.endsWith(extension));
}

export function getCitationSettingsModel(input: CitationSettingsModelInput) {
  const bibliographyPathIsSupported = hasSupportedPathExtension(
    input.bibliographyPath,
    ['.bib', '.bibtex', '.json'],
  );
  const cslStylePathIsSupported = hasSupportedPathExtension(input.cslStylePath, ['.csl']);
  const hasBibliography = input.bibliographyPath.trim().length > 0;
  const hasCslStyle = input.cslStylePath.trim().length > 0;

  let citationReadinessHint = translate('settings.citation.ready');
  if (!bibliographyPathIsSupported || !cslStylePathIsSupported) {
    citationReadinessHint = translate('settings.citation.invalid');
  } else if (!hasBibliography && hasCslStyle) {
    citationReadinessHint = translate('settings.citation.cslNeedsBibliography');
  } else if (!hasBibliography) {
    citationReadinessHint = translate('settings.citation.noBibliography');
  } else if (!input.pandocDetected) {
    citationReadinessHint = translate('settings.citation.noPandoc');
  }

  return {
    bibliographyHint: !input.bibliographyPath.trim()
      ? translate('settings.bibliography.emptyHint')
      : bibliographyPathIsSupported
        ? translate('settings.bibliography.readyHint')
        : translate('settings.bibliography.invalidHint'),
    bibliographyPathIsSupported,
    citationReadinessHint,
    cslStyleHint: !input.cslStylePath.trim()
      ? translate('settings.csl.emptyHint')
      : cslStylePathIsSupported
        ? translate('settings.csl.readyHint')
        : translate('settings.csl.invalidHint'),
    cslStylePathIsSupported,
  };
}

export function useCitationSettingsModel(input: CitationSettingsModelInput) {
  return useMemo(() => getCitationSettingsModel(input), [
    input.bibliographyPath,
    input.cslStylePath,
    input.pandocDetected,
  ]);
}
