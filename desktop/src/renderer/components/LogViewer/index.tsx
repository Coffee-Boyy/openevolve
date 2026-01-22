import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { logMessageEvent } from '../../hooks/useWebSocket';

interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  source?: string;
}

export default function LogViewer() {
  const { apiClient, currentRun } = useAppStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsLogsRef = useRef<Set<string>>(new Set()); // Track WebSocket log IDs to avoid duplicates

  // Load logs from file
  const loadLogsFromFile = async () => {
    if (!apiClient || !currentRun?.id) return;
    
    setLoading(true);
    try {
      const response = await apiClient.getEvolutionLogs(currentRun.id);
      if (response.logs && response.logs.length > 0) {
        // Convert to LogEntry format
        const fileLogEntries: LogEntry[] = response.logs.map(log => ({
          timestamp: log.timestamp * 1000, // Convert to milliseconds
          level: log.level as any,
          message: log.message,
          source: log.source,
        }));
        
        // Replace logs with file logs (file is source of truth)
        setLogs(fileLogEntries);
        wsLogsRef.current.clear();
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and periodic refresh
  useEffect(() => {
    if (!apiClient || !currentRun?.id) return;

    // Load logs immediately
    loadLogsFromFile();

    // Refresh logs periodically while running
    const interval = setInterval(() => {
      if (currentRun?.status === 'running') {
        loadLogsFromFile();
      }
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [apiClient, currentRun?.id, currentRun?.status]);

  // Handle WebSocket log messages (append in real-time between file refreshes)
  useEffect(() => {
    const handleLogMessage = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;
      
      // Create unique ID for this log message
      const logId = `${data.timestamp}-${data.message}`;
      
      // Skip if we've already seen this log from WebSocket
      if (wsLogsRef.current.has(logId)) return;
      wsLogsRef.current.add(logId);
      
      const logEntry: LogEntry = {
        timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
        level: data.level || 'info',
        message: data.message,
        source: data.source,
      };
      
      setLogs(prev => [...prev, logEntry]);
    };

    // Listen for log messages from WebSocket
    logMessageEvent.addEventListener('log', handleLogMessage);
    
    return () => {
      logMessageEvent.removeEventListener('log', handleLogMessage);
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    if (autoScroll !== isAtBottom) {
      setAutoScroll(isAtBottom);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const filteredLogs = logs.filter(log => {
    if (levelFilter !== 'all' && log.level !== levelFilter) {
      return false;
    }
    if (filter && !log.message.toLowerCase().includes(filter.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'debug':
        return 'text-blue-600 dark:text-blue-400';
      case 'info':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-foreground';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    } as Intl.DateTimeFormatOptions);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-border px-4 py-2 flex items-center justify-between bg-secondary/30">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium">Logs</span>
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-2 py-1 text-sm border border-border rounded bg-background"
          />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-2 py-1 text-sm border border-border rounded bg-background"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1 text-sm">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            <span>Auto-scroll</span>
          </label>
          <button
            onClick={loadLogsFromFile}
            disabled={loading || !currentRun?.id}
            className="px-3 py-1 text-sm border border-border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh logs from file"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={clearLogs}
            className="px-3 py-1 text-sm border border-border rounded hover:bg-accent"
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 font-mono text-xs"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No logs to display</p>
            <p className="text-xs mt-2">Logs will appear here when evolution runs</p>
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={`log-line-${index}`} className="py-0.5 hover:bg-accent/50 px-2 -mx-2 rounded">
              <span className="text-muted-foreground mr-2">
                {formatTimestamp(log.timestamp)}
              </span>
              <span className={`font-semibold mr-2 uppercase ${getLevelColor(log.level)}`}>
                [{log.level}]
              </span>
              {log.source && (
                <span className="text-muted-foreground mr-2">
                  {log.source}:
                </span>
              )}
              <span className="text-foreground">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
