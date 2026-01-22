/**
 * Self-Adaptive Collaborative Evolution (CE) for PACEvolve
 * 
 * Coordinates parallel search trajectories with dynamic crossover
 * and adaptive sampling policy (explore vs exploit vs backtrack).
 */

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
  update(progress: ProgressMetrics): void {
    const adaptRate = this.config.adaptationRate;

    // If making good progress (high momentum), increase exploitation
    if (progress.momentum > 0.01) {
      this.exploitProb += adaptRate;
      this.exploreProb -= adaptRate * 0.5;
      this.backtrackProb -= adaptRate * 0.5;
    }
    // If stagnating (low momentum), increase exploration
    else if (Math.abs(progress.momentum) < 0.001) {
      this.exploreProb += adaptRate;
      this.exploitProb -= adaptRate * 0.7;
      this.backtrackProb += adaptRate * 0.3;
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

  constructor(config: PACEvolveConfig) {
    this.config = config;
    this.samplingPolicy = new AdaptiveSamplingPolicy(config);
    this.lastCrossoverIteration = 0;

    console.log('Initialized Self-Adaptive Collaborative Evolution (CE)');
  }

  /**
   * Check if should perform crossover between islands
   */
  shouldPerformCrossover(currentIteration: number): boolean {
    if (!this.config.enableCE) return false;

    return (
      currentIteration - this.lastCrossoverIteration >= this.config.crossoverFrequency
    );
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
        id: require('uuid').v4(),
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

      this.lastCrossoverIteration = Date.now();

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
  updatePolicy(progress: ProgressMetrics): void {
    if (!this.config.enableCE) return;

    this.samplingPolicy.update(progress);

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
    // Select two different random islands
    const island1 = Math.floor(Math.random() * numIslands);
    let island2 = Math.floor(Math.random() * numIslands);

    // Ensure different islands
    while (island2 === island1) {
      island2 = Math.floor(Math.random() * numIslands);
    }

    return [island1, island2];
  }
}
