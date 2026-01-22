/**
 * Configuration types and loaders for OpenEvolve
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

/**
 * Configuration for a single LLM model
 */
export interface LLMModelConfig {
  // API configuration
  apiBase?: string;
  apiKey?: string;
  name?: string;

  // Weight for model in ensemble
  weight: number;

  // Generation parameters
  systemMessage?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;

  // Request parameters
  timeout?: number;
  retries?: number;
  retryDelay?: number;

  // Reproducibility
  randomSeed?: number;

  // Reasoning parameters
  reasoningEffort?: string;
}

/**
 * Configuration for LLM ensemble
 */
export interface LLMConfig extends LLMModelConfig {
  // Default values
  apiBase: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  timeout: number;
  retries: number;
  retryDelay: number;

  // Model ensembles
  models: LLMModelConfig[];
  evaluatorModels: LLMModelConfig[];

  // Backwards compatibility
  primaryModel?: string;
  primaryModelWeight?: number;
  secondaryModel?: string;
  secondaryModelWeight?: number;
}

/**
 * Configuration for prompt generation
 */
export interface PromptConfig {
  templateDir?: string;
  systemMessage: string;
  evaluatorSystemMessage: string;

  // Number of examples
  numTopPrograms: number;
  numDiversePrograms: number;

  // Template stochasticity
  useTemplateStochasticity: boolean;
  templateVariations: Record<string, string[]>;

  // Meta-prompting (not implemented)
  useMetaPrompting: boolean;
  metaPromptWeight: number;

  // Artifact rendering
  includeArtifacts: boolean;
  maxArtifactBytes: number;
  artifactSecurityFilter: boolean;

  // Feature extraction
  suggestSimplificationAfterChars?: number;
  includeChangesUnderChars?: number;
  conciseImplementationMaxLines?: number;
  comprehensiveImplementationMinLines?: number;
}

/**
 * Configuration for the program database
 */
export interface DatabaseConfig {
  // General settings
  dbPath?: string;
  inMemory: boolean;
  logPrompts: boolean;

  // Evolutionary parameters
  populationSize: number;
  archiveSize: number;
  numIslands: number;

  // Selection parameters
  eliteSelectionRatio: number;
  explorationRatio: number;
  exploitationRatio: number;
  diversityMetric: string;

  // Feature map dimensions for MAP-Elites
  featureDimensions: string[];
  featureBins: number | Record<string, number>;
  diversityReferenceSize: number;

  // Migration parameters
  migrationInterval: number;
  migrationRate: number;

  // Random seed
  randomSeed?: number;

  // Artifact storage
  artifactsBasePath?: string;
  artifactSizeThreshold: number;
  cleanupOldArtifacts: boolean;
  artifactRetentionDays: number;

  // Novelty detection
  embeddingModel?: string;
  similarityThreshold: number;
}

/**
 * Configuration for program evaluation
 */
export interface EvaluatorConfig {
  // General settings
  timeout: number;
  maxRetries: number;

  // Resource limits (not implemented)
  memoryLimitMb?: number;
  cpuLimit?: number;

  // Evaluation strategies
  cascadeEvaluation: boolean;
  cascadeThresholds: number[];

  // Parallel evaluation
  parallelEvaluations: number;
  distributed: boolean;

  // LLM-based feedback
  useLlmFeedback: boolean;
  llmFeedbackWeight: number;

  // Artifact handling
  enableArtifacts: boolean;
  maxArtifactStorage: number;
}

/**
 * Configuration for evolution trace logging
 */
export interface EvolutionTraceConfig {
  enabled: boolean;
  format: string;
  includeCode: boolean;
  includePrompts: boolean;
  outputPath?: string;
  bufferSize: number;
  compress: boolean;
}

/**
 * PACEvolve-specific configuration
 */
