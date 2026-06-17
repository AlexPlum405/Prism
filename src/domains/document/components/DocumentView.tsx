import { forwardRef } from 'react';
import { useDocumentStore } from '../store';
import { SplitView } from '../../editor/components/SplitView';
import type { EditorPaneHandle } from '../../editor/components/EditorPane';
import type { WorkspaceIndex } from '../../workspace/services';
import { useI18n } from '../../i18n';
import { PRISM_BRAND_PILLARS } from '../../../lib/brand';

interface DocumentViewProps {
  onCursorChange?: (cursor: { line: number; column: number }) => void;
  onOpenDocumentLink?: (
    target: string,
    options: { kind: 'markdown' | 'wiki'; sourcePath?: string },
  ) => void | Promise<void>;
  onSelectionTextChange?: (text: string) => void;
  onNotice?: (message: string) => void;
  workspaceIndex?: WorkspaceIndex | null;
  workspaceIndexJobId?: string | null;
}

export const DocumentView = forwardRef<EditorPaneHandle, DocumentViewProps>(
  function DocumentView({
    onCursorChange,
    onOpenDocumentLink,
    onSelectionTextChange,
    onNotice,
    workspaceIndex,
    workspaceIndexJobId,
  }, ref) {
    const { t } = useI18n();
    const currentDocument = useDocumentStore((s) => s.currentDocument);
    const updateContent = useDocumentStore((s) => s.updateContent);
    const updateScrollState = useDocumentStore((s) => s.updateScrollState);

    if (!currentDocument) {
      return (
        <div className="prism-empty-state" role="status" aria-label={t('document.emptyTitle')}>
          <div className="prism-empty-state__kicker">PRISM</div>
          <h1>{t('document.emptyTitle')}</h1>
          <p>{t('document.emptyBody')}</p>
          <ul className="prism-empty-state__pillars" aria-label={t('brand.pillarsLabel')}>
            {PRISM_BRAND_PILLARS.map((pillar) => (
              <li key={pillar.id}>
                <strong>{t(pillar.titleKey)}</strong>
                <span>{t(pillar.bodyKey)}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          minWidth: 0,
          position: 'relative',
        }}
      >
        <SplitView
          ref={ref}
          content={currentDocument.content}
          documentPath={currentDocument.path}
          scrollState={currentDocument.scrollState}
          viewMode={currentDocument.viewMode}
          onChange={updateContent}
          onCursorChange={onCursorChange}
          onOpenDocumentLink={onOpenDocumentLink}
          onSelectionTextChange={onSelectionTextChange}
          onNotice={onNotice}
          onScrollStateChange={updateScrollState}
          workspaceIndex={workspaceIndex}
          workspaceIndexJobId={workspaceIndexJobId}
        />
      </div>
    );
  },
);
