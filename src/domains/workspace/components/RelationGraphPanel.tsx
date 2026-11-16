import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildRelationGraph,
  type RelationGraph,
  type RelationGraphDepth,
  type RelationGraphEdge,
  type RelationGraphNode,
  type RelationGraphScope,
} from '../services/relationGraph';
import type { WorkspaceIndex } from '../services/workspaceIndex';
import { normalizePathForCompare } from '../services/path';
import { queryWorkspaceRelationGraphNativeModel } from '../services/workspaceIndexNative';
import { useI18n } from '../../i18n';

interface RelationGraphPanelProps {
  currentPath?: string | null;
  index: WorkspaceIndex | null;
  onClose: () => void;
  onSelect: (path: string) => void;
  visible: boolean;
  workspaceIndexJobId?: string | null;
}

/** 画布坐标系固定，缩放与平移只作用在内部 <g> 上。 */
const VIEW_WIDTH = 828;
const VIEW_HEIGHT = 598;
const PAD = 24;
const NODE_WIDTH = 152;
const NODE_HEIGHT = 42;
const CENTER_WIDTH = 184;
const CENTER_HEIGHT = 66;
const COLUMN_GAP = 76;
const ROW_GAP = 10;
const CLUSTER_CHUNK = 5;
const CLUSTER_MAX_COLUMNS = 6;
const ORDER_STORAGE_KEY = 'prism.relation-graph.order.v1';
const DRAG_THRESHOLD = 5;
const MIN_SCALE = 0.45;
const MAX_SCALE = 2;
const ZOOM_STEP = 1.2;

type ColumnKey = 'in2' | 'in' | 'center' | 'out' | 'out2' | 'rest' | 'group';

interface LayoutColumn {
  key: ColumnKey;
  /** 目录聚类时的分组名（仅 group 列使用）。 */
  group?: string;
  row?: number;
  /** 该目录的文档总数，折行时首列仍显示整组规模。 */
  groupTotal?: number;
  nodes: RelationGraphNode[];
  width: number;
  x: number;
  labelY: number;
}

interface PositionedNode extends RelationGraphNode {
  x: number;
  y: number;
  width: number;
  height: number;
  column: ColumnKey;
  /** 视觉列的稳定标识（同 key 的分组会有多列，拖拽只在本列内生效）。 */
  columnId: string;
}

interface EdgeView extends RelationGraphEdge {
  tone: 'in' | 'out' | 'far';
}

interface GraphLayout {
  columns: LayoutColumn[];
  nodes: PositionedNode[];
  edges: EdgeView[];
  bounds: { x: number; y: number; width: number; height: number };
  anchor: PositionedNode | null;
}

interface ViewTransform {
  scale: number;
  tx: number;
  ty: number;
}

interface DragState {
  id: string;
  columnId: string;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  dropIndex: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** 估算字符宽度：CJK 全宽，其余按 0.56em。避免用测量 API 造成每帧布局读取。 */
function fitLabel(value: string, maxWidth: number, fontSize: number) {
  let used = 0;
  let out = '';
  for (const char of value) {
    const charWidth = /[\u2e80-\u9fff\uff00-\uffef]/.test(char) ? fontSize : fontSize * 0.56;
    if (used + charWidth > maxWidth) {
      return out.length > 1 ? `${out.trimEnd()}…` : out;
    }
    used += charWidth;
    out += char;
  }
  return out;
}

function cleanTitle(title: string) {
  return title.replace(/\.(md|markdown|txt|text|tsx|css)$/i, '');
}

function readStoredOrders(): Record<string, string[]> {
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const orders: Record<string, string[]> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        orders[key] = value.filter((item): item is string => typeof item === 'string');
      }
    });
    return orders;
  } catch {
    return {};
  }
}

function manualOrderIndex(order: string[] | undefined) {
  const index = new Map<string, number>();
  order?.forEach((id, position) => index.set(id, position));
  return index;
}

function groupKeyFor(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, '/');
  const index = normalized.indexOf('/');
  return index > 0 ? normalized.slice(0, index) : '.';
}

function buildAnchorFromIndex(index: WorkspaceIndex | null, path: string | null | undefined): RelationGraphNode | null {
  if (!index || !path) return null;
  const key = normalizePathForCompare(path);
  const document = index.documentByPath.get(key);
  if (!document) return null;
  return {
    active: true,
    backlinkCount: index.backlinksByPath.get(key)?.length ?? 0,
    depth: 0,
    id: key,
    linkCount: document.links.filter((link) => link.resolvedPath).length,
    path: document.path,
    relativePath: document.relativePath,
    title: document.title,
  };
}

function columnWidths(key: ColumnKey) {
  return key === 'center' ? CENTER_WIDTH : NODE_WIDTH;
}

interface ColumnDraft {
  key: ColumnKey;
  group?: string;
  groupTotal?: number;
  /** 聚类视图里允许换行摆放，行号用于把整幅图收成方块。 */
  row?: number;
  nodes: RelationGraphNode[];
}

function sortByBacklinks(a: RelationGraphNode, b: RelationGraphNode) {
  return b.backlinkCount - a.backlinkCount || a.relativePath.localeCompare(b.relativePath);
}

