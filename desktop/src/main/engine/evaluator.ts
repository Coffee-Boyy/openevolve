/**
 * Evaluator system for OpenEvolve
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Worker } from 'worker_threads';
import * as ts from 'typescript';
import { EvaluationResult } from './types';
import { EvaluatorConfig } from './config';
import { LLMEnsemble } from './llm/ensemble';
import { PromptSampler } from './prompt/sampler';

/**
 * Evaluator for programs
 */
export class Evaluator {
  private config: EvaluatorConfig;
  private evaluationFile: string;
  private programSuffix: string;
  private llmEnsemble?: LLMEnsemble;
  private promptSampler?: PromptSampler;
  private pendingArtifacts: Map<string, Record<string, any>>;
  private evaluationModule: any;

  constructor(
    config: EvaluatorConfig,
    evaluationFile: string,
    llmEnsemble?: LLMEnsemble,
    promptSampler?: PromptSampler,
    suffix: string = '.ts'
  ) {
    this.config = config;
    this.evaluationFile = evaluationFile;
    this.programSuffix = suffix;
    this.llmEnsemble = llmEnsemble;
    this.promptSampler = promptSampler;
    this.pendingArtifacts = new Map();
    this.evaluationModule = null;

    console.log(`Initialized evaluator with ${evaluationFile}`);
  }

  /**
   * Initialize the evaluator (must be called after construction)
   */
  async initialize(): Promise<void> {
    await this.loadEvaluationFunction();
  }

  /**
   * Load the evaluation function from the evaluation file
   */
  private async loadEvaluationFunction(): Promise<void> {
    if (!fs.existsSync(this.evaluationFile)) {
      throw new Error(`Evaluation file ${this.evaluationFile} not found`);
    }

    try {
      let resolvedPath = path.resolve(this.evaluationFile);
      
      // If the file is TypeScript, compile it to JavaScript first
      if (this.evaluationFile.endsWith('.ts')) {
        resolvedPath = await this.compileTypeScriptFile(this.evaluationFile);
      }
      
      // Convert to file:// URL for dynamic import
      const fileUrl = `file://${resolvedPath}`;
      
      // Add cache busting for hot reloading
      const moduleUrl = `${fileUrl}?t=${Date.now()}`;
      
      // Load the module
      this.evaluationModule = await import(moduleUrl);

      if (!this.evaluationModule.evaluate) {
        throw new Error(
          `Evaluation file ${this.evaluationFile} does not export an 'evaluate' function`
        );
      }

      // Validate cascade configuration
      this.validateCascadeConfiguration();

      console.log(`Successfully loaded evaluation function from ${this.evaluationFile}`);
    } catch (error) {
      console.error(`Error loading evaluation function:`, error);
      throw error;
    }
  }

  /**
   * Compile a TypeScript file to JavaScript
   */
  private async compileTypeScriptFile(tsFilePath: string): Promise<string> {
    // Check if TypeScript is available
    if (!ts || typeof ts.transpileModule !== 'function') {
      throw new Error(
        'TypeScript compiler is not available. Please ensure typescript is installed as a dependency.'
      );
    }

    try {
      const tsCode = fs.readFileSync(tsFilePath, 'utf8');
      
      // Compile TypeScript to JavaScript
      const result = ts.transpileModule(tsCode, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
        },
      });

      // Write compiled JavaScript to a temporary file in the same directory
      const jsFilePath = tsFilePath.replace(/\.ts$/, '.js');
      fs.writeFileSync(jsFilePath, result.outputText);

