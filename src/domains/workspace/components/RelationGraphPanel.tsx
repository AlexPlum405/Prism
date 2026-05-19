import { useEffect, useMemo, useState } from 'react';
import {
  buildRelationGraph,
  type RelationGraphDepth,
  type RelationGraphNode,
  type RelationGraphScope,
  type WorkspaceIndex,
} from '../services';

interface RelationGraphPanelProps {
  currentPath?: string | null;
  index: WorkspaceIndex | null;
  onClose: () => void;
  onSelect: (path: string) => void;
  visible: boolean;
}

interface PositionedNode extends RelationGraphNode {
  x: number;
  y: number;
}

const WIDTH = 720;
const HEIGHT = 420;

function layoutNodes(nodes: RelationGraphNode[]): PositionedNode[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ ...nodes[0], x: WIDTH / 2, y: HEIGHT / 2 }];

  const activeIndex = nodes.findIndex((node) => node.active);
  const centerNode = activeIndex >= 0 ? nodes[activeIndex] : null;
  const rest = centerNode ? nodes.filter((_, index) => index !== activeIndex) : nodes;
  const radius = Math.min(156, Math.max(92, 34 * rest.length));
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;
  const positioned = rest.map((node, index) => {
    const angle = (-Math.PI / 2) + ((2 * Math.PI * index) / rest.length);
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });

  return centerNode
    ? [{ ...centerNode, x: centerX, y: centerY }, ...positioned]
    : positioned;
}

export function RelationGraphPanel({
  currentPath,
  index,
  onClose,
  onSelect,
  visible,
}: RelationGraphPanelProps) {
  const [scope, setScope] = useState<RelationGraphScope>('current');
  const [depth, setDepth] = useState<RelationGraphDepth>(1);
  const [query, setQuery] = useState('');

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
      setScope(currentPath ? 'current' : 'workspace');
      setDepth(1);
      setQuery('');
    }
  }, [currentPath, visible]);

  const graph = useMemo(() => {
    if (!index) return { nodes: [], edges: [] };
    return buildRelationGraph({
      index,
      currentPath,
      scope,
      depth,
      query,
    });
  }, [currentPath, depth, index, query, scope]);
  const positionedNodes = useMemo(() => layoutNodes(graph.nodes), [graph.nodes]);
  const nodeById = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  );

  if (!visible) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal prism-relation-graph-modal" role="dialog" aria-label="关系图谱">
        <div className="modal-header">
          <div className="modal-title">关系图谱</div>
          <button className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="modal-body prism-relation-graph-body">
          <div className="prism-relation-graph-toolbar">
            <div className="prism-relation-graph-segment" aria-label="图谱范围">
              <button type="button" data-active={scope === 'current' ? 'true' : undefined} onClick={() => setScope('current')}>
                当前文档
              </button>
              <button type="button" data-active={scope === 'workspace' ? 'true' : undefined} onClick={() => setScope('workspace')}>
                工作区
              </button>
            </div>
            <div className="prism-relation-graph-segment" aria-label="关系深度">
              <button type="button" data-active={depth === 1 ? 'true' : undefined} onClick={() => setDepth(1)}>
                1 跳
              </button>
              <button type="button" data-active={depth === 2 ? 'true' : undefined} onClick={() => setDepth(2)}>
                2 跳
              </button>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索节点…"
              aria-label="搜索图谱节点"
            />
          </div>

          <div className="prism-relation-graph-content">
            <div className="prism-relation-graph-canvas">
              {positionedNodes.length === 0 ? (
                <div className="prism-relation-graph-empty">没有可显示的关系</div>
              ) : (
                <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="文档关系图">
                  {graph.edges.map((edge) => {
                    const source = nodeById.get(edge.source);
                    const target = nodeById.get(edge.target);
                    if (!source || !target) return null;
                    return (
                      <line
                        key={edge.id}
                        className="prism-relation-graph-edge"
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                      />
                    );
                  })}
                  {positionedNodes.map((node) => (
                    <g
                      key={node.id}
                      className={`prism-relation-graph-node ${node.active ? 'is-active' : ''}`}
                      transform={`translate(${node.x} ${node.y})`}
                      onClick={() => onSelect(node.path)}
                      tabIndex={0}
                      role="button"
                      aria-label={`打开 ${node.title}`}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelect(node.path);
                        }
                      }}
                    >
                      <circle r={node.active ? 24 : 18} />
                      <text y={node.active ? 42 : 34}>{node.title}</text>
                    </g>
                  ))}
                </svg>
              )}
            </div>

            <div className="prism-relation-graph-list">
              {graph.nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={node.active ? 'is-active' : undefined}
                  onClick={() => onSelect(node.path)}
                  title={node.path}
                >
                  <span>{node.title}</span>
                  <small>{node.relativePath}</small>
                  <em>{node.linkCount} 出 · {node.backlinkCount} 入</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