function layoutFocus(
  nodes: RelationGraphNode[],
  edges: RelationGraphEdge[],
  anchorId: string,
  order?: string[],
): GraphLayout {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const anchor = byId.get(anchorId) ?? null;
  const incoming: RelationGraphNode[] = [];
  const outgoing: RelationGraphNode[] = [];
  const sideByNode = new Map<string, 'in' | 'out'>();
  const parentByNode = new Map<string, string>();

  // 两遍分类：双向引用的文档固定落在「被引用」一侧，避免排序随边顺序漂移。
  edges.forEach((edge) => {
    if (edge.target !== anchorId || edge.source === anchorId) return;
    const node = byId.get(edge.source);
    if (!node || sideByNode.has(node.id)) return;
    sideByNode.set(node.id, 'in');
    incoming.push(node);
  });
  edges.forEach((edge) => {
    if (edge.source !== anchorId || edge.target === anchorId) return;
    const node = byId.get(edge.target);
    if (!node || sideByNode.has(node.id)) return;
    sideByNode.set(node.id, 'out');
    outgoing.push(node);
  });

  incoming.sort(sortByBacklinks);
  outgoing.sort(sortByBacklinks);

  const firstHopOrder = new Map<string, number>();
  [...incoming, ...outgoing].forEach((node, index) => firstHopOrder.set(node.id, index));

  const farIn: RelationGraphNode[] = [];
  const farOut: RelationGraphNode[] = [];
  const rest: RelationGraphNode[] = [];

  nodes.forEach((node) => {
    if (node.id === anchorId || firstHopOrder.has(node.id)) return;
    // 第二层按它所连的一层节点归边，天然落在同一侧，减少交叉。
    const parentEdge = edges.find((edge) => (
      (edge.source === node.id && firstHopOrder.has(edge.target))
      || (edge.target === node.id && firstHopOrder.has(edge.source))
    ));
    if (parentEdge) {
      const parentId = parentEdge.source === node.id ? parentEdge.target : parentEdge.source;
      parentByNode.set(node.id, parentId);
      (sideByNode.get(parentId) === 'out' ? farOut : farIn).push(node);
      return;
    }
    rest.push(node);
  });

  const parentOrder = (node: RelationGraphNode) => (
    firstHopOrder.get(parentByNode.get(node.id) ?? '') ?? Number.MAX_SAFE_INTEGER
  );
  const farOrder = (a: RelationGraphNode, b: RelationGraphNode) => parentOrder(a) - parentOrder(b) || sortByBacklinks(a, b);
  farIn.sort(farOrder);
  farOut.sort(farOrder);

  // 用户拖过的列按手写顺序排，其余保持启发式顺序。
  const manual = manualOrderIndex(order);
  const applyManual = (list: RelationGraphNode[]) => [...list].sort((a, b) => (
    (manual.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (manual.get(b.id) ?? Number.MAX_SAFE_INTEGER)
  ));

  const drafts: ColumnDraft[] = [
    { key: 'in2', nodes: applyManual(farIn) },
    { key: 'in', nodes: applyManual(incoming) },
    { key: 'center', nodes: anchor ? [anchor] : [] },
    { key: 'out', nodes: applyManual(outgoing) },
    { key: 'out2', nodes: applyManual(farOut) },
    { key: 'rest', nodes: applyManual(rest) },
  ];

  return assembleLayout(drafts.filter((draft) => draft.nodes.length > 0), edges, anchorId);
}

function layoutClusters(
  nodes: RelationGraphNode[],
  edges: RelationGraphEdge[],
  anchorId: string | null,
  order?: string[],
  focusId?: string | null,
): GraphLayout {
  const groups = new Map<string, RelationGraphNode[]>();
  const groupOf = new Map<string, string>();
  nodes.forEach((node) => {
    const key = groupKeyFor(node.relativePath);
    const list = groups.get(key) ?? [];
    list.push(node);
    groups.set(key, list);
    groupOf.set(node.id, key);
  });

  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const groupLinks = new Map<string, number>();
  edges.forEach((edge) => {
    const source = groupOf.get(edge.source);
    const target = groupOf.get(edge.target);
    if (!source || !target || source === target) return;
    const key = pairKey(source, target);
    groupLinks.set(key, (groupLinks.get(key) ?? 0) + 1);
  });

  // 目录顺序：从当前文档所在目录出发，沿最强的跨目录连线往下走。
  const sizeOf = (key: string) => groups.get(key)?.length ?? 0;
  const remaining = new Set(groups.keys());
  const orderedKeys: string[] = [];
  let cursor = (focusId ? groupOf.get(focusId) : undefined)
    ?? (anchorId ? groupOf.get(anchorId) : undefined)
    ?? [...remaining].sort((a, b) => sizeOf(b) - sizeOf(a) || a.localeCompare(b))[0];
  while (cursor) {
    orderedKeys.push(cursor);
    remaining.delete(cursor);
    let next = '';
    let bestScore = -1;
    remaining.forEach((key) => {
      const score = groupLinks.get(pairKey(cursor as string, key)) ?? 0;
      if (score > bestScore || (score === bestScore && sizeOf(key) > sizeOf(next))) {
        bestScore = score;
        next = key;
      }
    });
    cursor = next;
  }

  // 列内顺序：邻居重心（两轮）+ 手写顺序优先，减少跨目录连线的交叉。
  const manual = manualOrderIndex(order);
  const lists = new Map<string, RelationGraphNode[]>(
    orderedKeys.map((key) => [key, [...(groups.get(key) ?? [])]]),
  );
  const position = new Map<string, number>();
  const assignPositions = () => {
    let cursorIndex = 0;
    orderedKeys.forEach((key) => {
      (lists.get(key) ?? []).forEach((node) => {
        position.set(node.id, cursorIndex);
        cursorIndex += 1;
      });
    });
  };
  const sortList = (list: RelationGraphNode[], score: (node: RelationGraphNode) => number) => (
    [...list].sort((a, b) => {
      const manualDiff = (manual.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (manual.get(b.id) ?? Number.MAX_SAFE_INTEGER);
      if (manualDiff !== 0) return manualDiff;
      return score(a) - score(b) || sortByBacklinks(a, b);
    })
  );

  orderedKeys.forEach((key) => {
    lists.set(key, sortList(lists.get(key) ?? [], (node) => position.get(node.id) ?? 0));
  });
  assignPositions();

  for (let pass = 0; pass < 2; pass += 1) {
    const neighbours = new Map<string, { total: number; count: number }>();
    edges.forEach((edge) => {
      const sourcePosition = position.get(edge.source);
      const targetPosition = position.get(edge.target);
      if (sourcePosition === undefined || targetPosition === undefined) return;
      const source = neighbours.get(edge.source) ?? { total: 0, count: 0 };
      source.total += targetPosition;
      source.count += 1;
      neighbours.set(edge.source, source);
      const target = neighbours.get(edge.target) ?? { total: 0, count: 0 };
      target.total += sourcePosition;
      target.count += 1;
      neighbours.set(edge.target, target);
    });
    const barycenter = (node: RelationGraphNode) => {
      const entry = neighbours.get(node.id);
      return entry && entry.count > 0 ? entry.total / entry.count : (position.get(node.id) ?? 0);
    };
    orderedKeys.forEach((key) => {
      lists.set(key, sortList(lists.get(key) ?? [], barycenter));
    });
    assignPositions();
  }

  const drafts: ColumnDraft[] = [];
  orderedKeys.forEach((key) => {
    const sorted = lists.get(key) ?? [];
    // 单个目录过长时折成多列并尽量均分，避免出现只剩一张卡的孤儿列。
    const columnCount = Math.max(1, Math.ceil(sorted.length / CLUSTER_CHUNK));
    const chunkSize = Math.ceil(sorted.length / columnCount);
    for (let index = 0; index < sorted.length; index += chunkSize) {
      drafts.push({
        key: 'group',
        group: index === 0 ? key : '',
        groupTotal: sorted.length,
        row: Math.floor(drafts.length / CLUSTER_MAX_COLUMNS),
        nodes: sorted.slice(index, index + chunkSize),
      });
    }
  });

  return assembleLayout(drafts, edges, anchorId);
}

function assembleLayout(
  drafts: ColumnDraft[],
  edges: RelationGraphEdge[],
  anchorId: string | null,
): GraphLayout {
  const columns: LayoutColumn[] = [];
  const rows = new Map<number, LayoutColumn[]>();

  drafts.forEach((draft) => {
    const row = draft.row ?? 0;
    const rowColumns = rows.get(row) ?? [];
    const width = columnWidths(draft.key);
    const x = PAD + rowColumns.reduce((offset, column) => offset + column.width + COLUMN_GAP, 0);
    const column: LayoutColumn = { ...draft, row, width, x, labelY: PAD };
    rowColumns.push(column);
    rows.set(row, rowColumns);
    columns.push(column);
  });

  const columnHeightOf = (column: LayoutColumn) => {
    const isCenter = column.key === 'center';
    const height = isCenter ? CENTER_HEIGHT : NODE_HEIGHT;
    return column.nodes.length * height + Math.max(0, column.nodes.length - 1) * ROW_GAP;
  };
  const rowKeys = [...rows.keys()].sort((a, b) => a - b);
  const rowHeights = rowKeys.map((key) => (rows.get(key) ?? []).reduce(
    (height, column) => Math.max(height, columnHeightOf(column)),
    0,
  ));
  const rowGap = ROW_GAP * 6;
  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, rowKeys.length - 1) * rowGap;
  let rowTop = Math.max(PAD, (VIEW_HEIGHT - totalHeight) / 2);

  const positioned: PositionedNode[] = [];
  rowKeys.forEach((key, rowIndex) => {
    const rowHeight = rowHeights[rowIndex];
    (rows.get(key) ?? []).forEach((column) => {
      const isCenter = column.key === 'center';
      const height = isCenter ? CENTER_HEIGHT : NODE_HEIGHT;
      const stackHeight = columnHeightOf(column);
      const startY = rowTop + (rowHeight - stackHeight) / 2;
      column.nodes.forEach((node, index) => {
        positioned.push({
          ...node,
          x: column.x,
          y: startY + index * (height + ROW_GAP),
          width: column.width,
          height,
          column: column.key,
          columnId: `${column.key}#${Math.round(column.x)}#${Math.round(startY)}`,
        });
      });
    });
    rowTop += rowHeight + rowGap;
  });

  columns.forEach((column) => {
    const top = positioned
      .filter((node) => node.columnId.startsWith(`${column.key}#${Math.round(column.x)}#`))
      .reduce((min, node) => Math.min(min, node.y), VIEW_HEIGHT);
    column.labelY = Math.max(14, top - 9);
  });

  const positionById = new Map(positioned.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const viewEdges: EdgeView[] = [];
  edges.forEach((edge) => {
    const source = positionById.get(edge.source);
    const target = positionById.get(edge.target);
    if (!source || !target || source.id === target.id || seen.has(edge.id)) return;
    seen.add(edge.id);
    const tone: EdgeView['tone'] = !anchorId || (source.id !== anchorId && target.id !== anchorId)
      ? 'far'
      : source.id === anchorId
        ? 'out'
        : 'in';
    viewEdges.push({ ...edge, tone });
  });

  const bounds = positioned.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.x),
      minY: Math.min(acc.minY, node.y),
      maxX: Math.max(acc.maxX, node.x + node.width),
      maxY: Math.max(acc.maxY, node.y + node.height),
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: 0, maxY: 0 },
  );
  const empty = bounds.minX === Number.POSITIVE_INFINITY;

  return {
    columns,
    nodes: positioned,
    edges: viewEdges,
    bounds: {
      x: empty ? 0 : bounds.minX,
      y: empty ? 0 : bounds.minY,
      width: empty ? 0 : bounds.maxX - bounds.minX,
      height: empty ? 0 : bounds.maxY - bounds.minY,
    },
    anchor: positioned.find((node) => node.id === anchorId) ?? null,
  };
}