export interface PACEvolveConfig {
  // Hierarchical Context Management
  enableHCM: boolean;
  ideaMemorySize: number;
  pruningThreshold: number;
  pruningInterval: number;
  maxIdeas: number;
  maxHypothesesPerIdea: number;
  ideaDistinctnessThreshold: number;
  ideaSummaryMaxChars: number;
  hypothesisSummaryMaxChars: number;

  // Momentum-Based Backtracking
  enableMBB: boolean;
  momentumWindowSize: number;
  stagnationThreshold: number;
  backtrackDepth: number;
  momentumBeta: number;
  backtrackPower: number;

  // Self-Adaptive Collaborative Evolution
  enableCE: boolean;
  initialExploreProb: number;
  initialExploitProb: number;
  initialBacktrackProb: number;
  adaptationRate: number;
  crossoverFrequency: number;
}

/**
 * Master configuration for OpenEvolve
 */
export interface Config {
  // General settings
  maxIterations: number;
  checkpointInterval: number;
  logLevel: string;
  logDir?: string;
  randomSeed?: number;
  language: string;
  fileSuffix: string;

  // Component configurations
  llm: LLMConfig;
  prompt: PromptConfig;
  database: DatabaseConfig;
  evaluator: EvaluatorConfig;
  evolutionTrace: EvolutionTraceConfig;
  pacevolve: PACEvolveConfig;

  // Evolution settings
  diffBasedEvolution: boolean;
  maxCodeLength: number;
  diffPattern: string;

  // Early stopping
  earlyStoppingPatience?: number;
  convergenceThreshold: number;
  earlyStoppingMetric: string;

  // Worker settings
  maxTasksPerChild?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Config = {
  maxIterations: 10000,
  checkpointInterval: 100,
  logLevel: 'INFO',
  randomSeed: 42,
  language: 'typescript',
  fileSuffix: '.ts',

  llm: {
    apiBase: 'https://api.openai.com/v1',
    temperature: 0.7,
    topP: 0.95,
    maxTokens: 4096,
    timeout: 60,
    retries: 3,
    retryDelay: 5,
    models: [],
    evaluatorModels: [],
    weight: 1.0,
  },

  prompt: {
    systemMessage: 'system_message',
    evaluatorSystemMessage: 'evaluator_system_message',
    numTopPrograms: 3,
    numDiversePrograms: 2,
    useTemplateStochasticity: true,
    templateVariations: {},
    useMetaPrompting: false,
    metaPromptWeight: 0.1,
    includeArtifacts: true,
    maxArtifactBytes: 20 * 1024,
    artifactSecurityFilter: true,
    suggestSimplificationAfterChars: 500,
    includeChangesUnderChars: 100,
    conciseImplementationMaxLines: 10,
    comprehensiveImplementationMinLines: 50,
  },

  database: {
    inMemory: true,
    logPrompts: true,
    populationSize: 1000,
    archiveSize: 100,
    numIslands: 5,
    eliteSelectionRatio: 0.1,
    explorationRatio: 0.2,
    exploitationRatio: 0.7,
    diversityMetric: 'edit_distance',
    featureDimensions: ['complexity', 'diversity'],
    featureBins: 10,
    diversityReferenceSize: 20,
    migrationInterval: 50,
    migrationRate: 0.1,
    randomSeed: 42,
    artifactSizeThreshold: 32 * 1024,
    cleanupOldArtifacts: true,
    artifactRetentionDays: 30,
    similarityThreshold: 0.99,
  },

  evaluator: {
    timeout: 300,
    maxRetries: 3,
    cascadeEvaluation: true,
    cascadeThresholds: [0.5, 0.75, 0.9],
    parallelEvaluations: 1,
    distributed: false,
    useLlmFeedback: false,
    llmFeedbackWeight: 0.1,
    enableArtifacts: true,
    maxArtifactStorage: 100 * 1024 * 1024,
  },

  evolutionTrace: {
    enabled: false,
    format: 'jsonl',
    includeCode: false,
    includePrompts: true,
    bufferSize: 10,
    compress: false,
  },

  pacevolve: {
    enableHCM: true,
    ideaMemorySize: 50,
    pruningThreshold: 0.3,
    pruningInterval: 10,
    maxIdeas: 20,
    maxHypothesesPerIdea: 10,
    ideaDistinctnessThreshold: 0.75,
    ideaSummaryMaxChars: 280,
    hypothesisSummaryMaxChars: 180,
    enableMBB: true,
    momentumWindowSize: 10,
    stagnationThreshold: 0.001,
    backtrackDepth: 5,
    momentumBeta: 0.9,
    backtrackPower: 1.5,
    enableCE: true,
    initialExploreProb: 0.3,
    initialExploitProb: 0.5,
    initialBacktrackProb: 0.2,
    adaptationRate: 0.1,
    crossoverFrequency: 20,
  },

  diffBasedEvolution: true,
  maxCodeLength: 10000,
  diffPattern: '<<<<<<< SEARCH\\n(.*?)=======\\n(.*?)>>>>>>> REPLACE',
  convergenceThreshold: 0.001,
  earlyStoppingMetric: 'combined_score',
};

/**
 * Resolve environment variable references in strings
 */
function resolveEnvVar(value: string | undefined): string | undefined {
  if (!value) return value;

  const envVarPattern = /^\$\{([^}]+)\}$/;
  const match = value.match(envVarPattern);

