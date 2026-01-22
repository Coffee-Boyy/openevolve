/**
 * Main Evolution Engine controller with PACEvolve integration
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

import { Config } from './config';
import { Program, ProgressData, EvolutionStatus } from './types';
import { ProgramDatabase } from './database';
import { Evaluator } from './evaluator';
import { LLMEnsemble } from './llm/ensemble';
import { PromptSampler } from './prompt/sampler';
import { HierarchicalContextManager } from './pacevolve/context-manager';
import { MomentumTracker } from './pacevolve/backtracking';
import { CollaborativeEvolution } from './pacevolve/collaborative';

/**
 * Main Evolution Engine
 */
export class EvolutionEngine extends EventEmitter {
  private config: Config;
  private database: ProgramDatabase;
  private evaluator: Evaluator;
  private llmEnsemble: LLMEnsemble;
  private promptSampler: PromptSampler;
  private outputDir: string;
  private runId: string;
  private status: EvolutionStatus;
  private shouldStop: boolean;

  // PACEvolve components
  private contextManager: HierarchicalContextManager;
  private momentumTracker: MomentumTracker;
  private collaborative: CollaborativeEvolution;

  constructor(
    initialProgramPath: string,
    evaluationFile: string,
    config: Config,
    outputDir?: string
  ) {
    super();

    this.config = config;
    this.runId = uuidv4();
    this.shouldStop = false;

    // Set up output directory
    this.outputDir =
      outputDir ||
      path.join(path.dirname(initialProgramPath), 'openevolve_output');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Initialize components
    this.llmEnsemble = new LLMEnsemble(config.llm.models);
    this.promptSampler = new PromptSampler(config.prompt);
    this.database = new ProgramDatabase(config.database);

    this.evaluator = new Evaluator(
      config.evaluator,
      evaluationFile,
      this.llmEnsemble,
      this.promptSampler,
      config.fileSuffix
    );

    // Initialize PACEvolve components
    this.contextManager = new HierarchicalContextManager(config.pacevolve);
    this.momentumTracker = new MomentumTracker(config.pacevolve);
    this.collaborative = new CollaborativeEvolution(config.pacevolve);

    // Initialize status
    this.status = {
      status: 'idle',
      iteration: 0,
      totalIterations: config.maxIterations,
      bestScore: null,
      startTime: null,
    };

    // Load initial program
    this.loadInitialProgram(initialProgramPath);

    console.log(`Initialized Evolution Engine with run ID: ${this.runId}`);
  }

  /**
   * Load the initial program
   */
  private async loadInitialProgram(programPath: string): Promise<void> {
    const code = fs.readFileSync(programPath, 'utf8');
    const programId = uuidv4();

    // Evaluate initial program
    const metrics = await this.evaluator.evaluateProgram(code, programId);

    const initialProgram: Program = {
      id: programId,
      code,
      language: this.config.language,
      generation: 0,
      timestamp: Date.now(),
      iterationFound: 0,
      metrics,
      complexity: code.length,
      diversity: 0,
      metadata: {},
    };

    this.database.add(initialProgram, 0);
    console.log(`Loaded initial program: ${programId}`);
  }

  /**
   * Run the evolution process
   */
  async run(maxIterations?: number, targetScore?: number): Promise<Program | null> {
    const iterations = maxIterations || this.config.maxIterations;

    this.status = {
      status: 'running',
      iteration: 0,
      totalIterations: iterations,
      bestScore: null,
      startTime: Date.now(),
    };

    this.emit('status', this.status);

    console.log(`Starting evolution for ${iterations} iterations`);

    for (let iteration = 1; iteration <= iterations && !this.shouldStop; iteration++) {
      try {
        await this.runIteration(iteration);

        // Check target score
        if (targetScore !== undefined) {
          const best = this.database.getBestProgram();
          if (best && best.metrics.combined_score >= targetScore) {
            console.log(`Target score ${targetScore} reached!`);
            break;
          }
        }

        // Checkpoint
        if (iteration % this.config.checkpointInterval === 0) {
          this.saveCheckpoint(iteration);
        }

        // Update status
        this.status.iteration = iteration;
        const best = this.database.getBestProgram();
        this.status.bestScore = best ? best.metrics.combined_score : null;
        this.emit('status', this.status);

      } catch (error) {
        console.error(`Error in iteration ${iteration}:`, error);
        this.emit('error', error);
      }
    }

    this.status.status = 'completed';
    this.emit('status', this.status);

    const bestProgram = this.database.getBestProgram();
    if (bestProgram) {
      this.saveBestProgram(bestProgram);
    }

    return bestProgram;
  }

