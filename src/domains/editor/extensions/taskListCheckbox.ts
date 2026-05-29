import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  WidgetType,
  type ViewUpdate,
} from '@codemirror/view';

const TASK_LIST_MARKER_RE = /^(\s*(?:[-+*]|\d+[.)])\s+)\[( |x|X)\](?=\s|$)/;

class TaskListCheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly from: number,
  ) {
    super();
  }

  eq(other: TaskListCheckboxWidget) {
    return other.checked === this.checked && other.from === this.from;
  }

  toDOM(view: EditorView) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.className = 'cm-task-list-checkbox';
    input.setAttribute('aria-label', this.checked ? '标记为未完成' : '标记为完成');

    input.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    input.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleTaskMarker(view, this.from);
    });

    return input;
  }

  ignoreEvent() {
    return false;
  }
}

function toggleTaskMarker(view: EditorView, from: number) {
  const marker = view.state.doc.sliceString(from, from + 3);
  if (!/^\[(?: |x|X)\]$/.test(marker)) return;

  const checked = marker.toLowerCase() === '[x]';
  view.dispatch({
    changes: {
      from,
      to: from + 3,
      insert: checked ? '[ ]' : '[x]',
    },
  });
  view.focus();
}

function buildTaskListCheckboxDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const range of view.visibleRanges) {
    let line = view.state.doc.lineAt(range.from);
    while (line.from <= range.to) {
      const match = line.text.match(TASK_LIST_MARKER_RE);
      if (match) {
        const markerFrom = line.from + match[1].length;
        const markerTo = markerFrom + 3;
        const checked = match[2].toLowerCase() === 'x';
        builder.add(
          markerFrom,
          markerTo,
          Decoration.replace({
            widget: new TaskListCheckboxWidget(checked, markerFrom),
          }),
        );
      }

      if (line.to >= view.state.doc.length) break;
      line = view.state.doc.line(line.number + 1);
    }
  }

  return builder.finish();
}

export const taskListCheckboxPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildTaskListCheckboxDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildTaskListCheckboxDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

export const taskListCheckboxTheme = EditorView.theme({
  '.cm-task-list-checkbox': {
    width: '14px',
    height: '14px',
    margin: '0 2px 0 0',
    verticalAlign: '-2px',
    accentColor: 'var(--accent)',
    cursor: 'pointer',
  },
});

export const taskListCheckboxExtension = [
  taskListCheckboxPlugin,
  taskListCheckboxTheme,
];
