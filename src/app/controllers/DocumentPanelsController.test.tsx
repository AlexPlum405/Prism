import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentPanelsController } from './DocumentPanelsController';
import type { PrismDiagnostic } from '../../domains/diagnostics/types';
import type { BacklinkReference } from '../../domains/workspace/services';
import { buildWorkspaceIndex } from '../../domains/workspace/services';

const diagnostic: PrismDiagnostic = {
  action: '修正路径',
  column: 3,
  kind: 'image',
  line: 8,
  message: '缺失图片',
  reason: '本地图片不存在',
  severity: 'error',
  source: 'image-diagnostics',
};

const backlink: BacklinkReference = {
  column: 2,
  excerpt: '来自项目说明的引用',
  line: 4,
  path: '/repo/readme.md',
  title: 'readme.md',
};

function renderController(overrides: Partial<Parameters<typeof DocumentPanelsController>[0]> = {}) {
  const props: Parameters<typeof DocumentPanelsController>[0] = {
    backlinks: [],
    backlinksVisible: false,
    currentDocumentContent: '',
    currentDocumentPath: '/repo/current.md',
    displayedDiagnostics: [],
    documentLinks: [],
    documentLinksVisible: false,
    documentPropertiesVisible: false,
    linkDiagnosticsVisible: false,
    relationGraphVisible: false,
    typographyDiagnostics: [],
    typographyDiagnosticsVisible: false,
    workspaceIndex: null,
    onApplyDocumentProperties: vi.fn(),
    onBacklinkSelect: vi.fn(),
    onBacklinksClose: vi.fn(),
    onDocumentLinkSelect: vi.fn(),
    onDocumentLinksClose: vi.fn(),
    onDocumentPropertiesClose: vi.fn(),
    onDocumentPropertiesNotice: vi.fn(),
    onLinkDiagnosticSelect: vi.fn(),
    onLinkDiagnosticsClose: vi.fn(),
    onRelationGraphClose: vi.fn(),
    onRelationGraphSelect: vi.fn(),
    onTypographyDiagnosticSelect: vi.fn(),
    onTypographyDiagnosticsClose: vi.fn(),
    ...overrides,
  };

  render(<DocumentPanelsController {...props} />);
  return props;
}

describe('DocumentPanelsController', () => {
  it('delegates document diagnostics and backlinks selection', () => {
    const props = renderController({
      backlinks: [backlink],
      backlinksVisible: true,
      displayedDiagnostics: [diagnostic],
      linkDiagnosticsVisible: true,
    });

    fireEvent.click(screen.getByRole('button', { name: /缺失图片/ }));
    fireEvent.click(screen.getByRole('button', { name: /来自项目说明的引用/ }));

    expect(props.onLinkDiagnosticSelect).toHaveBeenCalledWith(8);
    expect(props.onBacklinkSelect).toHaveBeenCalledWith(backlink);
  });

  it('closes relation graph before opening selected graph node', async () => {
    const workspaceIndex = buildWorkspaceIndex({
      fileTree: [
        { path: '/repo/current.md', name: 'current.md', kind: 'file' },
        { path: '/repo/target.md', name: 'target.md', kind: 'file' },
      ],
      workspaceRoot: '/repo',
      documents: [
        { path: '/repo/current.md', content: '# Current\n[Target](target.md)' },
        { path: '/repo/target.md', content: '# Target\n' },
      ],
    });
    const props = renderController({
      relationGraphVisible: true,
      workspaceIndex,
    });

    await screen.findByRole('dialog', { name: '关系图谱' });
    fireEvent.doubleClick(screen.getByRole('button', { name: '打开 Target' }));

    expect(props.onRelationGraphClose).toHaveBeenCalledTimes(1);
    expect(props.onRelationGraphSelect).toHaveBeenCalledWith('/repo/target.md');
  });
});
