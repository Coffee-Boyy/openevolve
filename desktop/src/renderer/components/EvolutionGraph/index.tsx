import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  NodeProps,
  BackgroundVariant,
  Panel,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { useAppStore } from '../../store/appStore';
import clsx from 'clsx';

// Color scale matching D3's schemeCategory10
const ISLAND_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
];

interface EvolutionNodeData extends Record<string, unknown> {
  id: string;
  code: string;
  metrics: Record<string, number>;
  generation: number;
  parent_id?: string;
  island: number;
}

interface EvolutionGraphProps {
  data?: {
    nodes: EvolutionNodeData[];
    edges: { source: string; target: string }[];
  };
  onNodeSelect?: (nodeId: string | null) => void;
  selectedNodeId?: string | null;
}

// Custom node component for evolution programs
function EvolutionNode({ data, selected }: NodeProps<Node<EvolutionNodeData>>) {
  const { theme } = useAppStore();
  const [isHovered, setIsHovered] = useState(false);
  
  const nodeData = data as EvolutionNodeData;
  
  const radius = useMemo(() => {
    const score = nodeData.metrics?.combined_score;
    if (score !== undefined) {
      return 10 + (score * 20);
    }
    return 15;
  }, [nodeData.metrics?.combined_score]);

  const islandColor = ISLAND_COLORS[nodeData.island % ISLAND_COLORS.length];

  return (
    <div
      className={clsx(
        'rounded-full cursor-pointer transition-all relative',
        selected && 'ring-2 ring-red-500',
        isHovered && !selected && 'ring-2 ring-yellow-500'
      )}
      style={{
        width: radius * 2,
        height: radius * 2,
        backgroundColor: islandColor,
        border: `1.5px solid ${selected ? '#ef4444' : (theme === 'dark' ? '#fff' : '#000')}`,
        borderWidth: selected ? 3 : 1.5,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ opacity: 0 }}
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ opacity: 0 }}
      />
    </div>
  );
}

const nodeTypes = {
  evolution: EvolutionNode,
};

// Dagre layout function
function getLayoutedElements(
  nodes: Node<EvolutionNodeData>[],
  edges: Edge[],
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB'
) {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ 
    rankdir: direction, 
    nodesep: 50, 
    ranksep: 100,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach(node => {
    const radius = node.data.metrics?.combined_score !== undefined
      ? 10 + (node.data.metrics.combined_score * 20)
      : 15;
    g.setNode(node.id, { 
      width: radius * 2 + 20, 
      height: radius * 2 + 20 
    });
  });

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return {
    nodes: nodes.map(node => {
      const pos = g.node(node.id);
      return {
        ...node,
        position: { 
          x: pos.x - (pos.width || 0) / 2, 
          y: pos.y - (pos.height || 0) / 2 
        },
        targetPosition: direction === 'LR' ? Position.Left : Position.Top,
        sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
      };
    }),
    edges: edges.map(edge => ({
      ...edge,
      style: { strokeWidth: 2 },
    })),
  };
}

export default function EvolutionGraph({ data, onNodeSelect, selectedNodeId }: EvolutionGraphProps) {
  const { theme } = useAppStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [hoveredNode, setHoveredNode] = useState<EvolutionNodeData | null>(null);

  // Convert and layout when data changes
  useEffect(() => {
    if (!data || data.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const rfNodes: Node<EvolutionNodeData>[] = data.nodes.map(n => ({
      id: n.id,
      type: 'evolution',
      data: n,
      position: { x: 0, y: 0 },
      selected: selectedNodeId === n.id,
    }));

    const rfEdges: Edge[] = data.edges.map(e => ({
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
    }));

    const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(rfNodes, rfEdges);
    setNodes(layouted);
    setEdges(layoutedEdges);
  }, [data, setNodes, setEdges, selectedNodeId]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect]
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setHoveredNode(node.data as EvolutionNodeData);
    },
    []
  );

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  // Edge styling based on theme
  const styledEdges = useMemo(() => {
    const edgeColor = theme === 'dark' ? '#444' : '#999';
    return edges.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        stroke: edgeColor,
        strokeOpacity: 0.6,
      },
    }));
  }, [edges, theme]);

  // Show message when no data is available
  if (!data || data.nodes.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground bg-muted/30">
        <div className="text-center p-8">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-lg font-medium">No Evolution Data Yet</p>
          <p className="text-sm mt-2">The visualization will appear as evolution progresses</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
        className={theme === 'dark' ? 'dark' : ''}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        
        {/* Hover tooltip */}
        {hoveredNode && (
          <Panel position="top-left" className="bg-background border border-border rounded-lg p-3 shadow-lg pointer-events-none">
            <div className="space-y-1 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono text-xs">{hoveredNode.id.slice(0, 8)}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">Gen:</span>
                <span>{hoveredNode.generation}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground">Island:</span>
                <span>{hoveredNode.island}</span>
              </div>
              {hoveredNode.metrics?.combined_score !== undefined && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Score:</span>
                  <span>{hoveredNode.metrics.combined_score.toFixed(4)}</span>
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* Legend */}
        <Panel position="top-right" className="bg-background/90 border border-border rounded-lg p-3 text-xs">
          <div className="font-semibold mb-2">Controls</div>
          <div className="space-y-1 text-muted-foreground">
            <div>• Click node: View code</div>
            <div>• Drag node: Reposition</div>
            <div>• Scroll: Zoom in/out</div>
            <div>• Drag canvas: Pan</div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
