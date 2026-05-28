import { lazy, Suspense } from 'react';
import { DocumentDiagnosticsPanel } from '../../domains/editor/components/DocumentDiagnosticsPanel';
import { DocumentPropertiesPanel } from '../../domains/editor/components/DocumentPropertiesPanel';
import { TypographyDiagnosticsPanel } from '../../domains/editor/components/TypographyDiagnosticsPanel';
import { BacklinksPanel } from '../../domains/workspace/components/BacklinksPanel';
import { DocumentLinksPanel } from '../../domains/workspace/components/DocumentLinksPanel';
import type { PrismDiagnostic } from '../../domains/diagnostics/types';
import type { TypographyDiagnostic } from '../../domains/editor/extensions/typographyDiagnostics';
import type {
  BacklinkReference,
  DocumentLinkReference,
  WorkspaceIndex,
} from '../../domains/workspace/services';

const RelationGraphPanel = lazy(() => import('../../domains/workspace/components/RelationGraphPanel')
  .then((module) => ({ default: module.RelationGraphPanel })));

interface DocumentPanelsControllerProps {
  backlinks: BacklinkReference[];
  backlinksVisible: boolean;
  currentDocumentContent: string;
  currentDocumentPath?: string | null;
  displayedDiagnostics: PrismDiagnostic[];
  documentLinks: DocumentLinkReference[];
  documentLinksVisible: boolean;
  documentPropertiesVisible: boolean;
  linkDiagnosticsVisible: boolean;
  relationGraphVisible: boolean;
  typographyDiagnostics: TypographyDiagnostic[];
  typographyDiagnosticsVisible: boolean;
  workspaceIndex: WorkspaceIndex | null;
  onApplyDocumentProperties: (content: string) => void;
  onBacklinkSelect: (reference: BacklinkReference) => void;
  onBacklinksClose: () => void;
  onDocumentLinkSelect: (link: DocumentLinkReference) => void;
  onDocumentLinksClose: () => void;
  onDocumentPropertiesClose: () => void;
  onDocumentPropertiesNotice: (message: string) => void;
  onLinkDiagnosticSelect: (line: number) => void;
  onLinkDiagnosticsClose: () => void;
  onRelationGraphClose: () => void;
  onRelationGraphSelect: (path: string) => void;
  onTypographyDiagnosticSelect: (line: number) => void;
  onTypographyDiagnosticsClose: () => void;
}

export function DocumentPanelsController({
  backlinks,
  backlinksVisible,
  currentDocumentContent,
  currentDocumentPath,
  displayedDiagnostics,
  documentLinks,
  documentLinksVisible,
  documentPropertiesVisible,
  linkDiagnosticsVisible,
  relationGraphVisible,
  typographyDiagnostics,
  typographyDiagnosticsVisible,
  workspaceIndex,
  onApplyDocumentProperties,
  onBacklinkSelect,
  onBacklinksClose,
  onDocumentLinkSelect,
  onDocumentLinksClose,
  onDocumentPropertiesClose,
  onDocumentPropertiesNotice,
  onLinkDiagnosticSelect,
  onLinkDiagnosticsClose,
  onRelationGraphClose,
  onRelationGraphSelect,
  onTypographyDiagnosticSelect,
  onTypographyDiagnosticsClose,
}: DocumentPanelsControllerProps) {
  return (
    <>
      <DocumentDiagnosticsPanel
        visible={linkDiagnosticsVisible}
        diagnostics={displayedDiagnostics}
        onClose={onLinkDiagnosticsClose}
        onSelect={onLinkDiagnosticSelect}
      />

      <BacklinksPanel
        visible={backlinksVisible}
        backlinks={backlinks}
        onClose={onBacklinksClose}
        onSelect={onBacklinkSelect}
      />

      <DocumentLinksPanel
        visible={documentLinksVisible}
        links={documentLinks}
        onClose={onDocumentLinksClose}
        onSelect={onDocumentLinkSelect}
      />

      {relationGraphVisible && (
        <Suspense fallback={null}>
          <RelationGraphPanel
            visible={relationGraphVisible}
            index={workspaceIndex}
            currentPath={currentDocumentPath}
            onClose={onRelationGraphClose}
            onSelect={(path) => {
              onRelationGraphClose();
              onRelationGraphSelect(path);
            }}
          />
        </Suspense>
      )}

      <DocumentPropertiesPanel
        visible={documentPropertiesVisible}
        content={currentDocumentContent}
        onClose={onDocumentPropertiesClose}
        onApply={onApplyDocumentProperties}
        onNotice={onDocumentPropertiesNotice}
      />

      <TypographyDiagnosticsPanel
        visible={typographyDiagnosticsVisible}
        diagnostics={typographyDiagnostics}
        onClose={onTypographyDiagnosticsClose}
        onSelect={onTypographyDiagnosticSelect}
      />
    </>
  );
}
