/**
 * Momentum-Based Backtracking (MBB) for PACEvolve
 * 
 * Detects stagnation and escapes local minima by tracking momentum
 * and backtracking to previous promising states when stuck.
 */

import { Program, ProgressMetrics } from '../types';
import { PACEvolveConfig } from '../config';

/**
 * Momentum tracker for detecting stagnation
 */
export class MomentumTracker {
  private config: PACEvolveConfig;
  private states: Map<number, {
    recentRelativeImprovements: number[];
    momentum: number;
    backtrackHistory: Array<{ iteration: number; program: Program }>;
    iterationsSinceImprovement: number;
    currentBestScore: number;
    initialScore: number | null;
  }>;

  constructor(config: PACEvolveConfig) {
    this.config = config;
    this.states = new Map();

    console.log('Initialized Momentum-Based Backtracking (MBB)');
  }

  /**
   * Update momentum with new program score
   */
  update(program: Program, iteration: number, islandId: number, targetScore?: number): void {
    if (!this.config.enableMBB) return;

    const state = this.getState(islandId);
    const score = program.metrics.combined_score || 0;

    if (state.initialScore === null) {
      state.initialScore = score;
    }

    // Update best score if improved
    let relativeImprovement = 0;
    if (score > state.currentBestScore) {
      const previousBest =
        state.currentBestScore === -Infinity ? state.initialScore || score : state.currentBestScore;
      const gapDenominator = this.relativeGap(previousBest, targetScore);
      relativeImprovement = (score - previousBest) / gapDenominator;

      state.currentBestScore = score;
      state.iterationsSinceImprovement = 0;

      // Store as potential backtrack point
      state.backtrackHistory.push({
        iteration,
        program: { ...program },
      });

      // Limit history size
      if (state.backtrackHistory.length > this.config.backtrackDepth) {
        state.backtrackHistory.shift();
      }
    } else {
      state.iterationsSinceImprovement++;
    }

    // Add improvement to recent window
    state.recentRelativeImprovements.push(relativeImprovement);

    // Keep window size limited
    const windowSize = this.config.momentumWindowSize;
    if (state.recentRelativeImprovements.length > windowSize) {
      state.recentRelativeImprovements.shift();
    }

    // Calculate momentum as EWMA of relative improvements
    const beta = this.config.momentumBeta;
    const latest = state.recentRelativeImprovements.at(-1) || 0;
    state.momentum = beta * state.momentum + (1 - beta) * latest;
  }

  /**
   * Check if should backtrack
   */
  shouldBacktrack(islandId: number): boolean {
    if (!this.config.enableMBB) return false;
    const state = this.getState(islandId);
    if (state.backtrackHistory.length === 0) return false;

    // Backtrack if:
    // 1. Momentum is very low (stagnation detected)
    // 2. No improvement for many iterations
    const momentumStagnation =
      Math.abs(state.momentum) < this.config.stagnationThreshold;
    const longStagnation =
      state.iterationsSinceImprovement > this.config.momentumWindowSize * 2;

    return (momentumStagnation && longStagnation) || state.iterationsSinceImprovement > 50;
  }

  /**
   * Get a program to backtrack to
   */
  getBacktrackTarget(islandId: number): Program | null {
    if (!this.config.enableMBB) return null;
    const state = this.getState(islandId);
    if (state.backtrackHistory.length === 0) return null;

    const history = state.backtrackHistory;
    const targetIndex = this.samplePowerLawIndex(
      Math.max(1, history.length - 1)
    );
    const target = history[Math.min(targetIndex, history.length - 1)];

    console.log(
      `Backtracking to iteration ${target.iteration} (score: ${target.program.metrics.combined_score})`
    );

    // Reset momentum after backtrack
    state.recentRelativeImprovements = [];
    state.momentum = 0;
    state.iterationsSinceImprovement = 0;

    return target.program;
  }

  /**
   * Get current progress metrics
   */
  getProgressMetrics(islandId: number): ProgressMetrics {
    const state = this.getState(islandId);
    return {
      recentImprovements: [...state.recentRelativeImprovements],
      momentum: state.momentum,
      iterationsSinceImprovement: state.iterationsSinceImprovement,
      currentBestScore: state.currentBestScore,
    };
  }

  /**
   * Reset tracker
   */
  reset(islandId?: number): void {
    if (islandId === undefined) {
      this.states.clear();
      return;
    }

    const state = this.getState(islandId);
    state.recentRelativeImprovements = [];
    state.momentum = 0;
    state.iterationsSinceImprovement = 0;
    state.currentBestScore = -Infinity;
    state.initialScore = null;
    state.backtrackHistory = [];
  }

  private getState(islandId: number) {
    if (!this.states.has(islandId)) {
      this.states.set(islandId, {
        recentRelativeImprovements: [],
        momentum: 0,
        backtrackHistory: [],
        iterationsSinceImprovement: 0,
        currentBestScore: -Infinity,
        initialScore: null,
      });
    }

    return this.states.get(islandId)!;
  }

  private relativeGap(previousBest: number, targetScore?: number): number {
    if (targetScore !== undefined) {
      return Math.max(Math.abs(targetScore - previousBest), 1e-6);
    }
    return Math.max(Math.abs(previousBest), 1e-6);
  }

  private samplePowerLawIndex(count: number): number {
    const power = this.config.backtrackPower;
    const weights = Array(count)
      .fill(null)
      .map((_, idx) => 1 / Math.pow(idx + 1, power));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let rand = Math.random() * total;

    for (let i = 0; i < weights.length; i++) {
      rand -= weights[i];
      if (rand <= 0) {
        return i;
      }
    }

    return count - 1;
  }
}
