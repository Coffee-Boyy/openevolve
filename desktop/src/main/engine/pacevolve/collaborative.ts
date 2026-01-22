/**
 * Self-Adaptive Collaborative Evolution (CE) for PACEvolve
 * 
 * Coordinates parallel search trajectories with dynamic crossover
 * and adaptive sampling policy (explore vs exploit vs backtrack).
 */

import { v4 as uuidv4 } from 'uuid';
import { Program, ProgressMetrics } from '../types';
import { PACEvolveConfig } from '../config';
import { ProgramDatabase } from '../database';

/**
 * Adaptive sampling policy
 */
export class AdaptiveSamplingPolicy {
  private config: PACEvolveConfig;
  public exploreProb: number;
  public exploitProb: number;
  public backtrackProb: number;

  constructor(config: PACEvolveConfig) {
    this.config = config;
    this.exploreProb = config.initialExploreProb;
    this.exploitProb = config.initialExploitProb;
    this.backtrackProb = config.initialBacktrackProb;

    this.normalize();
  }

  /**
   * Sample an action based on current probabilities
   */
  sample(): 'explore' | 'exploit' | 'backtrack' {
    const rand = Math.random();

    if (rand < this.exploreProb) {
      return 'explore';
    } else if (rand < this.exploreProb + this.exploitProb) {
      return 'exploit';
    } else {
      return 'backtrack';
    }
  }

  /**
   * Update probabilities based on progress
   */
  update(progress: ProgressMetrics, absoluteProgress?: number, peerBest?: number): void {
    const adaptRate = this.config.adaptationRate;

    // If making good progress (high momentum), increase exploitation
    if (progress.momentum > 0.01) {
      this.exploitProb += adaptRate;
      this.exploreProb -= adaptRate * 0.5;
      this.backtrackProb -= adaptRate * 0.5;
    }
    // If stagnating (low momentum), increase exploration/backtracking
    else if (Math.abs(progress.momentum) < 0.001) {
      const lagging =
        absoluteProgress !== undefined && peerBest !== undefined
          ? peerBest - absoluteProgress > 0.05
          : false;
      this.exploreProb += adaptRate * (lagging ? 0.6 : 1.0);
      this.exploitProb -= adaptRate * 0.7;
      this.backtrackProb += adaptRate * (lagging ? 0.7 : 0.3);
    }
    // If declining, increase backtracking
    else if (progress.momentum < -0.01) {
      this.backtrackProb += adaptRate;
      this.exploreProb -= adaptRate * 0.3;
      this.exploitProb -= adaptRate * 0.7;
    }

    this.normalize();
  }

  /**
   * Normalize probabilities to sum to 1
   */
  private normalize(): void {
    // Ensure non-negative
    this.exploreProb = Math.max(0.05, this.exploreProb);
    this.exploitProb = Math.max(0.05, this.exploitProb);
    this.backtrackProb = Math.max(0.05, this.backtrackProb);

    // Normalize
    const total = this.exploreProb + this.exploitProb + this.backtrackProb;
    this.exploreProb /= total;
    this.exploitProb /= total;
    this.backtrackProb /= total;
  }

  /**
   * Get current probabilities
   */
  getProbabilities(): { explore: number; exploit: number; backtrack: number } {
    return {
      explore: this.exploreProb,
      exploit: this.exploitProb,
      backtrack: this.backtrackProb,
    };
  }
}

/**
 * Collaborative Evolution coordinator
 */
export class CollaborativeEvolution {
  private config: PACEvolveConfig;
  public samplingPolicy: AdaptiveSamplingPolicy;
  private lastCrossoverIteration: number;
  private islandProgress: Map<
    number,
    { initialScore: number | null; bestScore: number; absoluteProgress: number }
  >;

  constructor(config: PACEvolveConfig) {
    this.config = config;
    this.samplingPolicy = new AdaptiveSamplingPolicy(config);
    this.lastCrossoverIteration = 0;
    this.islandProgress = new Map();

    console.log('Initialized Self-Adaptive Collaborative Evolution (CE)');
  }

  /**
   * Check if should perform crossover between islands
   */
  shouldPerformCrossover(
    currentIteration: number,
    islandId: number,
    stagnating: boolean
  ): boolean {
    if (!this.config.enableCE) return false;

    const timeReady =
      currentIteration - this.lastCrossoverIteration >= this.config.crossoverFrequency;
    const currentProgress = this.getAbsoluteProgress(islandId);
    const bestProgress = this.getMaxAbsoluteProgress();
    const hasBetterPeer = bestProgress - currentProgress > 0.05;

    return timeReady && stagnating && hasBetterPeer;
  }

