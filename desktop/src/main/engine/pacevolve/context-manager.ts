/**
 * Hierarchical Context Management (HCM) for PACEvolve
 * 
 * Decouples idea generation from selection and reduces context pollution
 * by maintaining a hierarchical "idea memory" structure with pruning.
 */

import { IdeaCluster, IdeaHypothesis, Program } from '../types';
import { PACEvolveConfig } from '../config';
import { calculateEditDistance } from '../utils';

/**
 * Hierarchical Context Manager
 */
export class HierarchicalContextManager {
  private config: PACEvolveConfig;
  private ideas: Map<string, IdeaCluster>;
  private generationIds: Set<string>;
  private selectionIds: Set<string>;
  private historicalIdeas: IdeaCluster[];
  private ideaCounter: number;
  private hypothesisCounter: number;

  constructor(config: PACEvolveConfig) {
    this.config = config;
    this.ideas = new Map();
    this.generationIds = new Set();
    this.selectionIds = new Set();
    this.historicalIdeas = [];
    this.ideaCounter = 0;
    this.hypothesisCounter = 0;

    console.log('Initialized Hierarchical Context Manager (HCM)');
  }

  /**
   * Add a new idea from a program's evolution
   */
  addIdea(program: Program, iteration: number): void {
    if (!this.config.enableHCM) return;

    const hypothesis = this.createHypothesis(program, iteration);
    const cluster = this.findOrCreateCluster(hypothesis, iteration);

    cluster.hypotheses.push(hypothesis);
    cluster.score = Math.max(cluster.score, hypothesis.score);
    cluster.iteration = Math.max(cluster.iteration, iteration);
    cluster.timestamp = Date.now();
    cluster.stale = false;

    this.generationIds.add(cluster.id);

    if (this.isHighQuality(hypothesis.score)) {
      this.selectionIds.add(cluster.id);
    }

    this.enforceHypothesisLimit(cluster);
    this.enforceIdeaLimits();
  }

  /**
   * Get ideas for generation context
   */
  getGenerationContext(): IdeaCluster[] {
    if (!this.config.enableHCM) return [];
    return this.getActiveClusters(this.generationIds);
  }

  /**
   * Get ideas for selection context
   */
  getSelectionContext(): IdeaCluster[] {
    if (!this.config.enableHCM) return [];
    return this.getActiveClusters(this.selectionIds);
  }

  /**
   * Prune stale ideas
   */
  pruneStaleIdeas(currentIteration: number): void {
    if (!this.config.enableHCM) return;

    const stalenessThreshold = this.config.pruningInterval;

    const staleClusters: IdeaCluster[] = [];

    for (const cluster of this.ideas.values()) {
      for (const hypothesis of cluster.hypotheses) {
        if (currentIteration - hypothesis.iteration > stalenessThreshold) {
          hypothesis.stale = true;
        }
      }

      const hasFreshHypotheses = cluster.hypotheses.some((h) => !h.stale);
      if (!hasFreshHypotheses || currentIteration - cluster.iteration > stalenessThreshold) {
        cluster.stale = true;
        staleClusters.push(cluster);
      }
    }

    for (const cluster of staleClusters) {
      this.ideas.delete(cluster.id);
      this.generationIds.delete(cluster.id);
      this.selectionIds.delete(cluster.id);
      this.historicalIdeas.push({ ...cluster, stale: true });
    }

    const maxHistory = this.getIdeaLimit() * 2;
    if (this.historicalIdeas.length > maxHistory) {
      this.historicalIdeas = this.historicalIdeas.slice(-maxHistory);
    }

    if (staleClusters.length > 0) {
      console.log(`Pruned stale idea clusters: ${staleClusters.length}`);
    }
  }

  /**
   * Check if an idea is high quality
   */
  private isHighQuality(score: number): boolean {
    return score >= this.config.pruningThreshold;
  }