  if (match) {
    const varName = match[1];
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable ${varName} is not set`);
    }
    return envValue;
  }

  return value;
}

/**
 * Load configuration from YAML file
 */
export function loadConfig(configPath?: string): Config {
  let config: Config;

  if (configPath && fs.existsSync(configPath)) {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const parsed = yaml.load(fileContents) as Partial<Config>;
    config = { ...DEFAULT_CONFIG, ...parsed };
  } else {
    config = { ...DEFAULT_CONFIG };
  }

  // Resolve environment variables
  if (config.llm.apiKey) {
    config.llm.apiKey = resolveEnvVar(config.llm.apiKey);
  }

  // Use environment variables if available
  const apiKey = process.env.OPENAI_API_KEY;
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

  if (apiKey && !config.llm.apiKey) {
    config.llm.apiKey = apiKey;
  }
  if (!config.llm.apiBase) {
    config.llm.apiBase = apiBase;
  }

  // Handle backwards compatibility for primary/secondary models
  if (config.llm.primaryModel) {
    config.llm.models.push({
      name: config.llm.primaryModel,
      weight: config.llm.primaryModelWeight || 1.0,
    });
  }

  if (config.llm.secondaryModel && (config.llm.secondaryModelWeight ?? 0.2) > 0) {
    config.llm.models.push({
      name: config.llm.secondaryModel,
      weight: config.llm.secondaryModelWeight || 0.2,
    });
  }

  // Ensure at least one model
  if (config.llm.models.length === 0) {
    config.llm.models.push({
      name: 'gpt-4o-mini',
      weight: 1.0,
    });
  }

  // If no evaluator models, use same as evolution models
  if (config.llm.evaluatorModels.length === 0) {
    config.llm.evaluatorModels = [...config.llm.models];
  }

  // Update model configs with shared values
  const sharedConfig = {
    apiBase: config.llm.apiBase,
    apiKey: config.llm.apiKey,
    temperature: config.llm.temperature,
    topP: config.llm.topP,
    maxTokens: config.llm.maxTokens,
    timeout: config.llm.timeout,
    retries: config.llm.retries,
    retryDelay: config.llm.retryDelay,
    randomSeed: config.llm.randomSeed,
    reasoningEffort: config.llm.reasoningEffort,
  };

  for (const model of [...config.llm.models, ...config.llm.evaluatorModels]) {
    Object.assign(model, { ...sharedConfig, ...model });
  }

  return config;
}

/**
 * Save configuration to YAML file
 */
export function saveConfig(config: Config, configPath: string): void {
  const yamlStr = yaml.dump(config);
  fs.writeFileSync(configPath, yamlStr, 'utf8');
}
