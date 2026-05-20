/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { currentCompletions, startCompletion } from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentStore } from '../../document/store';
import { useWorkspaceStore } from '../../workspace/store';
import { buildWorkspaceIndex, type WorkspaceIndex } from '../../workspace/services';
import { EditorPane } from './EditorPane';

const imagePasteMock = vi.hoisted(() => ({
  getNativeImageFilePath: vi.fn(),
  saveClipboardImage: vi.fn(),
}));

vi.mock('../extensions/imagePaste', async () => {
  const actual = await vi.importActual<typeof import('../extensions/imagePaste')>('../extensions/imagePaste');
  return {
    ...actual,
    getNativeImageFilePath: imagePasteMock.getNativeImageFilePath,
    saveClipboardImage: imagePasteMock.saveClipboardImage,
  };
});

beforeAll(() => {
  if (!Range.prototype.getClientRects) {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      value: () => [],
    });
  }

  if (!Range.prototype.getBoundingClientRect) {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      value: () => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });
  }
});

beforeEach(() => {
  imagePasteMock.getNativeImageFilePath.mockReset();
  imagePasteMock.saveClipboardImage.mockReset();
  useDocumentStore.setState({ currentDocument: null });
  useWorkspaceStore.setState({ mode: 'single', rootPath: null, fileTree: [] });
});

function latestChange(changes: string[]) {
  return changes[changes.length - 1] ?? '';
}

function openSavedDocument() {
  useDocumentStore.setState({
    currentDocument: {
      path: '/repo/docs/Plan.md',
      name: 'Plan.md',
      content: '',
      isDirty: false,
      lastSavedAt: 1000,
      lastKnownMtime: 1000,
      lastKnownSize: 0,
      saveStatus: 'saved',
      saveError: null,
      viewMode: 'edit',
      scrollState: { editorRatio: 0, previewRatio: 0 },
    },
  });
}

function openWorkspaceForLinkCompletion() {
  useWorkspaceStore.setState({
    mode: 'folder',
    rootPath: '/repo',
    fileTree: [
      {
        kind: 'directory',
        name: 'docs',
        path: '/repo/docs',
        children: [
          { kind: 'file', name: 'guide.md', path: '/repo/docs/guide.md' },
          { kind: 'file', name: 'api.md', path: '/repo/docs/api.md' },
        ],
      },
      { kind: 'file', name: 'README.md', path: '/repo/README.md' },
      { kind: 'file', name: 'photo.png', path: '/repo/photo.png' },
    ],
  });
}

async function renderEditorPane(content: string, options: {
  onNotice?: (message: string) => void;
  workspaceIndex?: WorkspaceIndex | null;
} = {}) {
  const changes: string[] = [];
  const onChange = vi.fn((next: string) => {
    changes.push(next);
  });

  render(
    <div style={{ width: 800, height: 600 }}>
      <EditorPane
        content={content}
        onChange={onChange}
        onNotice={options.onNotice}
        workspaceIndex={options.workspaceIndex}
      />
    </div>,
  );

  await waitFor(() => {
    expect(document.querySelector('.cm-editor')).toBeInTheDocument();
  });

  return { changes, onChange };
}

function getEditorDom() {
  return document.querySelector('.cm-editor') as HTMLElement;
}

function getMountedEditorView() {
  const view = EditorView.findFromDOM(getEditorDom());
  if (!view) {
    throw new Error('Expected a mounted CodeMirror editor view');
  }
  return view;
}

async function pressEditorKey(key: string, init: KeyboardEventInit = {}) {
  const view = getMountedEditorView();
  view.focus();
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });

  await act(async () => {
    view.contentDOM.dispatchEvent(event);
    await Promise.resolve();
  });

  return event;
}

function dispatchImagePaste(file: File) {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    value: {
      items: [
        {
          type: file.type,
          getAsFile: () => file,
        },
      ],
    },
  });

  getEditorDom().dispatchEvent(event);
  return event;
}

function dispatchTextPaste(text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (type: string) => type === 'text/plain' ? text : '',
      items: [],
    },
  });

  getEditorDom().dispatchEvent(event);
  return event;
}

function dispatchImageDrop(file: File, altKey = false) {
  const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'altKey', { value: altKey });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files: [file],
      items: [{ type: file.type }],
    },
  });

  getEditorDom().dispatchEvent(event);
  return event;
}

async function dispatchEditorCommand(detail?: unknown) {
  await dispatchPrismEvent('prism-editor-command', detail);
}

async function dispatchPrismEvent(name: string, detail?: unknown) {
  await act(async () => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
    await Promise.resolve();
  });
}

