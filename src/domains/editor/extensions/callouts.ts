export type CalloutKind = 'note' | 'warning' | 'tip' | 'important';

export interface MarkdownCalloutMetadata {
  kind: CalloutKind;
  label: string;
  title: string;
}

const CALLOUT_LABELS: Record<CalloutKind, string> = {
  note: 'Note',
  warning: 'Warning',
  tip: 'Tip',
  important: 'Important',
};

const CALLOUT_MARKER_RE = /^\[!(NOTE|WARNING|TIP|IMPORTANT)\](?:[ \t]+(.+?))?[ \t]*$/i;
const CALLOUT_MARKER_PREFIX_RE = /^\[!(NOTE|WARNING|TIP|IMPORTANT)\](?:[ \t]+([^\n]+?))?[ \t]*(?:\n|$)/i;

export function parseMarkdownCalloutMarker(value: string): MarkdownCalloutMetadata | null {
  const match = value.trim().match(CALLOUT_MARKER_RE);
  if (!match) return null;
  const kind = match[1].toLowerCase() as CalloutKind;
  const label = CALLOUT_LABELS[kind];
  const title = match[2]?.trim() || label;
  return { kind, label, title };
}

function getFirstTextChild(paragraph: any) {
  return (paragraph.children ?? []).find((child: any) => child.type === 'text');
}

function parseMarkdownCalloutPrefix(value: string): {
  metadata: MarkdownCalloutMetadata;
  remainingText: string;
} | null {
  const match = value.match(CALLOUT_MARKER_PREFIX_RE);
  if (!match) return null;
  const kind = match[1].toLowerCase() as CalloutKind;
  const label = CALLOUT_LABELS[kind];
  const title = match[2]?.trim() || label;
  return {
    metadata: { kind, label, title },
    remainingText: value.slice(match[0].length),
  };
}

export function applyCalloutMetadataToMdastBlockquote(node: any): MarkdownCalloutMetadata | null {
  const firstChild = node.children?.[0];
  if (!firstChild || firstChild.type !== 'paragraph') return null;

  const textChild = getFirstTextChild(firstChild);
  if (!textChild || typeof textChild.value !== 'string') return null;

  const parsed = parseMarkdownCalloutPrefix(textChild.value);
  if (!parsed) return null;
  const { metadata, remainingText } = parsed;

  const nextParagraphChildren = remainingText
    ? (firstChild.children ?? []).map((child: any) => (
        child === textChild ? { ...textChild, value: remainingText } : child
      ))
    : (firstChild.children ?? []).filter((child: any) => child !== textChild);
  if (nextParagraphChildren.length === 0) {
    node.children = node.children.slice(1);
  } else {
    firstChild.children = nextParagraphChildren;
  }

  node.data = node.data || {};
  node.data.hProperties = {
    ...(node.data.hProperties ?? {}),
    className: ['prism-callout', `prism-callout--${metadata.kind}`],
    'data-callout-kind': metadata.kind,
    'data-callout-label': metadata.label,
    'data-callout-title': metadata.title,
  };

  return metadata;
}
