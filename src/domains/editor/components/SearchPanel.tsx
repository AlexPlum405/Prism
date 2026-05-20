import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';

export type SearchMode = 'find' | 'replace';
export type SearchAction = 'input' | 'next' | 'prev' | 'all' | 'replace' | 'replaceAll';

export interface SearchPanelProps {
  visible: boolean;
  viewMode: 'edit' | 'split' | 'preview';
  content: string;
  onClose: () => void;
  onSearch: (action: SearchAction, params: SearchParams) => void;
  initialQuery?: string;
  initialReplaceWith?: string;
  matchCount?: number;
  currentMatch?: number;
  mode?: SearchMode;
  activationKey?: number;
  onModeChange?: (mode: SearchMode) => void;
}

export interface SearchParams {
  query: string;
  replaceWith: string;
  matchCase: boolean;
  regexp: boolean;
  wholeWord: boolean;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildSearchPattern(query: string, matchCase: boolean, regexp: boolean, wholeWord: boolean) {
  if (!query) return null;

  const source = regexp ? query : escapeRegExp(query);
  const wrappedSource = wholeWord ? `\\b(?:${source})\\b` : source;
  const flags = matchCase ? 'g' : 'gi';

  try {
    return new RegExp(wrappedSource, flags);
  } catch {
    return 'invalid' as const;
  }
}

export function countMatches(content: string, query: string, matchCase: boolean, regexp: boolean, wholeWord: boolean) {
  const pattern = buildSearchPattern(query, matchCase, regexp, wholeWord);
  if (!pattern) return { count: 0, invalid: false };
  if (pattern === 'invalid') return { count: 0, invalid: true };

  const matches = content.match(pattern);
  return { count: matches?.length ?? 0, invalid: false };
}

export function SearchPanel({
  visible,
  viewMode,
  content,
  onClose,
  onSearch,
  initialQuery = '',
  initialReplaceWith = '',
  matchCount,
  currentMatch,
  mode = 'find',
  activationKey = 0,
  onModeChange,
}: SearchPanelProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [replaceWith, setReplaceWith] = useState(initialReplaceWith);
  const matchCase = false;
  const regexp = false;
  const wholeWord = false;
  const [localCurrentMatch, setLocalCurrentMatch] = useState(0);
  
  const queryInputRef = useRef<HTMLInputElement>(null);
  const replaceWithRef = useRef(initialReplaceWith);

  const localMatchState = countMatches(content, query, matchCase, regexp, wholeWord);
  const resolvedMatchCount = matchCount ?? localMatchState.count;
  const resolvedCurrentMatch = currentMatch ?? localCurrentMatch;
  const canReplace = viewMode !== 'preview';
  const panelMode: SearchMode = canReplace && mode === 'replace' ? 'replace' : 'find';
  const params = (nextQuery = query, nextReplaceWith = replaceWithRef.current): SearchParams => ({
    query: nextQuery,
    replaceWith: nextReplaceWith,
    matchCase,
    regexp,
    wholeWord,
  });

  useEffect(() => {
    if (visible && queryInputRef.current) {
      queryInputRef.current.focus();
      queryInputRef.current.select();
    }
  }, [activationKey, visible]);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
    }
  }, [initialQuery, visible]);

  useEffect(() => {
    if (visible) {
      replaceWithRef.current = initialReplaceWith;
      setReplaceWith(initialReplaceWith);
    }
  }, [initialReplaceWith, visible]);

  useEffect(() => {
    setLocalCurrentMatch(query ? 1 : 0);
  }, [query]);

  if (!visible) return null;

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setLocalCurrentMatch(nextQuery ? 1 : 0);
    onSearch('input', params(nextQuery));
  };

  const handleAction = (action: SearchAction) => {
    if ((action === 'next' || action === 'prev') && resolvedMatchCount > 0) {
      setLocalCurrentMatch((current) => {
        const normalized = current > 0 ? current : (action === 'prev' ? 1 : 0);
        if (action === 'prev') {
          return normalized <= 1 ? resolvedMatchCount : normalized - 1;
        }
        return normalized >= resolvedMatchCount ? 1 : normalized + 1;
      });
    }
    onSearch(action, params());
  };

  const handleReplaceChange = (nextReplaceWith: string) => {
    replaceWithRef.current = nextReplaceWith;
    setReplaceWith(nextReplaceWith);
  };

  const toggleReplaceMode = () => {
    onModeChange?.(panelMode === 'replace' ? 'find' : 'replace');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handleAction('prev');
      } else {
        handleAction('next');
      }
    }
  };

  const resultText = query
    ? localMatchState.invalid
      ? '0/0'
      : resolvedMatchCount === 0
        ? '0/0'
        : `${resolvedCurrentMatch || 1}/${resolvedMatchCount}`
    : '';

  return (
    <div className={`compat-search-panel ${canReplace ? 'has-replace-toggle' : ''} ${panelMode === 'replace' ? 'is-replace' : ''}`}>
      <div className="compat-search-row compat-search-row--find">
        {canReplace && (
          <button
            type="button"
            className={`compat-search-button compat-search-button--mode ${panelMode === 'replace' ? 'is-active' : ''}`}
            title={panelMode === 'replace' ? t('editor.search.hideReplace') : t('editor.search.showReplace')}
            aria-label={panelMode === 'replace' ? t('editor.search.hideReplace') : t('editor.search.showReplace')}
            aria-pressed={panelMode === 'replace'}
            onClick={toggleReplaceMode}
          />
        )}
        <div className="compat-search-field-wrap compat-search-field-wrap--find">
          <input
            ref={queryInputRef}
            type="text"
            placeholder={t('editor.search.find')}
            aria-label={t('editor.search.find')}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            className="compat-search-field"
          />
        </div>

        <div className={`compat-search-match ${query && resolvedMatchCount === 0 ? 'is-empty' : ''}`}>
          {resultText}
        </div>

        <button
          type="button"
          className="compat-search-button compat-search-button--previous"
          title={t('editor.search.previous')}
          aria-label={t('editor.search.previous')}
          disabled={!resolvedMatchCount}
          onClick={() => handleAction('prev')}
        />
        <button
          type="button"
          className="compat-search-button compat-search-button--next"
          title={t('editor.search.next')}
          aria-label={t('editor.search.next')}
          disabled={!resolvedMatchCount}
          onClick={() => handleAction('next')}
        />
        <button
          type="button"
          className="compat-search-button compat-search-button--close"
          title={t('editor.search.done')}
          aria-label={t('editor.search.done')}
          onClick={onClose}
        />
      </div>

      {canReplace && (
        <div className="compat-search-row compat-search-row--replace" aria-hidden={panelMode !== 'replace'}>
          <div className="compat-search-field-wrap compat-search-field-wrap--replace">
            <input
              type="text"
              placeholder={t('editor.search.replace')}
              aria-label={t('editor.search.replace')}
              value={replaceWith}
              onChange={(e) => handleReplaceChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAction('replace');
                }
              }}
              className="compat-search-field"
            />
          </div>
          <button
            type="button"
            className="compat-search-button compat-search-button--replace"
            title={t('editor.search.replace')}
            aria-label={t('editor.search.replace')}
            disabled={!resolvedMatchCount}
            onClick={() => handleAction('replace')}
          />
          <button
            type="button"
            className="compat-search-button compat-search-button--replace-all"
            title={t('editor.search.replaceAll')}
            aria-label={t('editor.search.replaceAll')}
            disabled={!resolvedMatchCount}
            onClick={() => handleAction('replaceAll')}
          />
        </div>
      )}
    </div>
  );
}
