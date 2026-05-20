import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n';

interface HeadingItem {
  level: number;
  text: string;
  line: number;
}

interface OutlinePanelProps {
  content: string;
  onHeadingClick?: (line: number) => void;
}

function extractHeadings(content: string): HeadingItem[] {
  const lines = content.split('\n');
  const headings: HeadingItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      });
    }
  }

  return headings;
}

export function OutlinePanel({ content, onHeadingClick }: OutlinePanelProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const headings = useMemo(() => extractHeadings(content), [content]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleHeadings = useMemo(() => {
    if (!normalizedQuery) return headings;
    return headings.filter((heading) => heading.text.toLowerCase().includes(normalizedQuery));
  }, [headings, normalizedQuery]);

  if (headings.length === 0) {
    return (
      <div style={{ padding: '16px', fontSize: '13px', opacity: 0.6 }}>
        {t('workspace.outline.empty')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '8px 12px 6px' }}>
        <input
          type="search"
          aria-label={t('workspace.outline.searchAria')}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={t('workspace.outline.searchPlaceholder')}
          style={{
            width: '100%',
            height: '30px',
            border: '1px solid var(--theme-divider, var(--border-color))',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface-solid)',
            color: 'var(--text-primary)',
            padding: '0 10px',
            fontSize: '12px',
            outline: 'none',
          }}
        />
      </div>

      {visibleHeadings.length === 0 ? (
        <div style={{ padding: '12px 16px', fontSize: '13px', opacity: 0.6 }}>
          {t('workspace.outline.noMatches')}
        </div>
      ) : (
        <div style={{ padding: '0 0 8px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {visibleHeadings.map((h) => (
            <button
              key={`${h.line}-${h.text}`}
              type="button"
              onClick={() => onHeadingClick?.(h.line)}
              className="outline-item"
              style={{
                border: 'none',
                padding: '6px 12px',
                paddingLeft: `${16 + (h.level - 1) * 12}px`,
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-md)',
                margin: '0 8px',
                textAlign: 'left',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transition: 'all var(--duration-fast) var(--ease-out)',
              }}
            >
              {h.text}
            </button>
          ))}
        </div>
      )}
      <style>{`
        .outline-item:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
        .outline-item:active {
          background: var(--bg-active);
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}
