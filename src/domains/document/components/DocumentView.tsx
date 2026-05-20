import { forwardRef } from 'react';
import { useDocumentStore } from '../store';
import { SplitView } from '../../editor/components/SplitView';
import { EditorPaneHandle } from '../../editor/components/EditorPane';
import type { WorkspaceIndex } from '../../workspace/services';
import { useI18n } from '../../i18n';

interface DocumentViewProps {
  onCursorChange?: (cursor: { line: number; column: number }) => void;
  onOpenDocumentLink?: (
    target: string,
    options: { kind: 'markdown' | 'wiki'; sourcePath?: string },
  ) => void | Promise<void>;
  onSelectionTextChange?: (text: string) => void;
  onNotice?: (message: string) => void;
  workspaceIndex?: WorkspaceIndex | null;
}

export const DocumentView = forwardRef<EditorPaneHandle, DocumentViewProps>(
  function DocumentView({ onCursorChange, onOpenDocumentLink, onSelectionTextChange, onNotice, workspaceIndex }, ref) {
    const { t } = useI18n();
    const currentDocument = useDocumentStore((s) => s.currentDocument);
    const updateContent = useDocumentStore((s) => s.updateContent);
    const updateScrollState = useDocumentStore((s) => s.updateScrollState);

    if (!currentDocument) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            fontSize: '14px',
          }}
        >
          {t('document.emptyPrompt')}
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
        />
      </div>
    );
  },
);