describe('EditorPane command event integration', () => {
  it('handles table commands dispatched from menus and the command palette', async () => {
    const { changes, onChange } = await renderEditorPane('# Draft\n');

    await dispatchEditorCommand({ command: 'insertTable' });
    expect(document.querySelector('.prism-table-popover')).toBeInTheDocument();

    const gridCell = document.querySelector('button[aria-label="3 x 2"]') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(gridCell);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toContain('| Column 1 | Column 2 | Column 3 |');
      expect(latestChange(changes)).toContain('| -------- | -------- | -------- |');
    });
  });

  it('fills markdown tables through keyboard navigation and CSV paste', async () => {
    const source = [
      '| Name | Score |',
      '| --- | --- |',
      '| A<cursor> | 1 |',
    ].join('\n');
    const cursor = source.indexOf('<cursor>');
    const { changes, onChange } = await renderEditorPane(source.replace('<cursor>', ''));
    const view = getMountedEditorView();

    act(() => {
      view.dispatch({ selection: { anchor: cursor } });
    });
    expect(document.querySelector('.prism-table-toolbar')).toBeInTheDocument();

    const tab = await pressEditorKey('Tab');
    expect(tab.defaultPrevented).toBe(true);
    expect(view.state.selection.main.head).toBeGreaterThan(cursor);

    act(() => {
      view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('A') + 1 } });
    });

    const paste = dispatchTextPaste('B,2\nC,3');
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toContain('| B    | 2     |');
      expect(latestChange(changes)).toContain('| C    | 3     |');
    });
    expect(paste.defaultPrevented).toBe(true);
  });

  it('copies and sorts the active table through editor commands', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const source = [
      '| Name | Score<cursor> |',
      '| --- | --- |',
      '| Beta | 2 |',
      '| Alpha | 10 |',
    ].join('\n');
    const cursor = source.indexOf('<cursor>');
    const { changes, onChange } = await renderEditorPane(source.replace('<cursor>', ''));
    const view = getMountedEditorView();

    act(() => {
      view.dispatch({ selection: { anchor: cursor } });
    });

    await dispatchEditorCommand({ command: 'copyTableCsv' });
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('Name,Score\nBeta,2\nAlpha,10');
    });

    await dispatchEditorCommand({ command: 'sortTableDesc' });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toContain('| Alpha | 10    |\n| Beta  | 2     |');
    });
  });

  it('handles template insertion events without requiring a separate WYSIWYG layer', async () => {
    const { changes, onChange } = await renderEditorPane('Intro paragraph.');

    await dispatchEditorCommand({ command: 'insertTemplate', templateId: 'prd' });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toContain('# PRD：未命名');
      expect(latestChange(changes)).toContain('Intro paragraph.');
    });
  });

  it('ignores invalid template ids coming from global editor events', async () => {
    const { changes, onChange } = await renderEditorPane('Stable content.');

    await dispatchEditorCommand({ command: 'insertTemplate', templateId: 'unknown-template' });

    await waitFor(() => {
      expect(onChange).not.toHaveBeenCalled();
      expect(latestChange(changes)).toBe('');
    });
  });

  it('handles inline formatting events against the active CodeMirror selection', async () => {
    const { changes, onChange } = await renderEditorPane('Prism');

    await dispatchEditorCommand({ command: 'selectAll' });
    await dispatchPrismEvent('prism-format', { format: 'bold' });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toBe('**Prism**');
    });
  });

  it('handles heading events from menus and the command palette', async () => {
    const { changes, onChange } = await renderEditorPane('Section title');

    await dispatchPrismEvent('prism-heading', { level: 'h2' });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toBe('## Section title');
    });
  });

  it('ignores invalid heading event payloads without changing the document', async () => {
    const { changes, onChange } = await renderEditorPane('Stable heading');

    await dispatchPrismEvent('prism-heading', { level: 'bad' });
    await dispatchPrismEvent('prism-heading', {});

    await waitFor(() => {
      expect(onChange).not.toHaveBeenCalled();
      expect(latestChange(changes)).toBe('');
    });
  });

  it('handles block formatting events for source-only list and quote commands', async () => {
    const { changes, onChange } = await renderEditorPane('Follow up');

    await dispatchPrismEvent('prism-block-format', { format: 'taskList' });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toBe('- [ ] Follow up');
    });
  });

  it('handles source block operation commands without a WYSIWYG layer', async () => {
    const { changes, onChange } = await renderEditorPane('Alpha\n\nBeta');
    const view = getMountedEditorView();

    act(() => {
      view.dispatch({ selection: { anchor: 'Alpha\n\n'.length } });
    });

    await dispatchEditorCommand({ command: 'moveParagraphUp' });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toBe('Beta\n\nAlpha');
    });
  });

  it('duplicates and deletes the current paragraph through source block commands', async () => {
    const { changes, onChange } = await renderEditorPane('Alpha\n\nBeta\n\nGamma');
    const view = getMountedEditorView();

    act(() => {
      view.dispatch({ selection: { anchor: 'Alpha\n\n'.length } });
    });

    await dispatchEditorCommand({ command: 'duplicateParagraph' });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toBe('Alpha\n\nBeta\n\nBeta\n\nGamma');
    });

    act(() => {
      view.dispatch({
        selection: { anchor: view.state.doc.toString().indexOf('Gamma') },
      });
    });

    await dispatchEditorCommand({ command: 'deleteParagraph' });

    await waitFor(() => {
      expect(latestChange(changes)).toBe('Alpha\n\nBeta\n\nBeta');
    });
  });

  it('turns the active selection into a callout through editor commands', async () => {
    const { changes, onChange } = await renderEditorPane('Risk item');

    await dispatchEditorCommand({ command: 'selectAll' });
    await dispatchEditorCommand({ command: 'selectionCalloutWarning' });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toBe('> [!WARNING]\n> Risk item');
    });
  });

  it('accepts fold current heading commands without changing source text', async () => {
    const { changes, onChange } = await renderEditorPane('## Section\nBody');

    await dispatchEditorCommand({ command: 'foldCurrentHeading' });

    await waitFor(() => {
      expect(onChange).not.toHaveBeenCalled();
      expect(latestChange(changes)).toBe('');
    });
  });

  it('handles markdown list keys through the mounted CodeMirror keymap', async () => {
    const { changes, onChange } = await renderEditorPane('- first');
    const view = getMountedEditorView();

    act(() => {
      view.dispatch({ selection: { anchor: view.state.doc.length } });
    });

    const enterEvent = await pressEditorKey('Enter');

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toBe('- first\n- ');
    });
    expect(enterEvent.defaultPrevented).toBe(true);

    await pressEditorKey('Enter');

    await waitFor(() => {
      expect(latestChange(changes)).toBe('- first\n');
    });

    act(() => {
      const nextView = getMountedEditorView();
      nextView.dispatch({ selection: { anchor: 0 } });
    });

    await pressEditorKey('Tab');

    await waitFor(() => {
      expect(latestChange(changes)).toBe('  - first\n');
    });

    await pressEditorKey('Tab', { shiftKey: true });

    await waitFor(() => {
      expect(latestChange(changes)).toBe('- first\n');
    });
  });

  it('surfaces markdown link completions from the mounted CodeMirror editor context', async () => {
    openSavedDocument();
    openWorkspaceForLinkCompletion();
    const { changes } = await renderEditorPane('# Existing Heading\n');

    act(() => {
      const view = getMountedEditorView();
      const insert = '\n[Guide](';
      const from = view.state.doc.length;
      view.dispatch({
        changes: { from, insert },
        selection: { anchor: from + insert.length },
      });
    });

    await waitFor(() => {
      expect(latestChange(changes)).toBe('# Existing Heading\n\n[Guide](');
    });

    act(() => {
      const started = startCompletion(getMountedEditorView());
      expect(started).toBe(true);
    });

    await waitFor(() => {
      const labels = currentCompletions(getMountedEditorView().state).map((completion) => completion.label);
      expect(labels).toEqual(expect.arrayContaining([
        'guide.md',
        'api.md',
        '../README.md',
        '#existing-heading',
      ]));
      expect(labels).not.toContain('photo.png');
    });
  });

  it('surfaces wiki link completions from the mounted CodeMirror editor context', async () => {
    openSavedDocument();
    openWorkspaceForLinkCompletion();
    const { changes } = await renderEditorPane('# Existing Heading\n');

    act(() => {
      const view = getMountedEditorView();
      const from = view.state.doc.length;
      view.dispatch({
        changes: { from, insert: '\n[[' },
        selection: { anchor: from + 3 },
      });
    });

    await waitFor(() => {
      expect(latestChange(changes)).toBe('# Existing Heading\n\n[[');
    });

    act(() => {
      const started = startCompletion(getMountedEditorView());
      expect(started).toBe(true);
    });

    await waitFor(() => {
      const labels = currentCompletions(getMountedEditorView().state).map((completion) => completion.label);
      expect(labels).toEqual(expect.arrayContaining([
        'docs/guide',
        'docs/api',
        'README',
        '#existing-heading',
      ]));
      expect(labels).not.toContain('photo');
      expect(labels).not.toContain('photo.png');
    });
  });

  it('surfaces indexed document titles and headings in wiki link completion', async () => {
    openSavedDocument();
    openWorkspaceForLinkCompletion();
    const workspaceIndex = buildWorkspaceIndex({
      fileTree: useWorkspaceStore.getState().fileTree,
      workspaceRoot: '/repo',
      documents: [
        {
          path: '/repo/docs/guide.md',
          content: '---\ntitle: 入门指南\n---\n# 安装步骤\n正文',
        },
      ],
    });
    const { changes } = await renderEditorPane('', { workspaceIndex });

    act(() => {
      const view = getMountedEditorView();
      view.dispatch({
        changes: { from: 0, insert: '[[' },
        selection: { anchor: 2 },
      });
    });

    await waitFor(() => {
      expect(latestChange(changes)).toBe('[[');
    });

    act(() => {
      const started = startCompletion(getMountedEditorView());
      expect(started).toBe(true);
    });

    await waitFor(() => {
      const labels = currentCompletions(getMountedEditorView().state).map((completion) => completion.label);
      expect(labels).toEqual(expect.arrayContaining(['入门指南', '安装步骤']));
    });
  });

  it('surfaces slash menu snippets through the mounted CodeMirror editor context', async () => {
    const { changes } = await renderEditorPane('');

    act(() => {
      const view = getMountedEditorView();
      view.dispatch({
        changes: { from: 0, insert: '/' },
        selection: { anchor: 1 },
      });
    });

    await waitFor(() => {
      expect(latestChange(changes)).toBe('/');
    });

    act(() => {
      const started = startCompletion(getMountedEditorView());
      expect(started).toBe(true);
    });

    await waitFor(() => {
      const labels = currentCompletions(getMountedEditorView().state).map((completion) => completion.label);
      expect(labels).toEqual(expect.arrayContaining([
        '标题',
        '表格',
        'Mermaid 图表',
        'KaTeX 公式',
        'Callout: Note',
        'Callout: Important',
        'Toggle 折叠块',
        '分割线',
        '图片',
        '链接',
        '模板：会议纪要',
        '导出设置块',
      ]));
    });
  });

  it('ignores invalid block and editor command payloads without changing the document', async () => {
    const { changes, onChange } = await renderEditorPane('Stable command text');

    await dispatchPrismEvent('prism-block-format', {});
    await dispatchPrismEvent('prism-block-format');
    await dispatchEditorCommand({});
    await dispatchEditorCommand();

    await waitFor(() => {
      expect(onChange).not.toHaveBeenCalled();
      expect(latestChange(changes)).toBe('');
    });
  });

  it('inserts pasted clipboard images through the document asset pipeline', async () => {
    openSavedDocument();
    imagePasteMock.saveClipboardImage.mockResolvedValue('![clip.png](assets/Plan/clip.png)');
    const { changes, onChange } = await renderEditorPane('Before\n');

    const event = dispatchImagePaste(new File([new Uint8Array([1, 2, 3])], 'clip.png', { type: 'image/png' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toContain('![clip.png](assets/Plan/clip.png)');
    });
    expect(event.defaultPrevented).toBe(true);
    expect(imagePasteMock.saveClipboardImage).toHaveBeenCalledWith(expect.objectContaining({
      documentName: 'Plan.md',
      documentPath: '/repo/docs/Plan.md',
    }));
  });

  it('copies dropped images into the document asset pipeline when Alt/Option is not pressed', async () => {
    openSavedDocument();
    imagePasteMock.saveClipboardImage.mockResolvedValue('![photo.png](assets/Plan/photo.png)');
    const { changes, onChange } = await renderEditorPane('Before\n');

    const event = dispatchImageDrop(new File([new Uint8Array([1])], 'photo.png', { type: 'image/png' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toContain('![photo.png](assets/Plan/photo.png)');
    });
    expect(event.defaultPrevented).toBe(true);
    expect(imagePasteMock.saveClipboardImage).toHaveBeenCalledWith(expect.objectContaining({
      documentName: 'Plan.md',
      documentPath: '/repo/docs/Plan.md',
    }));
    expect(imagePasteMock.getNativeImageFilePath).not.toHaveBeenCalled();
  });

  it('inserts original image paths on Alt/Option drop without copying assets', async () => {
    imagePasteMock.getNativeImageFilePath.mockReturnValue('/repo/assets/photo.png');
    const { changes, onChange } = await renderEditorPane('Before\n');

    const event = dispatchImageDrop(new File([new Uint8Array([1])], 'photo.png', { type: 'image/png' }), true);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(latestChange(changes)).toContain('![photo.png](/repo/assets/photo.png)');
    });
    expect(event.defaultPrevented).toBe(true);
    expect(imagePasteMock.saveClipboardImage).not.toHaveBeenCalled();
  });

  it('shows a notice when Alt/Option drop cannot read native image paths', async () => {
    const onNotice = vi.fn();
    imagePasteMock.getNativeImageFilePath.mockReturnValue(null);
    const { changes, onChange } = await renderEditorPane('Before\n', { onNotice });

    const event = dispatchImageDrop(new File([new Uint8Array([1])], 'photo.png', { type: 'image/png' }), true);

    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith('当前运行环境无法读取拖拽文件原始路径');
    });
    expect(event.defaultPrevented).toBe(true);
    expect(imagePasteMock.saveClipboardImage).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(latestChange(changes)).toBe('');
  });
});