      console.log(`Compiled TypeScript file ${tsFilePath} to ${jsFilePath}`);
      return jsFilePath;
    } catch (error) {
      throw new Error(
        `Failed to compile TypeScript file ${tsFilePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate cascade evaluation configuration
   */
  private validateCascadeConfiguration(): void {
    if (this.config.cascadeEvaluation) {
      const hasStage1 = !!this.evaluationModule.evaluate_stage1;
      const hasStage2 = !!this.evaluationModule.evaluate_stage2;
      const hasStage3 = !!this.evaluationModule.evaluate_stage3;

      if (!hasStage1) {
        console.warn(
          `Configuration has 'cascadeEvaluation: true' but evaluator '${this.evaluationFile}' does not define 'evaluate_stage1' function. ` +
            `This will fall back to direct evaluation.`
        );
      } else if (!hasStage2 && !hasStage3) {
        console.warn(
          `Evaluator '${this.evaluationFile}' defines 'evaluate_stage1' but no additional cascade stages.`
        );
      }
    }
  }

  /**
   * Evaluate a program
   */
  async evaluateProgram(
    programCode: string,
    programId: string = ''
  ): Promise<Record<string, number>> {
    // Ensure evaluator is initialized
    if (!this.evaluationModule) {
      await this.initialize();
    }

    const startTime = Date.now();
    const programIdStr = programId ? ` ${programId}` : '';

    const artifactsEnabled = process.env.ENABLE_ARTIFACTS !== 'false';

    // Retry logic
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries + 1; attempt++) {
      // Create temporary file for program
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openevolve-'));
      const tempFilePath = path.join(tmpDir, `program${this.programSuffix}`);

      try {
        fs.writeFileSync(tempFilePath, programCode);

        // Run evaluation
        let result: EvaluationResult;
        if (this.config.cascadeEvaluation) {
          result = await this.cascadeEvaluate(tempFilePath);
        } else {
          result = await this.directEvaluate(tempFilePath);
        }

        // Store artifacts if enabled
        if (artifactsEnabled && result.artifacts && programId) {
          this.pendingArtifacts.set(programId, result.artifacts);
        }

        // Add LLM feedback if configured
        if (this.config.useLlmFeedback && this.llmEnsemble) {
          const llmResult = await this.llmEvaluate(programCode, programId);
          if (llmResult.metrics) {
            for (const [name, value] of Object.entries(llmResult.metrics)) {
              result.metrics[`llm_${name}`] =
                value * this.config.llmFeedbackWeight;
            }
          }
        }

        const elapsed = Date.now() - startTime;
        console.log(
          `Evaluated program${programIdStr} in ${elapsed}ms: ${JSON.stringify(result.metrics)}`
        );

        return result.metrics;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `Evaluation attempt ${attempt + 1}/${this.config.maxRetries + 1} failed for program${programIdStr}:`,
          error
        );

        if (artifactsEnabled && programId) {
          this.pendingArtifacts.set(programId, {
            stderr: (error as Error).message,
            failureStage: 'evaluation',
            attempt: attempt + 1,
          });
        }

        if (attempt < this.config.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } finally {
        // Cleanup
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }

    console.error(
      `All evaluation attempts failed for program${programIdStr}. Last error:`,
      lastError
    );
    return { error: 0.0 };
  }

  /**
   * Direct evaluation
   */
  private async directEvaluate(programPath: string): Promise<EvaluationResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Evaluation timed out after ${this.config.timeout}s`));
      }, this.config.timeout * 1000);

      try {
        const result = this.evaluationModule.evaluate(programPath);

        // Handle promise or direct return
        if (result && typeof result.then === 'function') {
          result
            .then((value: any) => {
              clearTimeout(timeout);
              resolve(this.processEvaluationResult(value));
            })
            .catch((error: Error) => {
              clearTimeout(timeout);
              reject(error);
            });
        } else {
          clearTimeout(timeout);
          resolve(this.processEvaluationResult(result));
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Cascade evaluation
   */
  private async cascadeEvaluate(programPath: string): Promise<EvaluationResult> {
    try {
      if (!this.evaluationModule.evaluate_stage1) {
        return this.directEvaluate(programPath);
      }

      // Run stage 1
      let stage1Result: EvaluationResult;
      try {
        stage1Result = await this.runEvaluationStage(
          this.evaluationModule.evaluate_stage1,
          programPath
        );
      } catch (error) {
        return {
          metrics: { stage1_passed: 0.0, error: 0.0 },
          artifacts: {
            stderr: (error as Error).message,
            failureStage: 'stage1',
          },
        };
      }

      // Check threshold
      if (!this.passesThreshold(stage1Result.metrics, this.config.cascadeThresholds[0])) {
        return stage1Result;
      }

      // Run stage 2 if available
      if (this.evaluationModule.evaluate_stage2) {
        try {
          const stage2Result = await this.runEvaluationStage(
            this.evaluationModule.evaluate_stage2,
            programPath
          );
          // Merge results
          stage1Result.metrics = { ...stage1Result.metrics, ...stage2Result.metrics };
          stage1Result.artifacts = {
            ...stage1Result.artifacts,
            ...stage2Result.artifacts,
          };
        } catch (error) {
          stage1Result.metrics.stage2_passed = 0.0;
          if (stage1Result.artifacts) {
            stage1Result.artifacts.stage2_stderr = (error as Error).message;
            stage1Result.artifacts.failureStage = 'stage2';
          }
          return stage1Result;
        }

        // Check threshold for stage 3
        if (
          this.config.cascadeThresholds.length >= 2 &&
          this.passesThreshold(stage1Result.metrics, this.config.cascadeThresholds[1])
        ) {
          if (this.evaluationModule.evaluate_stage3) {
            try {
              const stage3Result = await this.runEvaluationStage(
                this.evaluationModule.evaluate_stage3,
                programPath
              );
              stage1Result.metrics = {
                ...stage1Result.metrics,
                ...stage3Result.metrics,
              };
              stage1Result.artifacts = {
                ...stage1Result.artifacts,
                ...stage3Result.artifacts,
              };
            } catch (error) {
              stage1Result.metrics.stage3_passed = 0.0;
              if (stage1Result.artifacts) {
                stage1Result.artifacts.stage3_stderr = (error as Error).message;
                stage1Result.artifacts.failureStage = 'stage3';
              }
            }
          }
        }
      }

      return stage1Result;
    } catch (error) {
      return {
        metrics: { stage1_passed: 0.0, error: 0.0 },
        artifacts: {
          stderr: (error as Error).message,
          failureStage: 'cascade_setup',
        },
      };
    }
  }

  /**
   * Run a single evaluation stage
   */
  private async runEvaluationStage(
    stageFunction: Function,
    programPath: string
  ): Promise<EvaluationResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Evaluation stage timed out after ${this.config.timeout}s`));
      }, this.config.timeout * 1000);

      try {
        const result = stageFunction(programPath);

        if (result && typeof result.then === 'function') {
          result
            .then((value: any) => {
              clearTimeout(timeout);
              resolve(this.processEvaluationResult(value));
            })
            .catch((error: Error) => {
              clearTimeout(timeout);
              reject(error);
            });
        } else {
          clearTimeout(timeout);
          resolve(this.processEvaluationResult(result));
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * LLM-based evaluation
   */
  private async llmEvaluate(
    programCode: string,
    programId: string = ''
  ): Promise<EvaluationResult> {
    if (!this.llmEnsemble || !this.promptSampler) {
      return { metrics: {} };
    }

    try {
      const prompt = this.promptSampler.buildPrompt({
        currentProgram: programCode,
        templateKey: 'evaluation',
      });

      const responses = await this.llmEnsemble.generateAllWithContext(
        prompt.system,
        [{ role: 'user', content: prompt.user }]
      );

      // Parse JSON responses
      const allMetrics: Record<string, number> = {};
      for (const response of responses) {
        try {
          const jsonMatch = response.match(/```json\n(.*?)\n```/s);
          const jsonStr = jsonMatch ? jsonMatch[1] : response;
          const result = JSON.parse(jsonStr);

          for (const [key, value] of Object.entries(result)) {
            if (typeof value === 'number') {
              allMetrics[key] = (allMetrics[key] || 0) + value / responses.length;
            }
          }
        } catch (error) {
          console.warn('Error parsing LLM response:', error);
        }
      }

      return { metrics: allMetrics };
    } catch (error) {
      console.error('Error in LLM evaluation:', error);
      return { metrics: {} };
    }
  }

  /**
   * Process evaluation result
   */
  private processEvaluationResult(result: any): EvaluationResult {
    if (result && typeof result === 'object') {
      if ('metrics' in result) {
        return result as EvaluationResult;
      }
      // Assume it's a metrics object
      return { metrics: result };
    }
    return { metrics: { error: 0.0 } };
  }

  /**
   * Check if metrics pass threshold
   */
  private passesThreshold(metrics: Record<string, number>, threshold: number): boolean {
    if (!metrics) return false;

    if ('combined_score' in metrics) {
      return metrics.combined_score >= threshold;
    }

    // Average numeric metrics
    const values = Object.entries(metrics)
      .filter(([key, val]) => key !== 'error' && typeof val === 'number')
      .map(([, val]) => val);

    if (values.length === 0) return false;

    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return avg >= threshold;
  }

  /**
   * Get and clear pending artifacts for a program
   */
  getPendingArtifacts(programId: string): Record<string, any> | undefined {
    const artifacts = this.pendingArtifacts.get(programId);
    this.pendingArtifacts.delete(programId);
    return artifacts;
  }
}
