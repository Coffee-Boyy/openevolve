/**
 * Hierarchical Context Management (HCM) for PACEvolve
 * 
 * Decouples idea generation from selection and reduces context pollution
 * by maintaining a hierarchical "idea memory" structure with pruning.
 */

import { Idea, Program } from '../types';
import { PACEvolveConfig } from '../config';

/**
 * Hierarchical Context Manager
 */
export class HierarchicalContextManager {
  private config: PACEvolveConfig;
  private generationIdeas: Idea[];  // Ideas for candidate generation
  private selectionIdeas: Idea[];   // Ideas for selection/filtering
  private historicalIdeas: Idea[];  // Archive of past ideas
  private ideaCounter: number;

  constructor(config: PACEvolveConfig) {
    this.config = config;
    this.generationIdeas = [];
    this.selectionIdeas = [];
    this.historicalIdeas = [];
    this.ideaCounter = 0;

    console.log('Initialized Hierarchical Context Manager (HCM)');
  }

  /**
   * Add a new idea from a program's evolution
   */
  addIdea(program: Program, iteration: number): void {
    if (!this.config.enableHCM) return;

    const idea: Idea = {
      id: `idea_${this.ideaCounter++}`,
      content: program.code,
      programId: program.id,
      iteration,
      score: program.metrics.combined_score || 0,
      timestamp: Date.now(),
      stale: false,
    };

    // Add to generation ideas
    this.generationIdeas.push(idea);

    // If it's a high-scoring idea, also add to selection ideas
    if (this.isHighQuality(idea)) {
      this.selectionIdeas.push(idea);
    }

    // Enforce size limits
    this.enforceMemoryLimits();
  }

  /**
   * Get ideas for generation context
   */
  getGenerationContext(): Idea[] {
    if (!this.config.enableHCM) return [];
    return this.generationIdeas.filter((idea) => !idea.stale);
  }

  /**
   * Get ideas for selection context
   */
  getSelectionContext(): Idea[] {
    if (!this.config.enableHCM) return [];
    return this.selectionIdeas.filter((idea) => !idea.stale);
  }

  /**
   * Prune stale ideas
   */
  pruneStaleIdeas(currentIteration: number): void {
    if (!this.config.enableHCM) return;

    const stalenessThreshold = this.config.pruningInterval;

    // Mark stale ideas
    for (const idea of this.generationIdeas) {
      if (currentIteration - idea.iteration > stalenessThreshold) {
        idea.stale = true;
      }
    }

    for (const idea of this.selectionIdeas) {
      if (currentIteration - idea.iteration > stalenessThreshold) {
        idea.stale = true;
      }
    }

    // Move stale ideas to historical archive
    const staleGeneration = this.generationIdeas.filter((idea) => idea.stale);
    const staleSelection = this.selectionIdeas.filter((idea) => idea.stale);

    this.historicalIdeas.push(...staleGeneration, ...staleSelection);

    // Remove stale ideas from active memory
    this.generationIdeas = this.generationIdeas.filter((idea) => !idea.stale);
    this.selectionIdeas = this.selectionIdeas.filter((idea) => !idea.stale);

    // Limit historical archive size
    if (this.historicalIdeas.length > this.config.ideaMemorySize * 2) {
      this.historicalIdeas = this.historicalIdeas.slice(-this.config.ideaMemorySize * 2);
    }

    console.log(
      `Pruned ideas: ${staleGeneration.length} from generation, ${staleSelection.length} from selection`
    );
  }

  /**
   * Check if an idea is high quality
   */
  private isHighQuality(idea: Idea): boolean {
    // Ideas with scores above the threshold are considered high quality
    return idea.score >= this.config.pruningThreshold;
  }

  /**
   * Enforce memory limits
   */
  private enforceMemoryLimits(): void {
    const maxSize = this.config.ideaMemorySize;

    // If generation ideas exceed limit, remove oldest low-quality ones
    if (this.generationIdeas.length > maxSize) {
      this.generationIdeas.sort((a, b) => {
        // First by quality, then by timestamp
        const scoreDiff = b.score - a.score;
        return scoreDiff !== 0 ? scoreDiff : b.timestamp - a.timestamp;
      });
      this.generationIdeas = this.generationIdeas.slice(0, maxSize);
    }

    // If selection ideas exceed limit, remove lowest scoring
    if (this.selectionIdeas.length > maxSize) {
      this.selectionIdeas.sort((a, b) => b.score - a.score);
      this.selectionIdeas = this.selectionIdeas.slice(0, maxSize);
    }
  }

  /**
   * Get statistics about the idea memory
   */
  getStats(): {
    generationCount: number;
    selectionCount: number;
    historicalCount: number;
  } {
    return {
      generationCount: this.generationIdeas.length,
      selectionCount: this.selectionIdeas.length,
      historicalCount: this.historicalIdeas.length,
    };
  }
}
