import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import EvolutionGraph from '../EvolutionGraph';
import ProgramViewer from '../ProgramViewer';

export default function EvolutionView() {
  const { apiClient, currentRun } = useAppStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [graphHeight, setGraphHeight] = useState(60); // percentage
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
      const newHeight = ((e.clientY - rect.top) / rect.height) * 100;
      
      // Constrain between 30% and 80%
      setGraphHeight(Math.max(30, Math.min(80, newHeight)));
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
    <div ref={containerRef} className="h-full flex flex-col relative">
      {/* Graph panel */}
      <div 
        className="w-full overflow-hidden border-b border-border"
        style={{ height: `${graphHeight}%` }}
      >
        <EvolutionGraph 
          data={data} 
          onNodeSelect={handleNodeSelect}
          selectedNodeId={selectedProgramId}
        />
      </div>

      {/* Resizable divider */}
      <div
        className={`h-1 w-full bg-border hover:bg-primary cursor-row-resize transition-colors ${
          isDragging ? 'bg-primary' : ''
        }`}
        onMouseDown={handleMouseDown}
      />

      {/* Program viewer panel */}
      <div 
        className="w-full overflow-hidden"
        style={{ height: `${100 - graphHeight}%` }}
      >
        <ProgramViewer programId={selectedProgramId} />
      </div>
    </div>
  );
}