  /**
   * Perform crossover between two islands
   */
  performCrossover(
    database: ProgramDatabase,
    island1: number,
    island2: number
  ): Program | null {
    if (!this.config.enableCE) return null;

    try {
      // Sample best programs from each island
      const [parent1] = database.sampleFromIsland(island1, 0);
      const [parent2] = database.sampleFromIsland(island2, 0);

      // Create offspring by combining features
      // For now, simple approach: take code from better parent, metrics from both
      const offspring: Program = {
        ...parent1,
        id: uuidv4(),
        parentId: parent1.id,
        generation: Math.max(parent1.generation, parent2.generation) + 1,
        timestamp: Date.now(),
        metadata: {
          ...parent1.metadata,
          crossover: true,
          parent1Id: parent1.id,
          parent2Id: parent2.id,
          sourceIslands: [island1, island2],
        },
      };

      // lastCrossoverIteration is updated by controller using iteration counter

      console.log(
        `Performed crossover between islands ${island1} and ${island2}: ${offspring.id}`
      );

      return offspring;
    } catch (error) {
      console.error('Error performing crossover:', error);
      return null;
    }
  }

  /**
   * Update the adaptive policy based on progress
   */
  updatePolicy(
    progress: ProgressMetrics,
    absoluteProgress?: number,
    peerBest?: number
  ): void {
    if (!this.config.enableCE) return;

    this.samplingPolicy.update(progress, absoluteProgress, peerBest);

    const probs = this.samplingPolicy.getProbabilities();
    console.log(
      `Updated sampling policy: explore=${probs.explore.toFixed(3)}, ` +
        `exploit=${probs.exploit.toFixed(3)}, backtrack=${probs.backtrack.toFixed(3)}`
    );
  }

  /**
   * Select islands for crossover
   */
  selectIslandsForCrossover(numIslands: number): [number, number] {
    // Prefer islands with higher absolute progress as partners
    const island1 = Math.floor(Math.random() * numIslands);
    const candidates = Array.from({ length: numIslands }, (_, idx) => idx).filter(
      (idx) => idx !== island1
    );

    const weighted = candidates.map((idx) => ({
      idx,
      weight: Math.max(0.01, this.getAbsoluteProgress(idx) + 0.01),
    }));

    const total = weighted.reduce((sum, w) => sum + w.weight, 0);
    let rand = Math.random() * total;
    let island2 = candidates[0];
    for (const entry of weighted) {
      rand -= entry.weight;
      if (rand <= 0) {
        island2 = entry.idx;
        break;
      }
    }

    return [island1, island2];
  }

  updateIslandProgress(
    islandId: number,
    currentBest: number,
    initialScore?: number,
    targetScore?: number
  ): void {
    const state = this.getIslandState(islandId);
    if (state.initialScore === null && initialScore !== undefined) {
      state.initialScore = initialScore;
    }

    if (currentBest > state.bestScore) {
      state.bestScore = currentBest;
    }

    const absoluteProgress = this.calculateAbsoluteProgress(
      state.initialScore ?? currentBest,
      state.bestScore,
      targetScore
    );

    this.islandProgress.set(islandId, {
      initialScore: state.initialScore,
      bestScore: state.bestScore,
      absoluteProgress,
    });
  }

  getAbsoluteProgress(islandId: number): number {
    const state = this.islandProgress.get(islandId);
    return state ? state.absoluteProgress : 0;
  }

  getMaxAbsoluteProgress(): number {
    let best = 0;
    for (const state of this.islandProgress.values()) {
      if (state.absoluteProgress > best) {
        best = state.absoluteProgress;
      }
    }
    return best;
  }

  setLastCrossoverIteration(iteration: number): void {
    this.lastCrossoverIteration = iteration;
  }

  private getIslandState(islandId: number): {
    initialScore: number | null;
    bestScore: number;
    absoluteProgress: number;
  } {
    if (!this.islandProgress.has(islandId)) {
      this.islandProgress.set(islandId, {
        initialScore: null,
        bestScore: -Infinity,
        absoluteProgress: 0,
      });
    }
    return this.islandProgress.get(islandId)!;
  }

  private calculateAbsoluteProgress(
    initialScore: number,
    bestScore: number,
    targetScore?: number
  ): number {
    if (targetScore !== undefined) {
      return (bestScore - initialScore) / Math.max(Math.abs(targetScore - initialScore), 1e-6);
    }
    return (bestScore - initialScore) / Math.max(Math.abs(initialScore), 1e-6);
  }
}