  /**
   * Run a single iteration with PACEvolve integration
   */
  private async runIteration(iteration: number): Promise<void> {
    // 1. Check if should backtrack (MBB)
    if (this.momentumTracker.shouldBacktrack()) {
      const backtrackTarget = this.momentumTracker.getBacktrackTarget();
      if (backtrackTarget) {
        console.log(`Backtracking at iteration ${iteration}`);
        // Create new program from backtrack target
        const newProgram: Program = {
          ...backtrackTarget,
          id: uuidv4(),
          parentId: backtrackTarget.id,
          generation: backtrackTarget.generation + 1,
          timestamp: Date.now(),
          iterationFound: iteration,
          metadata: {
            ...backtrackTarget.metadata,
            backtracked: true,
          },
        };
        this.database.add(newProgram, iteration);
        return;
      }
    }

    // 2. Check if should perform crossover (CE)
    if (this.collaborative.shouldPerformCrossover(iteration)) {
      const [island1, island2] = this.collaborative.selectIslandsForCrossover(
        this.config.database.numIslands
      );
      const offspring = this.collaborative.performCrossover(
        this.database,
        island1,
        island2
      );
      if (offspring) {
        // Evaluate and add offspring
        const metrics = await this.evaluator.evaluateProgram(offspring.code, offspring.id);
        offspring.metrics = metrics;
        this.database.add(offspring, iteration);
        return;
      }
    }

    // 3. Decide action via adaptive policy (CE)
    const action = this.collaborative.samplingPolicy.sample();

    // 4. Execute action with managed context (HCM)
    let parent: Program;
    let inspirations: Program[];

    // Round-robin island selection
    const islandId = iteration % this.config.database.numIslands;
    [parent, inspirations] = this.database.sampleFromIsland(
      islandId,
      this.config.prompt.numTopPrograms
    );

    // Get context from HCM
    const generationContext = this.contextManager.getGenerationContext();

    // Build prompt
    const prompt = this.promptSampler.buildPrompt({
      currentProgram: parent.code,
      programMetrics: parent.metrics,
      topPrograms: inspirations.map((p) => ({ code: p.code, metrics: p.metrics })),
      language: this.config.language,
      evolutionRound: iteration,
      diffBasedEvolution: this.config.diffBasedEvolution,
      featureDimensions: this.config.database.featureDimensions,
    });

    // Generate code
    const llmResponse = await this.llmEnsemble.generateWithContext(
      prompt.system,
      [{ role: 'user', content: prompt.user }]
    );

    // Parse response
    let childCode: string;
    if (this.config.diffBasedEvolution) {
      childCode = this.applyDiff(parent.code, llmResponse);
    } else {
      childCode = this.parseFullRewrite(llmResponse);
    }

    // Create child program
    const childId = uuidv4();
    const childMetrics = await this.evaluator.evaluateProgram(childCode, childId);

    const childProgram: Program = {
      id: childId,
      code: childCode,
      language: this.config.language,
      parentId: parent.id,
      generation: parent.generation + 1,
      timestamp: Date.now(),
      iterationFound: iteration,
      metrics: childMetrics,
      complexity: childCode.length,
      diversity: 0,
      metadata: {
        island: islandId,
        action,
      },
    };

    // Add to database
    this.database.add(childProgram, iteration, islandId);

    // Update PACEvolve components
    this.contextManager.addIdea(childProgram, iteration);
    this.momentumTracker.update(childProgram, iteration);

    const progress = this.momentumTracker.getProgressMetrics();
    this.collaborative.updatePolicy(progress);

    // Prune stale ideas periodically
    if (iteration % this.config.pacevolve.pruningInterval === 0) {
      this.contextManager.pruneStaleIdeas(iteration);
    }

    // Increment island generation
    this.database.incrementIslandGeneration(islandId);

    // Check migration
    if (this.database.shouldMigrate()) {
      this.database.migratePrograms();
    }

    // Emit progress
    const progressData: ProgressData = {
      iteration,
      bestScore: childProgram.metrics.combined_score,
      metrics: childProgram.metrics,
      bestProgramId: childProgram.id,
    };
    this.emit('progress', progressData);

    console.log(
      `Iteration ${iteration}: Program ${childProgram.id} (fitness: ${childProgram.metrics.combined_score?.toFixed(4)})`
    );
  }

  /**
   * Apply diff to code
   */
  private applyDiff(originalCode: string, llmResponse: string): string {
    const { parseDiff, applyDiffs } = require('./utils');
    const diffs = parseDiff(llmResponse, this.config.diffPattern);

    if (diffs.length === 0) {
      console.warn('No diff blocks found, returning original code');
      return originalCode;
    }

    return applyDiffs(originalCode, diffs);
  }

  /**
   * Parse full rewrite from LLM response
   */
  private parseFullRewrite(llmResponse: string): string {
    const { extractCode } = require('./utils');
    const code = extractCode(llmResponse, this.config.language);
    return code || llmResponse;
  }

  /**
   * Save checkpoint
   */
  private saveCheckpoint(iteration: number): void {
    const checkpointDir = path.join(this.outputDir, 'checkpoints', `checkpoint_${iteration}`);
    this.database.save(checkpointDir, iteration);
    console.log(`Saved checkpoint at iteration ${iteration}`);
  }

  /**
   * Save best program
   */
  private saveBestProgram(program: Program): void {
    const bestDir = path.join(this.outputDir, 'best');
    if (!fs.existsSync(bestDir)) {
      fs.mkdirSync(bestDir, { recursive: true });
    }

    const filename = `best_program${this.config.fileSuffix}`;
    fs.writeFileSync(path.join(bestDir, filename), program.code);

    const infoPath = path.join(bestDir, 'best_program_info.json');
    fs.writeFileSync(
      infoPath,
      JSON.stringify(
        {
          id: program.id,
          generation: program.generation,
          iteration: program.iterationFound,
          timestamp: program.timestamp,
          metrics: program.metrics,
          language: program.language,
        },
        null,
        2
      )
    );

    console.log(`Saved best program to ${bestDir}`);
  }

  /**
   * Stop the evolution process
   */
  stop(): void {
    this.shouldStop = true;
    console.log('Stopping evolution...');
  }

  /**
   * Get current status
   */
  getStatus(): EvolutionStatus {
    return { ...this.status };
  }

  /**
   * Get run ID
   */
  getRunId(): string {
    return this.runId;
  }
}
