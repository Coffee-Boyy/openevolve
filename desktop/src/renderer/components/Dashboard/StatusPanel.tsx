import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useEvolution } from '../../hooks/useEvolution';

export default function StatusPanel() {
  const { currentRun, setupCode } = useAppStore();
  const { startEvolution, stopEvolution, loading, error } = useEvolution();
  const [showStartDialog, setShowStartDialog] = useState(false);

  const handleStart = async () => {
    // Check if setup code is available
    if (!setupCode.initial || !setupCode.evaluator) {
      await window.electronAPI.showMessageBox({
        type: 'warning',
        title: 'Missing Setup Code',
        message: 'Please configure the initial program and evaluator in the Setup tab before starting evolution.',
      });
      return;
    }

    try {
      // Save setup code to temporary files
      const tempDir = await window.electronAPI.getTempDir();

      const initialPath = `${tempDir}/initial_program.py`;
      const evaluatorPath = `${tempDir}/evaluator.py`;

      await window.electronAPI.writeFile(initialPath, setupCode.initial);
      await window.electronAPI.writeFile(evaluatorPath, setupCode.evaluator);

      // Optional: config file
      const configResult = await window.electronAPI.showMessageBox({
        type: 'question',
        title: 'Load Configuration',
        message: 'Would you like to load a custom configuration file?',
        buttons: ['Yes', 'No'],
      });

      let config: string | undefined;
      if (configResult === 0) {
        const configPath = await window.electronAPI.openFileDialog({
          filters: [{ name: 'YAML Files', extensions: ['yaml', 'yml'] }],
        });
        config = configPath || undefined;
      }

      // Start evolution
      await startEvolution(initialPath, evaluatorPath, config, 100);
    } catch (err) {
      console.error('Failed to start evolution:', err);
      await window.electronAPI.showMessageBox({
        type: 'error',
        title: 'Start Failed',
        message: err instanceof Error ? err.message : 'Failed to start evolution',
      });
    }
  };

  const getProgress = () => {
    if (!currentRun) return 0;
    return (currentRun.iteration / currentRun.totalIterations) * 100;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running':
        return 'text-green-600';
      case 'completed':
        return 'text-blue-600';
      case 'error':
        return 'text-red-600';
      case 'paused':
        return 'text-yellow-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="w-80 border-r border-border p-4 flex flex-col space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-2">Run Status</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status:</span>
            <span className={`font-medium ${getStatusColor(currentRun?.status)}`}>
              {currentRun?.status || 'Idle'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Iteration:</span>
            <span>{currentRun?.iteration || 0} / {currentRun?.totalIterations || 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Best Score:</span>
            <span>{currentRun?.bestScore?.toFixed(4) || 'N/A'}</span>
          </div>
          
          {/* Progress bar */}
          {currentRun && currentRun.status === 'running' && (
            <div className="pt-2">
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground text-center mt-1">
                {getProgress().toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-2 bg-destructive/10 border border-destructive rounded-md text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex-1"></div>

      <div className="space-y-2">
        <button
          onClick={handleStart}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={currentRun?.status === 'running' || loading}
        >
          {loading ? 'Starting...' : 'Start Evolution'}
        </button>
        <button
          onClick={stopEvolution}
          className="w-full px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={currentRun?.status !== 'running' || loading}
        >
          {loading ? 'Stopping...' : 'Stop Evolution'}
        </button>
      </div>
    </div>
  );
}
