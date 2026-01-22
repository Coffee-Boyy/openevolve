import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';

// Global event for log messages that LogViewer can listen to
export const logMessageEvent = new EventTarget();

export function useWebSocket() {
  const { apiClient, currentRun, setCurrentRun } = useAppStore();
  const hasConnected = useRef(false);

  useEffect(() => {
    if (!apiClient || hasConnected.current) return;

    hasConnected.current = true;

    // Connect to WebSocket
    apiClient.connectWebSocket(
      (message) => {
        // Handle different message types
        switch (message.type) {
          case 'iteration_update':
            if (currentRun && message.run_id === currentRun.id) {
              setCurrentRun({
                ...currentRun,
                iteration: message.iteration,
                bestScore: message.best_score,
                lastUpdate: Date.now(), // Trigger refresh in components
              });
            }
            break;

          case 'evolution_complete':
            if (currentRun && message.run_id === currentRun.id) {
              setCurrentRun({
                ...currentRun,
                status: 'completed',
              });
            }
            break;

          case 'evolution_error':
            if (currentRun && message.run_id === currentRun.id) {
              setCurrentRun({
                ...currentRun,
                status: 'error',
              });
            }
            break;

          case 'log':
            // Broadcast log message to LogViewer component
            logMessageEvent.dispatchEvent(
              new CustomEvent('log', { detail: message })
            );
            break;

          default:
            console.log('Received WebSocket message:', message);
        }
      },
      (error) => {
        console.error('WebSocket error:', error);
      }
    );

    return () => {
      apiClient.disconnectWebSocket();
      hasConnected.current = false;
    };
  }, [apiClient]);
}
