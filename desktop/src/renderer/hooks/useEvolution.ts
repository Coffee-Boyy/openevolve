import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { EvolutionStatus } from '../api/client';

export function useEvolution(runId?: string) {
  const { apiClient, currentRun, setCurrentRun } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll for status updates
  useEffect(() => {
    if (!apiClient || !currentRun?.id) return;

    const interval = setInterval(async () => {
      try {
        const status = await apiClient.getEvolutionStatus(currentRun.id);
        setCurrentRun({
          ...currentRun,
          status: status.status as any,
          iteration: status.iteration,
          totalIterations: status.total_iterations,
          bestScore: status.best_score,
        });
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [apiClient, currentRun?.id]);

  const startEvolution = async (
    initialProgramPath: string,
    evaluatorPath: string,
    configPath?: string,
    iterations?: number
  ) => {
    if (!apiClient) {
      setError('API client not initialized');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.startEvolution({
        initialProgramPath,
        evaluatorPath,
        configPath,
        iterations,
      });

      setCurrentRun({
        id: response.runId,
        status: 'running',
        iteration: 0,
        totalIterations: iterations || 100,
        bestScore: null,
        startTime: Date.now(),
        config: {},
      });
    } catch (err: any) {
      setError(err.message || 'Failed to start evolution');
      console.error('Failed to start evolution:', err);
    } finally {
      setLoading(false);
    }
  };

  const stopEvolution = async () => {
    if (!apiClient || !currentRun?.id) {
      setError('No active run to stop');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.stopEvolution(currentRun.id);
      setCurrentRun({
        ...currentRun,
        status: 'completed',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to stop evolution');
      console.error('Failed to stop evolution:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    startEvolution,
    stopEvolution,
    loading,
    error,
  };
}
