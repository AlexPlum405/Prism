import { useEffect, useMemo, useRef, useState } from 'react';
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
  const radius = Math.min(185, Math.max(110, 26 * rest.length + 50));
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

  // 1. 本地聚焦路径机制（单击仅在图谱内聚焦，双击跳转）
  const [localActivePath, setLocalActivePath] = useState<string | null>(currentPath || null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [, setDraggedNodeId] = useState<string | null>(null);

  // Refs
  const physicsRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());
  const dragNodeIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

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

  // 当外部文档路径变化或打开图谱时，同步 localActivePath
  useEffect(() => {
    if (visible) {
      setLocalActivePath(currentPath || null);
      setScope(currentPath ? 'current' : 'workspace');
      setDepth(1);
      setQuery('');
    }
  }, [currentPath, visible]);

  // 关闭时清理状态
  useEffect(() => {
    if (!visible) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      physicsRef.current.clear();
      dragNodeIdRef.current = null;
      isDraggingRef.current = false;
      setDraggedNodeId(null);
      setNodePositions({});
    }
  }, [visible]);

  // 基于 localActivePath 构建关系图谱
  const graph = useMemo(() => {
    if (!index) return { nodes: [], edges: [] };
    return buildRelationGraph({
      index,
      currentPath: localActivePath,
      scope,
      depth,
      query,
    });
  }, [localActivePath, depth, index, query, scope]);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const positionedNodes = useMemo(() => layoutNodes(graph.nodes), [graph.nodes]);

  // 2. 长按与物理联动弹簧受力计算引擎
  useEffect(() => {
    if (!visible) return;

    // 当切换范围或点击聚焦改变布局节点时，强制清空旧的物理位置缓存，使节点瞬移重置到新锚点上，消除突兀的弹性拉扯跳跃
    physicsRef.current.clear();

    let animId: number;

    const tick = (now: number) => {
      // 固化 0.8Hz 呼吸脉动频率（时间转弧度）
      const timeOffset = now * 0.001 * 0.8 * 2 * Math.PI;

      // 初始化 physics 状态
      positionedNodes.forEach((node) => {
        if (!physicsRef.current.has(node.id)) {
          physicsRef.current.set(node.id, {
            x: node.x,
            y: node.y,
            vx: 0,
            vy: 0,
          });
        }
      });

      // 物理参数：kAnchor(自身恢复弹力), kLink(连线拉扯弹力), cDamping(空气阻力), oscillationAmp(2.0px微晃)
      const kAnchor = 0.08;
      const kLink = 0.045;
      const cDamping = 0.16;
      const oscillationAmp = 2.0;

      // 复制一份当前帧旧坐标，用于邻近邻居拉力计算
      const currentPositions = new Map<string, { x: number; y: number }>();
      physicsRef.current.forEach((val, id) => {
        currentPositions.set(id, { x: val.x, y: val.y });
      });

      physicsRef.current.forEach((state, id) => {
        const node = positionedNodes.find((n) => n.id === id);
        if (!node) return;

        // 如果是被拖拽节点，它会直接跟着鼠标，不需要计算复杂的合力，只需以很大的弹性迅速贴近鼠标
        if (dragNodeIdRef.current === id) {
          const targetX = mousePosRef.current.x;
          const targetY = mousePosRef.current.y;
          state.x += (targetX - state.x) * 0.35;
          state.y += (targetY - state.y) * 0.35;
          state.vx = 0;
          state.vy = 0;
          return;
        }

        let fx = 0;
        let fy = 0;

        // 独立相位差产生微晃
        const phase = (id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 10) * 0.6;
        const oscX = Math.sin(timeOffset + phase) * oscillationAmp;
        const oscY = Math.cos(timeOffset * 0.8 + phase) * oscillationAmp;

        const anchorX = node.x + oscX;
        const anchorY = node.y + oscY;

        // A. 锚点恢复力
        fx += -kAnchor * (state.x - anchorX);
        fy += -kAnchor * (state.y - anchorY);

        // B. 连线弹簧力（仅在发生物理拖拽时激活连带联动，平时保持完全静止去噪，消灭进入图谱时的突兀跳跃）
        if (isDraggingRef.current) {
          graph.edges.forEach((edge) => {
            let otherId: string | null = null;
            if (edge.source === id) {
              otherId = edge.target;
            } else if (edge.target === id) {
              otherId = edge.source;
            }

            if (otherId && currentPositions.has(otherId)) {
              const otherPos = currentPositions.get(otherId)!;
              fx += -kLink * (state.x - otherPos.x);
              fy += -kLink * (state.y - otherPos.y);
            }
          });
        }

        // C. 阻尼（空气阻力）
        fx += -cDamping * state.vx;
        fy += -cDamping * state.vy;

        // D. 积分
        state.vx += fx;
        state.vy += fy;
        state.x += state.vx;
        state.y += state.vy;
      });

      // 驱动重新渲染
      const nextPositions: Record<string, { x: number; y: number }> = {};
      physicsRef.current.forEach((val, id) => {
        nextPositions[id] = { x: val.x, y: val.y };
      });
      setNodePositions(nextPositions);

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [visible, positionedNodes, graph.edges]);

  // window 级别的全局 mousemove 与 mouseup 监听
  useEffect(() => {
    if (!visible) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragNodeIdRef.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
      const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
      mousePosRef.current = { x, y };
    };

    const handleWindowMouseUp = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (isDraggingRef.current) {
        dragNodeIdRef.current = null;
        isDraggingRef.current = false;
        setDraggedNodeId(null);
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [visible]);

  // 3. 映射物理位置的计算节点
  const nodesWithPhysics = useMemo(() => {
    return positionedNodes.map((node) => {
      const pos = nodePositions[node.id] || { x: node.x, y: node.y };
      return {
        ...node,
        currentX: pos.x,
        currentY: pos.y,
      };
    });
  }, [positionedNodes, nodePositions]);

  const nodeById = useMemo(
    () => new Map(nodesWithPhysics.map((node) => [node.id, node])),
    [nodesWithPhysics],
  );

  const connectedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const set = new Set<string>([hoveredNodeId]);
    graph.edges.forEach((edge) => {
      if (edge.source === hoveredNodeId) {
        set.add(edge.target);
      } else if (edge.target === hoveredNodeId) {
        set.add(edge.source);
      }
    });
    return set;
  }, [hoveredNodeId, graph.edges]);

  // 4. 手势控制：单击 vs 双击 vs 长按
  const handleNodeMouseDown = (e: React.MouseEvent, node: RelationGraphNode) => {
    if (e.button !== 0) return; // 仅限左键
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    // 清除可能存在的旧长按定时器
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const updateMousePos = (clientX: number, clientY: number) => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * WIDTH;
        const y = ((clientY - rect.top) / rect.height) * HEIGHT;
        mousePosRef.current = { x, y };
      }
    };

    // 记录初始按下位置
    updateMousePos(e.clientX, e.clientY);

    let hasStartedDrag = false;

    const startDrag = () => {
      if (hasStartedDrag) return;
      hasStartedDrag = true;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      dragNodeIdRef.current = node.id;
      setDraggedNodeId(node.id);
      isDraggingRef.current = true;
    };

    // 1. 长按 200ms 自动激活拖拽
    longPressTimerRef.current = setTimeout(() => {
      startDrag();
    }, 200);

    const handleInitialMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 2. 移动超过 4px，代表明显的拖拽意图，立即强制进入拖拽状态，无需等待 200ms 倒计时！
      if (dist > 4) {
        startDrag();
      }

      if (isDraggingRef.current) {
        updateMousePos(moveEvent.clientX, moveEvent.clientY);
      }
    };

    const handleInitialMouseUp = () => {
      window.removeEventListener('mousemove', handleInitialMouseMove);
      window.removeEventListener('mouseup', handleInitialMouseUp);

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // 如果未曾触发过拖拽，说明是纯粹的单击：图谱内部切换聚焦
      if (!isDraggingRef.current && !hasStartedDrag) {
        setLocalActivePath(node.path);
      } else {
        // 拖动结束：清空拖拽标记
        dragNodeIdRef.current = null;
        isDraggingRef.current = false;
        setDraggedNodeId(null);
      }
    };

    window.addEventListener('mousemove', handleInitialMouseMove);
    window.addEventListener('mouseup', handleInitialMouseUp);
  };

  // 隐藏文件名后缀
  const cleanTitle = (title: string) => {
    return title.replace(/\.(md|tsx|css)$/i, '');
  };

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
                直接关联
              </button>
              <button type="button" data-active={depth === 2 ? 'true' : undefined} onClick={() => setDepth(2)}>
                延展脉络
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
              {nodesWithPhysics.length === 0 ? (
                <div className="prism-relation-graph-empty">没有可显示的关系</div>
              ) : (
                <svg
                  ref={svgRef}
                  className={hoveredNodeId ? 'has-focus' : ''}
                  viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                  role="img"
                  aria-label="文档关系图"
                >
                  <defs>
                    {/* 网格图案底饰 */}
                    <pattern id="graph-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1.2" fill="var(--c-ash)" opacity="0.16" />
                    </pattern>
                  </defs>

                  {/* 专业网格绘制背景 */}
                  <rect width="100%" height="100%" fill="url(#graph-grid)" pointerEvents="none" />

                  {graph.edges.map((edge) => {
                    const source = nodeById.get(edge.source);
                    const target = nodeById.get(edge.target);
                    if (!source || !target) return null;
                    const isConnectedHover = hoveredNodeId && (edge.source === hoveredNodeId || edge.target === hoveredNodeId);
                    return (
                      <line
                        key={edge.id}
                        className={`prism-relation-graph-edge ${isConnectedHover ? 'is-connected-hover' : ''}`}
                        x1={source.currentX}
                        y1={source.currentY}
                        x2={target.currentX}
                        y2={target.currentY}
                      />
                    );
                  })}
                  {nodesWithPhysics.map((node) => {
                    const isHovered = hoveredNodeId === node.id;
                    const isAdjacent = hoveredNodeId && connectedNodeIds.has(node.id) && !isHovered;
                    const isDimmed = hoveredNodeId && !connectedNodeIds.has(node.id);

                    const nodeSize = node.active ? 10 : 7;

                    return (
                      <g
                        key={node.id}
                        className={`prism-relation-graph-node ${node.active ? 'is-active' : ''} ${isHovered ? 'is-hovered' : ''} ${isAdjacent ? 'is-adjacent' : ''} ${isDimmed ? 'is-dimmed' : ''}`}
                        transform={`translate(${node.currentX} ${node.currentY})`}
                        onMouseDown={(e) => handleNodeMouseDown(e, node)}
                        onDoubleClick={() => onSelect(node.path)}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        tabIndex={0}
                        role="button"
                        aria-label={`打开 ${cleanTitle(node.title)}`}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onSelect(node.path);
                          }
                        }}
                      >
                        {/* 激活文档的优雅水晕呼吸动画 */}
                        {node.active && (
                          <circle className="pulse-halo" r={nodeSize} />
                        )}

                        {/* 东方清雅扁平焦墨圆点 */}
                        <circle r={nodeSize} />

                        {/* 标题文本标签 */}
                        <text className="node-label" y={nodeSize + 13}>
                          {cleanTitle(node.title)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>

            <div className="prism-relation-graph-list">
              {graph.nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={node.active ? 'is-active' : undefined}
                  onClick={() => setLocalActivePath(node.path)}
                  onDoubleClick={() => onSelect(node.path)}
                  title={node.path}
                >
                  <span>{cleanTitle(node.title)}</span>
                  <small>{node.relativePath.replace(/\.(md|tsx|css)$/i, '')}</small>
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
