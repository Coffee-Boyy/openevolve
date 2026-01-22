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

  async getEvolutionData(runId?: string): Promise<EvolutionData> {
    if (!runId) {
      throw new Error('Run ID is required');
    }
    return window.electronAPI.getEvolutionData(runId);
  }

  async getProgramDetails(programId: string, runId?: string): Promise<{
    id: string;
    code: string;
    metrics: Record<string, number>;
    generation: number;
    island: number;
    parent_id?: string;
    iteration: number;
    method?: string;
    artifacts_json?: any;
  }> {
    if (!runId) {
      throw new Error('Run ID is required');
    }
    return window.electronAPI.getProgramDetails(runId, programId);
  }

  async getEvolutionLogs(runId: string): Promise<{
    logs: Array<{
      timestamp: number;
      level: 'debug' | 'info' | 'warning' | 'error';
      message: string;
      source?: string;
    }>;
  }> {
    return window.electronAPI.getEvolutionLogs(runId);
  }

  // Configuration
  async getConfig(configPath?: string): Promise<EvolutionConfig> {
    return window.electronAPI.getConfig(configPath);
  }

  async updateConfig(config: Partial<EvolutionConfig>, configPath: string): Promise<void> {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0967f0db-dd0f-4f07-b0e8-2fd7aeec4c88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:91',message:'updateConfig called',data:{hasConfig:!!config,configPath:configPath,configPathType:typeof configPath},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B,C'})}).catch(()=>{});
    // #endregion
    
    await window.electronAPI.saveConfig(configPath, config);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0967f0db-dd0f-4f07-b0e8-2fd7aeec4c88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'client.ts:95',message:'saveConfig IPC call completed',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
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
