import { useEffect, useMemo, useState } from 'react';
import type { OpenDocument } from '../domains/document/types';
import { computeWritingStats } from '../domains/workspace/services';

interface UseAppWritingStatsModelInput {
  currentDocument: OpenDocument | null;
}

export function useAppWritingStatsModel({
  currentDocument,
}: UseAppWritingStatsModelInput) {
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [selectionText, setSelectionText] = useState('');

  useEffect(() => {
    setSelectionText('');
  }, [currentDocument?.path]);

  const writingStats = useMemo(
    () => computeWritingStats(currentDocument?.content ?? ''),
    [currentDocument?.content],
  );
  const selectionWritingStats = useMemo(
    () => selectionText.trim() ? computeWritingStats(selectionText) : null,
    [selectionText],
  );

  return {
    cursor,
    selectionWritingStats,
    setCursor,
    setSelectionText,
    writingStats,
  };
}