export function RelationGraphPanel({
  currentPath,
  index,
  onClose,
  onSelect,
  visible,
  workspaceIndexJobId = null,
}: RelationGraphPanelProps) {
  const { t } = useI18n();
  const [scope, setScope] = useState<RelationGraphScope>('current');
  const [depth, setDepth] = useState<RelationGraphDepth>(1);
  const [query, setQuery] = useState('');
  const [nativeGraph, setNativeGraph] = useState<{ graph: RelationGraph; key: string } | null>(null);
  const [localActivePath, setLocalActivePath] = useState<string | null>(currentPath || null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [view, setView] = useState<ViewTransform>({ scale: 1, tx: 0, ty: 0 });
  const [copied, setCopied] = useState(false);
  const [manualOrders, setManualOrders] = useState<Record<string, string[]>>(() => readStoredOrders());
  const [drag, setDrag] = useState<DragState | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewRef = useRef(view);
  const nativeGraphRequestRef = useRef(0);
  const clickTimerRef = useRef<number | null>(null);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; tx: number; ty: number } | null>(null);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const draggedRef = useRef(false);
  const layoutRef = useRef<GraphLayout | null>(null);
  const orderKeyRef = useRef('');

  viewRef.current = view;

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, visible]);

  useEffect(() => {
    if (visible) {
      setLocalActivePath(currentPath || null);
      setScope(currentPath ? 'current' : 'workspace');
      setDepth(1);
      setQuery('');
      setHoveredNodeId(null);
      setFocusedNodeId(null);
    }
  }, [currentPath, visible]);

  useEffect(() => () => {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
  }, []);

  const graphQueryKey = [
    workspaceIndexJobId ?? '',
    localActivePath ?? '',
    scope,
    depth,
    query,
  ].join('\n');

  const fallbackGraph = useMemo(() => {
    if (!index) return { nodes: [], edges: [] };
    return buildRelationGraph({
      index,
      currentPath: localActivePath,
      scope,
      depth,
      query,
    });
  }, [localActivePath, depth, index, query, scope]);
  const graph = nativeGraph?.key === graphQueryKey ? nativeGraph.graph : fallbackGraph;

  useEffect(() => {
    if (!visible || !workspaceIndexJobId) {
      setNativeGraph(null);
      return undefined;
    }

    let cancelled = false;
    const requestId = nativeGraphRequestRef.current + 1;
    nativeGraphRequestRef.current = requestId;

    const run = async () => {
      try {
        const result = await queryWorkspaceRelationGraphNativeModel({
          jobId: workspaceIndexJobId,
          currentPath: localActivePath,
          scope,
          depth,
          query,
          limit: 80,
        });
        if (cancelled || nativeGraphRequestRef.current !== requestId) return;
        setNativeGraph(result ? { graph: result, key: graphQueryKey } : null);
      } catch (error) {
        if (!cancelled && nativeGraphRequestRef.current === requestId) {
          console.warn('[RelationGraphPanel] Native relation graph query unavailable, using TypeScript fallback:', error);
          setNativeGraph(null);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    depth,
    graphQueryKey,
    localActivePath,
    query,
    scope,
    visible,
    workspaceIndexJobId,
  ]);

  // 搜索只过滤周边，中心永远是当前文档：否则搜一下就“没有图谱”了。
  const anchorNode = useMemo(() => {
    const fromGraph = graph.nodes.find((node) => node.active);
    if (fromGraph) return fromGraph;
    const fromIndex = buildAnchorFromIndex(index, localActivePath);
    if (!fromIndex) return null;
    return fromIndex;
  }, [graph.nodes, index, localActivePath]);

  const graphNodes = useMemo(() => {
    if (!anchorNode || scope !== 'current') return graph.nodes;
    return graph.nodes.some((node) => node.id === anchorNode.id)
      ? graph.nodes
      : [anchorNode, ...graph.nodes];
  }, [anchorNode, graph.nodes, scope]);

  // 搜索会把不匹配的文档过滤掉，但中心文档与命中结果之间的连边仍然存在。
  const graphEdges = useMemo(() => {
    if (!anchorNode || scope !== 'current' || graph.nodes.some((node) => node.id === anchorNode.id)) {
      return graph.edges;
    }
    const visible = new Set(graphNodes.map((node) => node.id));
    const edges: RelationGraphEdge[] = [];
    const seen = new Set<string>();
    const push = (source: string, target: string) => {
      const id = `${source}->${target}`;
      if (seen.has(id) || !visible.has(source) || !visible.has(target)) return;
      seen.add(id);
      edges.push({ id, source, target });
    };
    const document = index?.documentByPath.get(anchorNode.id);
    document?.links.forEach((link) => {
      if (link.resolvedPath) push(anchorNode.id, normalizePathForCompare(link.resolvedPath));
    });
    index?.backlinksByPath.get(anchorNode.id)?.forEach((backlink) => {
      push(normalizePathForCompare(backlink.path), anchorNode.id);
    });
    return edges;
  }, [anchorNode, graph.edges, graph.nodes, graphNodes, index, scope]);

  const anchorId = scope === 'current' && anchorNode ? anchorNode.id : null;
  const orderKey = anchorId ? `current:${anchorId}` : 'workspace';
  const manualOrder = manualOrders[orderKey];
  const layout = useMemo(
    () => (anchorId
      ? layoutFocus(graphNodes, graphEdges, anchorId, manualOrder)
      : layoutClusters(graphNodes, graphEdges, anchorId, manualOrder, anchorNode?.id ?? null)),
    [anchorId, anchorNode, graphEdges, graphNodes, manualOrder],
  );

  layoutRef.current = layout;
  orderKeyRef.current = orderKey;

  useEffect(() => {
    try {
      window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(manualOrders));
    } catch {
      // 存储不可用时保持内存顺序即可，不影响使用。
    }
  }, [manualOrders]);

  const commitColumnOrder = useCallback((key: string, columnIds: string[], orderedIds: string[]) => {
    setManualOrders((current) => {
      const columnSet = new Set(columnIds);
      const kept = (current[key] ?? []).filter((id) => !columnSet.has(id));
      return { ...current, [key]: [...kept, ...orderedIds] };
    });
  }, []);

  const applyFit = useCallback((minScale: number) => {
    const { bounds, anchor } = layout;
    if (!bounds.width || !bounds.height) {
      setView({ scale: 1, tx: 0, ty: 0 });
      return;
    }
    const fit = Math.min(
      (VIEW_WIDTH - PAD * 2) / bounds.width,
      (VIEW_HEIGHT - PAD * 2) / bounds.height,
    );
    const scale = clamp(fit, minScale, 1);
    const scaledWidth = bounds.width * scale;
    const scaledHeight = bounds.height * scale;
    const anchorCenterX = anchor ? anchor.x + anchor.width / 2 : bounds.x + bounds.width / 2;
    const tx = scaledWidth > VIEW_WIDTH - PAD * 2
      ? VIEW_WIDTH / 2 - anchorCenterX * scale
      : (VIEW_WIDTH - scaledWidth) / 2 - bounds.x * scale;
    const ty = (VIEW_HEIGHT - scaledHeight) / 2 - bounds.y * scale;
    setView({ scale, tx, ty });
  }, [layout]);

  const layoutKey = useMemo(
    () => layout.nodes.map((node) => `${node.id}:${node.x}:${node.y}`).join('|'),
    [layout.nodes],
  );

  useEffect(() => {
    if (!visible) return;
    applyFit(layout.columns.some((column) => column.key === 'group') ? 0.6 : 0.8);
    // 只在节点集合或位置变化时复位视图，hover / 缩放不打断用户。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, visible]);

  const zoomBy = useCallback((factor: number, originX?: number, originY?: number) => {
    setView((current) => {
      const scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      if (scale === current.scale) return current;
      const vx = originX ?? VIEW_WIDTH / 2;
      const vy = originY ?? VIEW_HEIGHT / 2;
      const ratio = scale / current.scale;
      return {
        scale,
        tx: vx - (vx - current.tx) * ratio,
        ty: vy - (vy - current.ty) * ratio,
      };
    });
  }, []);

  const toViewPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(rect.width, 1)) * VIEW_WIDTH,
      y: ((clientY - rect.top) / Math.max(rect.height, 1)) * VIEW_HEIGHT,
    };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!visible || !svg) return undefined;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = toViewPoint(event.clientX, event.clientY);
      zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, point.x, point.y);
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [toViewPoint, visible, zoomBy]);

  const handlePanStart = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      tx: view.tx,
      ty: view.ty,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePanMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const pan = panRef.current;
    const svg = svgRef.current;
    if (!pan || !svg || pan.pointerId !== event.pointerId) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = VIEW_WIDTH / Math.max(rect.width, 1);
    const scaleY = VIEW_HEIGHT / Math.max(rect.height, 1);
    setView((current) => ({
      ...current,
      tx: pan.tx + (event.clientX - pan.startX) * scaleX,
      ty: pan.ty + (event.clientY - pan.startY) * scaleY,
    }));
  };

  const handlePanEnd = (event: React.PointerEvent<SVGSVGElement>) => {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const focusNode = useCallback((nodeId: string) => {
    setFocusedNodeId(nodeId);
    const element = svgRef.current?.querySelector<SVGGElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
    element?.focus();
  }, []);

  const handleNodePointerDown = (event: React.PointerEvent<SVGGElement>, node: PositionedNode) => {
    if (event.button !== 0) return;
    // 拖节点不能同时触发画布平移。
    event.stopPropagation();
    const point = toViewPoint(event.clientX, event.clientY);
    dragRef.current = {
      id: node.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: (point.x - viewRef.current.tx) / viewRef.current.scale - node.x,
      offsetY: (point.y - viewRef.current.ty) / viewRef.current.scale - node.y,
      moved: false,
    };
  };

  useEffect(() => {
    if (!visible) return undefined;

    const dropIndexFor = (columnId: string, draggedId: string, layoutY: number) => {
      const others = (layoutRef.current?.nodes ?? [])
        .filter((node) => node.columnId === columnId && node.id !== draggedId)
        .sort((a, b) => a.y - b.y);
      return others.reduce((index, node) => (layoutY > node.y + node.height / 2 ? index + 1 : index), 0);
    };

    const handleMove = (event: PointerEvent) => {
      const candidate = dragRef.current;
      if (!candidate || event.pointerId !== candidate.pointerId) return;
      if (!candidate.moved) {
        const distance = Math.hypot(event.clientX - candidate.startX, event.clientY - candidate.startY);
        if (distance < DRAG_THRESHOLD) return;
        candidate.moved = true;
        draggedRef.current = true;
      }
      const node = layoutRef.current?.nodes.find((item) => item.id === candidate.id);
      if (!node) return;
      const point = toViewPoint(event.clientX, event.clientY);
      const layoutX = (point.x - viewRef.current.tx) / viewRef.current.scale;
      const layoutY = (point.y - viewRef.current.ty) / viewRef.current.scale;
      const dropIndex = dropIndexFor(node.columnId, node.id, layoutY);
      setDrag({
        id: node.id,
        columnId: node.columnId,
        x: layoutX,
        y: layoutY,
        offsetX: candidate.offsetX,
        offsetY: candidate.offsetY,
        dropIndex,
      });
    };

    const handleUp = (event: PointerEvent) => {
      const candidate = dragRef.current;
      if (!candidate || event.pointerId !== candidate.pointerId) return;
      dragRef.current = null;
      if (!candidate.moved) return;
      const node = layoutRef.current?.nodes.find((item) => item.id === candidate.id);
      setDrag(null);
      if (!node) return;
      const point = toViewPoint(event.clientX, event.clientY);
      const layoutY = (point.y - viewRef.current.ty) / viewRef.current.scale;
      const columnIds = (layoutRef.current?.nodes ?? [])
        .filter((item) => item.columnId === node.columnId)
        .sort((a, b) => a.y - b.y)
        .map((item) => item.id);
      const dropIndex = dropIndexFor(node.columnId, node.id, layoutY);
      const orderedIds = columnIds.filter((id) => id !== node.id);
      orderedIds.splice(clamp(dropIndex, 0, orderedIds.length), 0, node.id);
      commitColumnOrder(orderKeyRef.current, columnIds, orderedIds);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [commitColumnOrder, toViewPoint, visible]);

  const handleNodeClick = (node: RelationGraphNode) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      setLocalActivePath(node.path);
      setScope('current');
      setQuery('');
    }, 180);
  };

  const handleNodeOpen = (node: RelationGraphNode) => {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    onSelect(node.path);
  };

  const orderedIds = useMemo(() => layout.nodes.map((node) => node.id), [layout.nodes]);

  const handleNodeKeyDown = (event: React.KeyboardEvent<SVGGElement>, node: PositionedNode) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNodeOpen(node);
      return;
    }
    if ((event.altKey || event.metaKey) && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      // 键盘等价操作：在同列内上移 / 下移，写回与拖拽相同的顺序。
      event.preventDefault();
      const columnIds = layout.nodes
        .filter((item) => item.columnId === node.columnId)
        .sort((a, b) => a.y - b.y)
        .map((item) => item.id);
      const currentIndex = columnIds.indexOf(node.id);
      const targetIndex = currentIndex + (event.key === 'ArrowUp' ? -1 : 1);
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= columnIds.length) return;
      const reordered = [...columnIds];
      reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, node.id);
      commitColumnOrder(orderKey, columnIds, reordered);
      window.requestAnimationFrame(() => focusNode(node.id));
      return;
    }
    const index = orderedIds.indexOf(node.id);
    if (index < 0) return;
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index - 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = orderedIds.length - 1;
    if (next >= 0 && next < orderedIds.length) {
      event.preventDefault();
      focusNode(orderedIds[next]);
    }
  };

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard?.writeText(path);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const nodeById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes],
  );

  // 同一节点上的多条边错开锚点，避免一堆线挤在卡片中的同一个点上。
  const edgeFan = useMemo(() => {
    const byNode = new Map<string, RelationGraphEdge[]>();
    layout.edges.forEach((edge) => {
      for (const id of [edge.source, edge.target]) {
        const list = byNode.get(id) ?? [];
        list.push(edge);
        byNode.set(id, list);
      }
    });
    const offsets = new Map<string, { source: number; target: number }>();
    byNode.forEach((edges, nodeId) => {
      if (edges.length < 2) return;
      const step = Math.min(8, 40 / (edges.length - 1));
      edges.forEach((edge, index) => {
        const offset = (index - (edges.length - 1) / 2) * step;
        const entry = offsets.get(edge.id) ?? { source: 0, target: 0 };
        if (edge.source === nodeId) entry.source = offset;
        if (edge.target === nodeId) entry.target = offset;
        offsets.set(edge.id, entry);
      });
    });
    return offsets;
  }, [layout.edges]);

  const hoveredNeighbors = useMemo(() => {
    const active = hoveredNodeId ?? focusedNodeId;
    if (!active) return new Set<string>();
    const set = new Set<string>([active]);
    layout.edges.forEach((edge) => {
      if (edge.source === active) set.add(edge.target);
      if (edge.target === active) set.add(edge.source);
    });
    return set;
  }, [focusedNodeId, hoveredNodeId, layout.edges]);

  const railNode = anchorNode;

  const railLinks = useMemo(() => {
    const empty = { outgoing: [], incoming: [] } as {
      outgoing: { path: string; relativePath: string; title: string }[];
      incoming: { path: string; relativePath: string; title: string }[];
    };
    if (!railNode) return empty;
    const entryFor = (path: string, fallbackTitle?: string) => {
      const document = index?.documentByPath.get(normalizePathForCompare(path));
      return {
        path: document?.path ?? path,
        relativePath: document?.relativePath ?? path,
        title: document?.title ?? fallbackTitle ?? path.split('/').pop() ?? path,
      };
    };
    const document = index?.documentByPath.get(railNode.id);
    if (!document) {
      return {
        outgoing: layout.edges
          .filter((edge) => edge.source === railNode.id)
          .map((edge) => nodeById.get(edge.target))
          .filter((node): node is PositionedNode => Boolean(node))
          .map((node) => ({ path: node.path, relativePath: node.relativePath, title: node.title })),
        incoming: layout.edges
          .filter((edge) => edge.target === railNode.id)
          .map((edge) => nodeById.get(edge.source))
          .filter((node): node is PositionedNode => Boolean(node))
          .map((node) => ({ path: node.path, relativePath: node.relativePath, title: node.title })),
      };
    }
    const seen = new Set<string>();
    const outgoing = document.links
      .filter((link) => link.resolvedPath)
      .map((link) => entryFor(link.resolvedPath as string, link.label))
      .filter((entry) => {
        const key = normalizePathForCompare(entry.path);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const incoming = (index?.backlinksByPath.get(railNode.id) ?? []).map((backlink) => entryFor(backlink.path, backlink.title));
    return { outgoing, incoming };
  }, [index, layout.edges, nodeById, railNode]);

  const columnLabel = (column: LayoutColumn) => {
    if (column.key === 'in') return `${t('workspace.relation.linkedFrom')} · ${column.nodes.length}`;
    if (column.key === 'out') return `${t('workspace.relation.linkedTo')} · ${column.nodes.length}`;
    if (column.key === 'in2' || column.key === 'out2') return t('workspace.relation.secondHop');
    if (column.key === 'rest') return t('workspace.relation.unrelated');
    if (column.key === 'center') return t('workspace.relation.currentDocument');
    if (!column.group) return '';
    return `${column.group === '.' ? t('workspace.relation.rootGroup') : column.group} · ${column.groupTotal ?? column.nodes.length}`;
  };

  const truncated = typeof graph.total === 'number' && graph.total > layout.nodes.length;
  const isEmpty = layout.nodes.length === 0;
  const isIsland = layout.nodes.length <= 1 && layout.edges.length === 0;

  if (!visible) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal prism-relation-graph-modal" role="dialog" aria-label={t('workspace.relation.title')}>
        <div className="modal-header prism-relation-graph-header">
          <div className="prism-relation-graph-heading">
            <h2 className="modal-title">{t('workspace.relation.title')}</h2>
            <p className="prism-relation-graph-meta">
              {railNode
                ? `${cleanTitle(railNode.title)} · ${t('workspace.relation.metaCounts', {
                  nodes: String(layout.nodes.length),
                  edges: String(layout.edges.length),
                })}`
                : t('workspace.relation.metaEmpty')}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>

        <div className="modal-body prism-relation-graph-body">
          <div className="prism-relation-graph-toolbar">
            <div className="prism-relation-graph-segment" role="group" aria-label={t('workspace.relation.scopeAria')}>
              <button type="button" data-active={scope === 'current' ? 'true' : undefined} onClick={() => setScope('current')}>
                {t('workspace.relation.currentDocument')}
              </button>
              <button type="button" data-active={scope === 'workspace' ? 'true' : undefined} onClick={() => setScope('workspace')}>
                {t('workspace.relation.workspace')}
              </button>
            </div>
            <div className="prism-relation-graph-segment" role="group" aria-label={t('workspace.relation.depthAria')}>
              <button type="button" data-active={depth === 1 ? 'true' : undefined} onClick={() => setDepth(1)}>
                {t('workspace.relation.direct')}
              </button>
              <button type="button" data-active={depth === 2 ? 'true' : undefined} onClick={() => setDepth(2)}>
                {t('workspace.relation.extended')}
              </button>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('workspace.relation.searchPlaceholder')}
              aria-label={t('workspace.relation.searchAria')}
            />
            <div className="prism-relation-graph-zoom" role="group" aria-label={t('workspace.relation.zoomAria')}>
              <button type="button" onClick={() => applyFit(MIN_SCALE)} aria-label={t('workspace.relation.fitView')}>⤢</button>
              <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label={t('workspace.relation.zoomOut')}>−</button>
              <span aria-live="polite">{Math.round(view.scale * 100)}%</span>
              <button type="button" onClick={() => zoomBy(ZOOM_STEP)} aria-label={t('workspace.relation.zoomIn')}>+</button>
            </div>
          </div>

          <div className="prism-relation-graph-content">
            <div className="prism-relation-graph-canvas">
              {isEmpty || isIsland ? (
                <div className="prism-relation-graph-empty">
                  <h3>
                    {!localActivePath
                      ? t('workspace.relation.noDocumentTitle')
                      : query
                        ? t('workspace.relation.noMatchTitle')
                        : t('workspace.relation.emptyTitle')}
                  </h3>
                  <p>
                    {!localActivePath
                      ? t('workspace.relation.noDocumentBody')
                      : query
                        ? t('workspace.relation.noMatchBody', { query })
                        : t('workspace.relation.emptyBody')}
                  </p>
                  {localActivePath && !query ? (
                    <div className="prism-relation-graph-empty-actions">
                      {scope === 'current' ? (
                        <button type="button" className="prism-relation-graph-primary" onClick={() => setScope('workspace')}>
                          {t('workspace.relation.emptyAction')}
                        </button>
                      ) : null}
                      <span className="prism-relation-graph-kbd">[[</span>
                      <span className="prism-relation-graph-kbd">⌘K</span>
                      <span className="prism-relation-graph-empty-hint">{t('workspace.relation.emptyHint')}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <svg
                  ref={svgRef}
                  className={hoveredNodeId || focusedNodeId ? 'has-focus' : ''}
                  viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                  role="img"
                  aria-label={t('workspace.relation.imageAria')}
                  onPointerDown={handlePanStart}
                  onPointerMove={handlePanMove}
                  onPointerUp={handlePanEnd}
                  onPointerCancel={handlePanEnd}
                >
                  <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
                    {layout.columns.map((column) => (
                      columnLabel(column) ? (
                        <text
                          key={`label-${column.key}-${column.group ?? ''}-${column.x}`}
                          className="prism-relation-graph-column-label"
                          x={column.x}
                          y={column.labelY}
                        >
                          {columnLabel(column)}
                        </text>
                      ) : null
                    ))}
                    {layout.edges.map((edge) => {
                      const source = nodeById.get(edge.source);
                      const target = nodeById.get(edge.target);
                      if (!source || !target) return null;
                      const isActive = hoveredNodeId || focusedNodeId
                        ? hoveredNeighbors.has(edge.source) && hoveredNeighbors.has(edge.target)
                        : true;
                      const fan = edgeFan.get(edge.id);
                      const y1 = source.y + source.height / 2 + (fan?.source ?? 0);
                      const y2 = target.y + target.height / 2 + (fan?.target ?? 0);
                      let d: string;
                      let arrow: string;
                      if (Math.abs(source.x - target.x) < 1) {
                        // 同列互链：在列间空隙里兜一个括号，避免线压在卡片上。
                        const bowRight = source.column !== 'out' && source.column !== 'out2';
                        const x = bowRight ? source.x + source.width : source.x;
                        const bow = x + (bowRight ? 34 : -34);
                        d = `M${x},${y1} C${bow},${y1} ${bow},${y2} ${x},${y2}`;
                        arrow = bowRight
                          ? `${x},${y2} ${x + 7},${y2 - 4} ${x + 7},${y2 + 4}`
                          : `${x},${y2} ${x - 7},${y2 - 4} ${x - 7},${y2 + 4}`;
                      } else {
                        const forward = target.x > source.x;
                        const x1 = forward ? source.x + source.width : source.x;
                        const x2 = forward ? target.x : target.x + target.width;
                        const curve = Math.max(28, Math.abs(x2 - x1) * 0.45) * (forward ? 1 : -1);
                        d = `M${x1},${y1} C${x1 + curve},${y1} ${x2 - curve},${y2} ${x2},${y2}`;
                        arrow = forward
                          ? `${x2},${y2} ${x2 - 7},${y2 - 4} ${x2 - 7},${y2 + 4}`
                          : `${x2},${y2} ${x2 + 7},${y2 - 4} ${x2 + 7},${y2 + 4}`;
                      }
                      const touchesDrag = Boolean(drag && (edge.source === drag.id || edge.target === drag.id));
                      return (
                        <g
                          key={edge.id}
                          className={`prism-relation-graph-edge prism-relation-graph-edge-${edge.tone}${isActive ? ' is-connected' : ' is-muted'}${touchesDrag ? ' is-dragging-edge' : ''}`}
                          data-tone={edge.tone}
                        >
                          <path d={d} />
                          <polygon points={arrow} className="prism-relation-graph-arrow" />
                        </g>
                      );
                    })}
                    {layout.nodes.map((node) => {
                      const isHovered = hoveredNodeId === node.id;
                      const isFocused = focusedNodeId === node.id;
                      const isNeighbor = hoveredNeighbors.has(node.id);
                      const isDimmed = !drag && Boolean(hoveredNodeId || focusedNodeId) && !isNeighbor;
                      const isCenter = node.column === 'center';
                      const isDragging = drag?.id === node.id;
                      const titleText = fitLabel(cleanTitle(node.title), node.width - 34, isCenter ? 13 : 12);
                      const translateX = isDragging ? drag.x - drag.offsetX : node.x;
                      const gapShift = drag && drag.id !== node.id && drag.columnId === node.columnId
                        ? (() => {
                          const siblings = layout.nodes
                            .filter((item) => item.columnId === node.columnId)
                            .sort((a, b) => a.y - b.y);
                          const index = siblings.findIndex((item) => item.id === node.id);
                          return index >= drag.dropIndex ? node.height + ROW_GAP : 0;
                        })()
                        : 0;
                      const translateY = isDragging ? drag.y - drag.offsetY : node.y + gapShift;
                      return (
                        <g
                          key={node.id}
                          data-node-id={node.id}
                          className={[
                            'prism-relation-graph-node',
                            isCenter ? 'is-active' : '',
                            isHovered ? 'is-hovered' : '',
                            isFocused ? 'is-focused' : '',
                            isNeighbor && !isCenter ? 'is-adjacent' : '',
                            isDimmed ? 'is-dimmed' : '',
                            node.column === 'in2' || node.column === 'out2' ? 'is-far' : '',
                            isDragging ? 'is-dragging' : '',
                          ].filter(Boolean).join(' ')}
                          transform={`translate(${translateX} ${translateY})`}
                          tabIndex={0}
                          role="button"
                          aria-label={t('workspace.relation.openNode', { title: cleanTitle(node.title) })}
                          onPointerDown={(event) => handleNodePointerDown(event, node)}
                          onClick={() => handleNodeClick(node)}
                          onDoubleClick={() => handleNodeOpen(node)}
                          onKeyDown={(event) => handleNodeKeyDown(event, node)}
                          onMouseEnter={() => setHoveredNodeId(node.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          onFocus={(event) => {
                            // 只有键盘聚焦才降噪其余节点，鼠标点选不应该让整张图变灰。
                            if (event.currentTarget.matches(':focus-visible')) setFocusedNodeId(node.id);
                          }}
                          onBlur={() => setFocusedNodeId((current) => (current === node.id ? null : current))}
                        >
                          <rect className="prism-relation-graph-node-box" width={node.width} height={node.height} rx={isCenter ? 10 : 8} />
                          <rect
                            className="prism-relation-graph-focus-ring"
                            x={-3}
                            y={-3}
                            width={node.width + 6}
                            height={node.height + 6}
                            rx={12}
                          />
                          {node.active ? (
                            <circle className="prism-relation-graph-node-dot" cx={14} cy={isCenter ? 21 : 21} r={3} />
                          ) : null}
                          <text
                            className="prism-relation-graph-node-title"
                            x={node.active ? 24 : 12}
                            y={isCenter ? 25 : 26}
                          >
                            {titleText}
                          </text>
                          {isCenter ? (
                            <text className="prism-relation-graph-node-meta" x={24} y={45}>
                              {t('workspace.relation.linkCounts', {
                                out: String(node.linkCount),
                                in: String(node.backlinkCount),
                              })}
                            </text>
                          ) : (
                            <text className="prism-relation-graph-node-count" x={node.width - 10} y={26} textAnchor="end">
                              {node.linkCount + node.backlinkCount}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              )}
              <div className="prism-relation-graph-legend">
                <div className="prism-relation-graph-legend-items">
                  <span className="prism-relation-graph-legend-item">
                    <i className="prism-relation-graph-legend-dot" />
                    {t('workspace.relation.currentDocument')}
                  </span>
                  <span className="prism-relation-graph-legend-item">
                    <i className="prism-relation-graph-legend-arrow" />
                    {t('workspace.relation.legendOut')}
                  </span>
                  <span className="prism-relation-graph-legend-item">
                    <i className="prism-relation-graph-legend-arrow is-in" />
                    {t('workspace.relation.legendIn')}
                  </span>
                </div>
                <span className="prism-relation-graph-legend-stats">
                  {truncated
                    ? t('workspace.relation.truncated', { count: String((graph.total ?? 0) - layout.nodes.length) })
                    : t('workspace.relation.metaCounts', {
                      nodes: String(layout.nodes.length),
                      edges: String(layout.edges.length),
                    })}
                </span>
              </div>
            </div>

            <aside className="prism-relation-graph-rail" aria-label={t('workspace.relation.detailsAria')}>
              {railNode ? (
                <>
                  <p className="prism-relation-graph-rail-eyebrow">{t('workspace.relation.currentNode')}</p>
                  <h3 className="prism-relation-graph-rail-title">{cleanTitle(railNode.title)}</h3>
                  <p className="prism-relation-graph-rail-path">{railNode.relativePath}</p>
                  <div className="prism-relation-graph-rail-stats">
                    <div>
                      <strong>{railNode.backlinkCount}</strong>
                      <span>{t('workspace.relation.backlinks')}</span>
                    </div>
                    <div>
                      <strong>{railNode.linkCount}</strong>
                      <span>{t('workspace.relation.outlinks')}</span>
                    </div>
                  </div>
                  {([
                    ['out', t('workspace.relation.linkedTo'), railLinks.outgoing],
                    ['in', t('workspace.relation.linkedFrom'), railLinks.incoming],
                  ] as const).map(([tone, label, items]) => {
                    return (
                      <section key={tone} className="prism-relation-graph-rail-group">
                        <p className="prism-relation-graph-rail-eyebrow">{label} · {items.length}</p>
                        {items.length === 0 ? (
                          <p className="prism-relation-graph-rail-empty">{t('workspace.relation.emptyGroup')}</p>
                        ) : (
                          <ul>
                            {items.map((item) => (
                              <li key={`${tone}-${item.path}`}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLocalActivePath(item.path);
                                    setScope('current');
                                    setQuery('');
                                  }}
                                  onDoubleClick={() => onSelect(item.path)}
                                  title={item.relativePath}
                                >
                                  {cleanTitle(item.title)}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                  <div className="prism-relation-graph-rail-actions">
                    <button type="button" className="prism-relation-graph-primary" onClick={() => onSelect(railNode.path)}>
                      {t('workspace.relation.openDocument')}
                      <kbd>↵</kbd>
                    </button>
                    <button type="button" className="prism-relation-graph-ghost" onClick={() => void copyPath(railNode.path)}>
                      {copied ? t('workspace.relation.copied') : t('workspace.relation.copyPath')}
                    </button>
                  </div>
                  <p className="prism-relation-graph-rail-hint">{t('workspace.relation.railHint')}</p>
                </>
              ) : (
                <>
                  <p className="prism-relation-graph-rail-eyebrow">{t('workspace.relation.workspace')}</p>
                  <h3 className="prism-relation-graph-rail-title">{t('workspace.relation.workspaceTitle')}</h3>
                  <p className="prism-relation-graph-rail-path">
                    {t('workspace.relation.metaCounts', { nodes: String(layout.nodes.length), edges: String(layout.edges.length) })}
                  </p>
                  <section className="prism-relation-graph-rail-group">
                    <p className="prism-relation-graph-rail-eyebrow">{t('workspace.relation.hubs')}</p>
                    <ul>
                      {[...graph.nodes]
                        .sort((a, b) => b.backlinkCount - a.backlinkCount || a.relativePath.localeCompare(b.relativePath))
                        .slice(0, 5)
                        .map((node) => (
                          <li key={node.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setLocalActivePath(node.path);
                                setScope('current');
                                setQuery('');
                              }}
                              onDoubleClick={() => onSelect(node.path)}
                              title={node.relativePath}
                            >
                              {cleanTitle(node.title)}
                              <em>{node.backlinkCount}</em>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </section>
                  <p className="prism-relation-graph-rail-hint">{t('workspace.relation.railHint')}</p>
                </>
              )}
            </aside>
          </div>
          {isEmpty || isIsland ? null : (
            <p className="prism-relation-graph-keys-hint">{t('workspace.relation.keysHint')}</p>
          )}
        </div>
      </div>
    </>
  );
}
