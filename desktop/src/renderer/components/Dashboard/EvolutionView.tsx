import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import EvolutionGraph from '../EvolutionGraph';
import ProgramViewer from '../ProgramViewer';

export default function EvolutionView() {
  const { apiClient, currentRun } = useAppStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [graphWidth, setGraphWidth] = useState(60); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!apiClient) return;

    // Load evolution data
    const loadData = async () => {
      setLoading(true);
      try {
        // Pass run ID to get data from the correct output directory
        const evolutionData = await apiClient.getEvolutionData(currentRun?.id);
        setData(evolutionData);
      } catch (error) {
        console.error('Failed to load evolution data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Poll for updates while running (fallback if WebSocket doesn't update)
    const interval = setInterval(() => {
      if (currentRun?.status === 'running') {
        loadData();
      }
    }, 10000); // Update every 10 seconds (less frequent since WebSocket handles real-time)

    return () => clearInterval(interval);
  }, [apiClient, currentRun?.status, currentRun?.id]);
  
  // Reload data when WebSocket sends updates
  useEffect(() => {
    if (!apiClient || !currentRun?.lastUpdate) return;
    
    const loadData = async () => {
      try {
        // Pass run ID to get data from the correct output directory
        const evolutionData = await apiClient.getEvolutionData(currentRun.id);
        setData(evolutionData);
      } catch (error) {
        console.error('Failed to load evolution data:', error);
      }
    };
    
    loadData();
  }, [apiClient, currentRun?.lastUpdate, currentRun?.id]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      
      // Constrain between 30% and 80%
      setGraphWidth(Math.max(30, Math.min(80, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedProgramId(nodeId);
  };

  if (loading && !data) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
          <p>Loading evolution data...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex relative">
      {/* Graph panel */}
      <div 
        className="h-full overflow-hidden border-r border-border"
        style={{ width: `${graphWidth}%` }}
      >
        <EvolutionGraph 
          data={data} 
          onNodeSelect={handleNodeSelect}
          selectedNodeId={selectedProgramId}
        />
      </div>

      {/* Resizable divider */}
      <div
        className={`w-1 h-full bg-border hover:bg-primary cursor-col-resize transition-colors ${
          isDragging ? 'bg-primary' : ''
        }`}
        onMouseDown={handleMouseDown}
      />

      {/* Program viewer panel */}
      <div 
        className="h-full overflow-hidden"
        style={{ width: `${100 - graphWidth}%` }}
      >
        <ProgramViewer programId={selectedProgramId} />
      </div>
    </div>
  );
}
