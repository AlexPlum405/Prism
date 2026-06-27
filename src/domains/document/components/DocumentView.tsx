import { forwardRef } from 'react';
import { useDocumentStore } from '../store';
import { SplitView } from '../../editor/components/SplitView';
import type { EditorPaneHandle } from '../../editor/components/EditorPane';
import type { WorkspaceIndex } from '../../workspace/services';

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
    const currentDocument = useDocumentStore((s) => s.currentDocument);
    const updateContent = useDocumentStore((s) => s.updateContent);
    const updateScrollState = useDocumentStore((s) => s.updateScrollState);

    if (!currentDocument) {
      return null;
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
