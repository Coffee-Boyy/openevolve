/**
 * API Client for OpenEvolve (IPC-based)
 */

export interface EvolutionConfig {
  max_iterations: number;
  checkpoint_interval: number;
  random_seed?: number;
  llm?: {
    models: Array<{
      name: string;
      weight: number;
    }>;
  };
  database?: {
    population_size: number;
    num_islands: number;
  };
  pacevolve?: {
    enable_hcm?: boolean;
    enable_mbb?: boolean;
    enable_ce?: boolean;
  };
  [key: string]: any;
}

export interface EvolutionData {
  nodes: Array<{
    id: string;
    code: string;
    metrics: Record<string, number>;
    generation: number;
    parent_id?: string;
    island: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
  }>;
  archive: string[];
  checkpoint_dir: string;
}

export interface EvolutionStatus {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  iteration: number;
  total_iterations: number;
  best_score: number | null;
  start_time: number | null;
  error?: string;
}

export interface StartEvolutionRequest {
  initialProgramPath: string;
  evaluatorPath: string;
  configPath?: string;
  iterations?: number;
  outputDir?: string;
}

/**
 * API client using Electron IPC
 */
export class ApiClient {
  private eventCleanupFunctions: Array<() => void> = [];

  constructor() {
    // No baseUrl needed - using IPC
  }

  // Evolution control
  async startEvolution(request: StartEvolutionRequest): Promise<{ runId: string }> {
    const result = await window.electronAPI.startEvolution(request);
    return { runId: result.runId };
  }

  async stopEvolution(runId: string): Promise<void> {
    await window.electronAPI.stopEvolution(runId);
  }

  async getEvolutionStatus(runId: string): Promise<EvolutionStatus> {
    return window.electronAPI.getEvolutionStatus(runId);
  }

  // Configuration
  async getConfig(configPath?: string): Promise<EvolutionConfig> {
    return window.electronAPI.getConfig(configPath);
  }

  async updateConfig(config: Partial<EvolutionConfig>, configPath: string): Promise<void> {
    await window.electronAPI.saveConfig(configPath, config);
  }

  // Real-time updates via IPC events
  subscribeToProgress(onProgress: (data: any) => void): void {
    const cleanup = window.electronAPI.onEvolutionProgress(onProgress);
    this.eventCleanupFunctions.push(cleanup);
  }

  subscribeToStatus(onStatus: (data: any) => void): void {
    const cleanup = window.electronAPI.onEvolutionStatus(onStatus);
    this.eventCleanupFunctions.push(cleanup);
  }

  subscribeToCompletion(onComplete: (data: any) => void): void {
    const cleanup = window.electronAPI.onEvolutionComplete(onComplete);
    this.eventCleanupFunctions.push(cleanup);
  }

  subscribeToErrors(onError: (data: any) => void): void {
    const cleanup = window.electronAPI.onEvolutionError(onError);
    this.eventCleanupFunctions.push(cleanup);
  }

  // Cleanup all event listeners
  disconnect(): void {
    for (const cleanup of this.eventCleanupFunctions) {
      cleanup();
    }
    this.eventCleanupFunctions = [];
  }

  // WebSocket methods (no-ops since we use IPC subscriptions)
  // These are kept for compatibility with useWebSocket hook
  connectWebSocket(
    onMessage: (message: any) => void,
    onError?: (error: any) => void
  ): void {
    // Subscriptions are already set up in the store initialization
    // This method exists for compatibility but doesn't need to do anything
    // since IPC subscriptions handle all real-time updates
  }

  disconnectWebSocket(): void {
    // Cleanup is handled by the disconnect() method
    // This method exists for compatibility
  }
}
