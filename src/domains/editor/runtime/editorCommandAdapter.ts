import { redo, undo } from '@codemirror/commands';
import { foldable } from '@codemirror/language';
import type { EditorView } from '@codemirror/view';
import { markdownSelectionToRichClipboardInput, writeRichClipboard } from '../extensions/richCopy';
import { formatMarkdownDocument } from './markdownAutoFormat';

interface BasicEditorCommandDeps {
  handleImagePaste?: (view: EditorView) => Promise<boolean>;
  handleTablePasteText: (view: EditorView, text: string) => boolean;
}

async function writePlainTextClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand?.('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('Clipboard write failed');
}

async function readPlainTextClipboard(): Promise<string> {
  if (!navigator.clipboard?.readText) return '';
  return navigator.clipboard.readText();
}

function getSelectionText(view: EditorView) {
  const selection = view.state.selection.main;
  if (selection.from === selection.to) return '';
  return view.state.doc.sliceString(selection.from, selection.to);
}

export function getCurrentHeadingFoldRange(view: EditorView) {
  let line = view.state.doc.lineAt(view.state.selection.main.head);

  while (line.number >= 1) {
    if (/^#{1,6}\s+\S/.test(line.text)) {
      return foldable(view.state, line.from, line.to);
    }
    if (line.number === 1) break;
    line = view.state.doc.line(line.number - 1);
  }

  return null;
}

export function runBasicEditorCommand(
  command: string,
  view: EditorView,
  deps: BasicEditorCommandDeps,
) {
  switch (command) {
    case 'undo':
      undo(view);
      return true;
    case 'redo':
      redo(view);
      return true;
    case 'cut': {
      const selection = view.state.selection.main;
      const text = getSelectionText(view);
      if (text) {
        void writePlainTextClipboard(text).then(() => {
          view.dispatch({
            changes: { from: selection.from, to: selection.to, insert: '' },
            selection: { anchor: selection.from },
            scrollIntoView: true,
          });
          view.focus();
        });
      }
      return true;
    }
    case 'copy':
    case 'copyMd':
    case 'copyPlain': {
      const text = getSelectionText(view);
      if (text) void writePlainTextClipboard(text);
      return true;
    }
    case 'copyHtml': {
      const selection = view.state.selection.main;
      const text = view.state.doc.sliceString(selection.from, selection.to);
      if (text) {
        void markdownSelectionToRichClipboardInput(text).then(writeRichClipboard);
      }
      return true;
    }
    case 'selectAll':
      view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
      return true;
    case 'paste':
    case 'pastePlain':
      void (async () => {
        if (command === 'paste' && deps.handleImagePaste && await deps.handleImagePaste(view)) return;
        const text = await readPlainTextClipboard();
        if (!text) return;
        if (deps.handleTablePasteText(view, text)) return;
        view.dispatch({
          changes: { from: view.state.selection.main.from, to: view.state.selection.main.to, insert: text },
          selection: { anchor: view.state.selection.main.from + text.length },
          scrollIntoView: true,
        });
        view.focus();
      })();
      return true;
    case 'clearFormat': {
      const selection = view.state.selection.main;
      const raw = view.state.doc.sliceString(selection.from, selection.to);
      const cleaned = raw.replace(/[*_~`<>[\]()#]/g, '');
      view.dispatch({ changes: { from: selection.from, to: selection.to, insert: cleaned } });
      return true;
    }
    case 'autoFormat': {
      const raw = view.state.doc.toString();
      const formatted = formatMarkdownDocument(raw);
      if (formatted !== raw) {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
      }
      return true;
    }
    case 'comment': {
      const selection = view.state.selection.main;
      const raw = view.state.doc.sliceString(selection.from, selection.to);
      view.dispatch({ changes: { from: selection.from, to: selection.to, insert: `<!-- ${raw} -->` } });
      return true;
    }
    default:
      return false;
  }
}
