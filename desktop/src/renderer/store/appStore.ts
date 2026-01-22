import { create } from 'zustand';
import { ApiClient } from '../api/client';

export type Theme = 'light' | 'dark';

export interface EvolutionRun {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  iteration: number;
  totalIterations: number;
  bestScore: number | null;
  startTime: number | null;
  config: any;
  lastUpdate?: number;
}

export interface SetupCode {
  initial: string;
  evaluator: string;
}

interface AppState {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Evolution run state
  currentRun: EvolutionRun | null;
  setCurrentRun: (run: EvolutionRun | null) => void;

  // Setup code (initial program and evaluator)
  setupCode: SetupCode;
  setSetupCode: (type: 'initial' | 'evaluator', code: string) => void;

  // API client
  apiClient: ApiClient | null;
  setApiClient: (client: ApiClient) => void;

  // Initialization
  initialized: boolean;
  initializeApp: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'light',
  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('theme', theme);
  },

  currentRun: null,
  setCurrentRun: (currentRun) => set({ currentRun }),

  setupCode: {
    initial: '',
    evaluator: '',
  },
  setSetupCode: (type, code) => {
    const { setupCode } = get();
    set({
      setupCode: {
        ...setupCode,
        [type]: code,
      },
    });
    // Persist to localStorage
    localStorage.setItem(`setupCode_${type}`, code);
  },

  apiClient: null,
  setApiClient: (apiClient) => set({ apiClient }),

  initialized: false,
  initializeApp: async () => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      set({ theme: savedTheme });
    }

    // Load saved setup code from localStorage
    const savedInitial = localStorage.getItem('setupCode_initial');
    const savedEvaluator = localStorage.getItem('setupCode_evaluator');
    if (savedInitial || savedEvaluator) {
      set({
        setupCode: {
          initial: savedInitial || '',
          evaluator: savedEvaluator || '',
        },
      });
    }

    // Initialize IPC-based API client
    try {
      const client = new ApiClient();
      
      // Set up event listeners
      client.subscribeToProgress((data) => {
        const { currentRun } = get();
        if (currentRun && data.runId === currentRun.id) {
          set({
            currentRun: {
              ...currentRun,
              iteration: data.iteration,
              bestScore: data.bestScore,
              lastUpdate: Date.now(),
            },
          });
        }
      });

      client.subscribeToStatus((data) => {
        const { currentRun } = get();
        if (currentRun && data.runId === currentRun.id) {
          set({
            currentRun: {
              ...currentRun,
              ...data,
              lastUpdate: Date.now(),
            },
          });
        }
      });

      client.subscribeToCompletion((data) => {
        const { currentRun } = get();
        if (currentRun && data.runId === currentRun.id) {
          set({
            currentRun: {
              ...currentRun,
              status: 'completed',
              lastUpdate: Date.now(),
            },
          });
        }
      });

      client.subscribeToErrors((data) => {
        const { currentRun } = get();
        if (currentRun && data.runId === currentRun.id) {
          set({
            currentRun: {
              ...currentRun,
              status: 'error',
              lastUpdate: Date.now(),
            },
          });
        }
      });

      set({ apiClient: client });
    } catch (error) {
      console.error('Failed to initialize API client:', error);
    }

    set({ initialized: true });
  },
}));
