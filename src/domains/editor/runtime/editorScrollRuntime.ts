import { EditorView } from '@codemirror/view';
import { addLineFlash, removeLineFlash } from '../extensions/selection';

export type ScheduleLineFlashClear = (
  callback: () => void,
  delay: number,
) => ReturnType<typeof setTimeout>;

export interface JumpToEditorLineOptions {
  clearDelayMs?: number;
  scheduleClear?: ScheduleLineFlashClear;
}

function getClampedLine(view: EditorView, lineNumber: number) {
  const targetLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines));
  return view.state.doc.line(targetLine);
}

export function jumpToEditorLine(
  view: EditorView,
  lineNumber: number,
  options: JumpToEditorLineOptions = {},
) {
  const line = getClampedLine(view, lineNumber);
  const scheduleClear = options.scheduleClear ?? setTimeout;
  const clearDelayMs = options.clearDelayMs ?? 2000;

  view.dispatch({
    selection: { anchor: line.from },
    effects: [
      EditorView.scrollIntoView(line.from, { y: 'center' }),
      addLineFlash.of(line.from),
    ],
  });

  scheduleClear(() => {
    view.dispatch({
      effects: removeLineFlash.of(line.from),
    });
  }, clearDelayMs);

  view.focus();
  return true;
}

export function setEditorScrollRatio(view: EditorView, ratio: number) {
  const scroller = view.scrollDOM;
  const maxScroll = scroller.scrollHeight - scroller.clientHeight;
  const targetScroll = Math.max(0, ratio) * maxScroll;
  scroller.scrollTop = targetScroll;
  return true;
}

export function scrollEditorToLine(view: EditorView, lineNumber: number) {
  const line = getClampedLine(view, lineNumber);
  view.dispatch({
    effects: EditorView.scrollIntoView(line.from, { y: 'start' }),
  });
  return true;
}
