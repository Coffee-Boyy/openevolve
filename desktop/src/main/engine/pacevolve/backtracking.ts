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
  private recentImprovements: number[];
  private momentum: number;
  private backtrackHistory: Array<{ iteration: number; program: Program }>;
  private iterationsSinceImprovement: number;
  private currentBestScore: number;

  constructor(config: PACEvolveConfig) {
    this.config = config;
    this.recentImprovements = [];
    this.momentum = 0;
    this.backtrackHistory = [];
    this.iterationsSinceImprovement = 0;
    this.currentBestScore = -Infinity;

    console.log('Initialized Momentum-Based Backtracking (MBB)');
  }

  /**
   * Update momentum with new program score
   */
  update(program: Program, iteration: number): void {
    if (!this.config.enableMBB) return;

    const score = program.metrics.combined_score || 0;

    // Calculate improvement
    let improvement = 0;
    if (this.currentBestScore !== -Infinity) {
      improvement = score - this.currentBestScore;
    }

    // Update best score if improved
    if (score > this.currentBestScore) {
      this.currentBestScore = score;
      this.iterationsSinceImprovement = 0;

      // Store as potential backtrack point
      this.backtrackHistory.push({
        iteration,
        program: { ...program },
      });

      // Limit history size
      if (this.backtrackHistory.length > this.config.backtrackDepth) {
        this.backtrackHistory.shift();
      }
    } else {
      this.iterationsSinceImprovement++;
    }

    // Add improvement to recent window
    this.recentImprovements.push(improvement);

    // Keep window size limited
    const windowSize = this.config.momentumWindowSize;
    if (this.recentImprovements.length > windowSize) {
      this.recentImprovements.shift();
    }

    // Calculate momentum as average improvement rate
    this.momentum =
      this.recentImprovements.reduce((sum, imp) => sum + imp, 0) /
      Math.max(this.recentImprovements.length, 1);
  }

  /**
   * Check if should backtrack
   */
  shouldBacktrack(): boolean {
    if (!this.config.enableMBB) return false;
    if (this.backtrackHistory.length === 0) return false;

    // Backtrack if:
    // 1. Momentum is very low (stagnation detected)
    // 2. No improvement for many iterations
    const momentumStagnation = Math.abs(this.momentum) < this.config.stagnationThreshold;
    const longStagnation = this.iterationsSinceImprovement > this.config.momentumWindowSize * 2;

    return (momentumStagnation && longStagnation) || this.iterationsSinceImprovement > 50;
  }

  /**
   * Get a program to backtrack to
   */
  getBacktrackTarget(): Program | null {
    if (!this.config.enableMBB) return null;
    if (this.backtrackHistory.length === 0) return null;

    // Choose a recent high-performing state (not the most recent, to explore alternative paths)
    const targetIndex = Math.min(
      this.backtrackHistory.length - 2,
      Math.floor(this.backtrackHistory.length * 0.7)
    );

    const target = this.backtrackHistory[Math.max(0, targetIndex)];

    console.log(
      `Backtracking to iteration ${target.iteration} (score: ${target.program.metrics.combined_score})`
    );

    // Reset momentum after backtrack
    this.recentImprovements = [];
    this.momentum = 0;
    this.iterationsSinceImprovement = 0;

    return target.program;
  }

  /**
   * Get current progress metrics
   */
  getProgressMetrics(): ProgressMetrics {
    return {
      recentImprovements: [...this.recentImprovements],
      momentum: this.momentum,
      iterationsSinceImprovement: this.iterationsSinceImprovement,
      currentBestScore: this.currentBestScore,
    };
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.recentImprovements = [];
    this.momentum = 0;
    this.iterationsSinceImprovement = 0;
  }
}
