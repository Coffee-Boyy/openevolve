import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../../store/appStore';

interface Node {
  id: string;
  code: string;
  metrics: Record<string, number>;
  generation: number;
  parent_id?: string;
  island: number;
}

interface Edge {
  source: string;
  target: string;
}

interface EvolutionGraphProps {
  data?: {
    nodes: Node[];
    edges: Edge[];
  };
  onNodeSelect?: (nodeId: string | null) => void;
  selectedNodeId?: string | null;
}

export default function EvolutionGraph({ data, onNodeSelect, selectedNodeId }: EvolutionGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const { theme } = useAppStore();

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
          <p className="text-xs mt-1 text-muted-foreground/70">Data is saved every 10 iterations</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr('width', width).attr('height', height);

    // Create zoom behavior
    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Click on background to deselect
    svg.on('click', (event) => {
      if (event.target === svg.node()) {
        onNodeSelect?.(null);
      }
    });

    // Create color scale for islands
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Create links data
    const linksData = data.edges.map(e => ({
      source: e.source,
      target: e.target,
    }));

    // Create simulation
    const simulation = d3.forceSimulation(data.nodes as any)
      .force('link', d3.forceLink(linksData as any)
        .id((d: any) => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    // Draw links
    const link = g.append('g')
      .selectAll('line')
      .data(linksData)
      .join('line')
      .attr('stroke', theme === 'dark' ? '#444' : '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);

    // Draw nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(data.nodes)
      .join('circle')
      .attr('r', (d) => {
        // Size by score if available
        const score = d.metrics?.combined_score;
        if (score !== undefined) {
          return 10 + (score * 20);
        }
        return 15;
      })
      .attr('fill', (d) => colorScale(d.island.toString()))
      .attr('stroke', (d) => selectedNodeId === d.id ? '#ef4444' : (theme === 'dark' ? '#fff' : '#000'))
      .attr('stroke-width', (d) => selectedNodeId === d.id ? 3 : 1.5)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeSelect?.(d.id);
      })
      .on('mouseover', (event, d) => {
        setHoveredNode(d);
        d3.select(event.currentTarget)
          .attr('stroke', '#fbbf24')
          .attr('stroke-width', 3);
      })
      .on('mouseout', (event, d) => {
        setHoveredNode(null);
        d3.select(event.currentTarget)
          .attr('stroke', selectedNodeId === d.id ? '#ef4444' : (theme === 'dark' ? '#fff' : '#000'))
          .attr('stroke-width', selectedNodeId === d.id ? 3 : 1.5);
      })
      .call(d3.drag<any, Node>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Add tooltips
    node.append('title')
      .text((d) => `ID: ${d.id}\nGeneration: ${d.generation}\nIsland: ${d.island}`);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data, theme, selectedNodeId]);

  if (!data || data.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">No evolution data available</p>
          <p className="text-sm">Start an evolution run to see the graph</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full" ref={containerRef}>
      <svg ref={svgRef} className="w-full h-full" />
      
      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute top-4 left-4 bg-background border border-border rounded-lg p-3 shadow-lg pointer-events-none">
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
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-background/90 border border-border rounded-lg p-3 text-xs">
        <div className="font-semibold mb-2">Controls</div>
        <div className="space-y-1 text-muted-foreground">
          <div>• Click node: View code</div>
          <div>• Drag node: Reposition</div>
          <div>• Scroll: Zoom in/out</div>
          <div>• Drag canvas: Pan</div>
        </div>
      </div>
    </div>
  );
}