  /**
   * Enforce memory limits
   */
  private enforceIdeaLimits(): void {
    const maxIdeas = this.getIdeaLimit();
    if (this.ideas.size <= maxIdeas) return;

    const clusters = Array.from(this.ideas.values()).sort((a, b) => {
      const scoreDiff = b.score - a.score;
      return scoreDiff !== 0 ? scoreDiff : b.timestamp - a.timestamp;
    });

    const toRemove = clusters.slice(maxIdeas);
    for (const cluster of toRemove) {
      this.ideas.delete(cluster.id);
      this.generationIds.delete(cluster.id);
      this.selectionIds.delete(cluster.id);
      this.historicalIdeas.push({ ...cluster, stale: true });
    }
  }

  private enforceHypothesisLimit(cluster: IdeaCluster): void {
    const maxHypotheses = Math.max(1, this.config.maxHypothesesPerIdea);
    if (cluster.hypotheses.length <= maxHypotheses) return;

    cluster.hypotheses.sort((a, b) => b.score - a.score);
    const kept = cluster.hypotheses.slice(0, maxHypotheses);
    const pruned = cluster.hypotheses.slice(maxHypotheses);

    cluster.hypotheses = kept;
    cluster.prunedSummaries = [
      ...(cluster.prunedSummaries || []),
      ...pruned.map((h) => h.summary || h.content.slice(0, 60)),
    ].slice(-maxHypotheses * 2);
  }

  private createHypothesis(program: Program, iteration: number): IdeaHypothesis {
    const summary = this.summarizeText(
      program.code,
      this.config.hypothesisSummaryMaxChars
    );
    return {
      id: `hyp_${this.hypothesisCounter++}`,
      content: program.code,
      summary,
      programId: program.id,
      iteration,
      score: program.metrics.combined_score || 0,
      timestamp: Date.now(),
      stale: false,
    };
  }

  private findOrCreateCluster(
    hypothesis: IdeaHypothesis,
    iteration: number
  ): IdeaCluster {
    const match = this.findMatchingCluster(hypothesis.summary || '');
    if (match) {
      return match;
    }

    const summary = this.summarizeText(
      hypothesis.summary || hypothesis.content,
      this.config.ideaSummaryMaxChars
    );
    const title = this.buildTitle(summary);
    const cluster: IdeaCluster = {
      id: `idea_${this.ideaCounter++}`,
      title,
      summary,
      iteration,
      score: hypothesis.score,
      timestamp: Date.now(),
      stale: false,
      hypotheses: [],
    };

    this.ideas.set(cluster.id, cluster);
    return cluster;
  }

  private findMatchingCluster(summary: string): IdeaCluster | null {
    if (!summary) return null;

    let bestMatch: IdeaCluster | null = null;
    let bestScore = 0;
    const threshold = this.config.ideaDistinctnessThreshold;

    for (const cluster of this.ideas.values()) {
      const sim = this.calculateSimilarity(summary, cluster.summary || cluster.title);
      if (sim >= threshold && sim > bestScore) {
        bestScore = sim;
        bestMatch = cluster;
      }
    }

    return bestMatch;
  }

  private calculateSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 0;
    const dist = calculateEditDistance(a, b);
    return 1 - dist / maxLen;
  }

  private summarizeText(text: string, maxChars: number): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return 'No summary available';
    return cleaned.length > maxChars ? cleaned.slice(0, maxChars) + '…' : cleaned;
  }

  private buildTitle(summary: string): string {
    const firstSentence = summary.split('. ')[0];
    const title = firstSentence || summary;
    return title.length > 80 ? title.slice(0, 80) + '…' : title;
  }

  private getActiveClusters(ids: Set<string>): IdeaCluster[] {
    const clusters: IdeaCluster[] = [];
    for (const id of ids) {
      const cluster = this.ideas.get(id);
      if (cluster && !cluster.stale) {
        clusters.push(cluster);
      }
    }
    return clusters;
  }

  private getIdeaLimit(): number {
    const configured = this.config.maxIdeas || this.config.ideaMemorySize;
    return Math.max(1, configured);
  }

  /**
   * Reset selection context after backtracking
   */
  resetForBacktrack(): void {
    if (!this.config.enableHCM) return;
    this.selectionIds.clear();
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
      generationCount: this.generationIds.size,
      selectionCount: this.selectionIds.size,
      historicalCount: this.historicalIdeas.length,
    };
  }
}
