import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useAppStore } from '../../store/appStore';

interface ProgramViewerProps {
  programId: string | null;
}

interface ProgramData {
  id: string;
  code: string;
  metrics: Record<string, number>;
  generation: number;
  island: number;
  parent_id?: string;
  iteration: number;
  method?: string;
  artifacts_json?: any;
}

export default function ProgramViewer({ programId }: ProgramViewerProps) {
  const { apiClient, theme, currentRun } = useAppStore();
  const [program, setProgram] = useState<ProgramData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!programId || !apiClient) {
      setProgram(null);
      return;
    }

    const loadProgram = async () => {
      setLoading(true);
      setError(null);
      try {
        // Pass run ID to get program from the correct output directory
        const data = await apiClient.getProgramDetails(programId, currentRun?.id);
        setProgram(data);
      } catch (err) {
        console.error('Failed to load program:', err);
        setError(err instanceof Error ? err.message : 'Failed to load program');
      } finally {
        setLoading(false);
      }
    };

    loadProgram();
  }, [programId, apiClient, currentRun?.id]);

  if (!programId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30">
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
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          <p className="text-lg font-medium">No Program Selected</p>
          <p className="text-sm mt-2">Click on a node in the graph to view its code</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-destructive text-center">
          <p className="font-medium">Error loading program</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!program) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with program info */}
      <div className="border-b border-border p-4 bg-muted/30">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold">Program Details</h3>
              <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-mono">
                {program.id.slice(0, 8)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Generation:</span>
                <span className="font-medium">{program.generation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Iteration:</span>
                <span className="font-medium">{program.iteration}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Island:</span>
                <span className="font-medium">{program.island}</span>
              </div>
              {program.method && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="font-medium">{program.method}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metrics */}
        {program.metrics && Object.keys(program.metrics).length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <h4 className="text-sm font-medium mb-2">Metrics</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {Object.entries(program.metrics)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="font-mono text-xs">
                      {typeof value === 'number' ? value.toFixed(6) : value}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Code editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          value={program.code || '# No code available'}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={{
            readOnly: true,
            minimap: { enabled: true },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
          }}
        />
      </div>

      {/* Artifacts section if available */}
      {program.artifacts_json && (
        <div className="border-t border-border p-4 max-h-48 overflow-auto bg-muted/30">
          <h4 className="text-sm font-medium mb-2">Artifacts</h4>
          <pre className="text-xs font-mono bg-background p-3 rounded-md overflow-x-auto">
            {JSON.stringify(program.artifacts_json, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
