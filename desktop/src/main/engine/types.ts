/**
 * Core types for OpenEvolve evolution engine
 */

/**
 * Represents a program in the evolution database
 */
export interface Program {
  // Program identification
  id: string;
  code: string;
  language: string;

  // Evolution information
  parentId?: string;
  generation: number;
  timestamp: number;
  iterationFound: number;

  // Performance metrics
  metrics: Record<string, number>;

  // Derived features
  complexity: number;
  diversity: number;

  // Metadata
  metadata: Record<string, any>;

  // Prompts (optional for logging)
  prompts?: Record<string, any>;

  // Artifact storage
  artifactsJson?: string;
  artifactDir?: string;

  // Embedding vector for novelty rejection
  embedding?: number[];
}

/**
 * Result from program evaluation
 */
export interface EvaluationResult {
  metrics: Record<string, number>;
  artifacts?: Record<string, string | Buffer>;
}

/**
 * Serializable result for worker threads
 */
export interface SerializableResult {
  childProgramDict?: Program;
  parentId?: string;
  iterationTime: number;
  prompt?: { system: string; user: string };
  llmResponse?: string;
  artifacts?: Record<string, any>;
  iteration: number;
  error?: string;
}

/**
 * Evolution status
 */
export interface EvolutionStatus {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  iteration: number;
  totalIterations: number;
  bestScore: number | null;
  startTime: number | null;
  error?: string;
}

/**
 * Progress callback data
 */
export interface ProgressData {
  iteration: number;
  bestScore?: number;
  metrics?: Record<string, number>;
  bestProgramId?: string;
}

/**
 * Hypothesis entry for PACEvolve idea memory
 */
export interface IdeaHypothesis {
  id: string;
  content: string;
  programId: string;
  iteration: number;
  score: number;
  timestamp: number;
  stale: boolean;
  summary?: string;
}

/**
 * Concept-level idea cluster with hypotheses
 */
export interface IdeaCluster {
  id: string;
  title: string;
  summary: string;
  iteration: number;
  score: number;
  timestamp: number;
  stale: boolean;
  hypotheses: IdeaHypothesis[];
  prunedSummaries?: string[];
}

/**
 * Progress metrics for adaptive sampling
 */
export interface ProgressMetrics {
  recentImprovements: number[];
  momentum: number;
  iterationsSinceImprovement: number;
  currentBestScore: number;
}
