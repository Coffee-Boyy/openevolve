/**
 * Program database with MAP-Elites and island-based evolution
 */

import * as fs from 'fs';
import * as path from 'path';
import { Program } from './types';
import { DatabaseConfig } from './config';
import { v4 as uuidv4 } from 'uuid';
import { calculateEditDistance, safeNumericAverage, getFitnessScore } from './utils';

/**
 * Program database with MAP-Elites and island-based evolution
 */
export class ProgramDatabase {
  private config: DatabaseConfig;
  private programs: Map<string, Program>;
  private islands: Set<string>[];
  private islandFeatureMaps: Map<string, string>[];
  private archive: Set<string>;
  private bestProgramId: string | null;
  private islandBestPrograms: (string | null)[];
  private currentIsland: number;
  private islandGenerations: number[];
  private lastMigrationGeneration: number;
  private lastIteration: number;
  private diversityCache: Map<number, { value: number; timestamp: number }>;
  private diversityReferenceSet: string[];
  private featureStats: Map<string, { min: number; max: number; values: number[] }>;
  private featureBinsPerDim: Record<string, number>;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.programs = new Map();
    this.islands = Array(config.numIslands)
      .fill(null)
      .map(() => new Set<string>());
    this.islandFeatureMaps = Array(config.numIslands)
      .fill(null)
      .map(() => new Map<string, string>());
    this.archive = new Set();
    this.bestProgramId = null;
    this.islandBestPrograms = Array(config.numIslands).fill(null);
    this.currentIsland = 0;
    this.islandGenerations = Array(config.numIslands).fill(0);
    this.lastMigrationGeneration = 0;
    this.lastIteration = 0;
    this.diversityCache = new Map();
    this.diversityReferenceSet = [];
    this.featureStats = new Map();

    // Set up per-dimension bins
    if (typeof config.featureBins === 'object') {
      this.featureBinsPerDim = config.featureBins;
    } else {
      this.featureBinsPerDim = {};
      for (const dim of config.featureDimensions) {
        this.featureBinsPerDim[dim] = config.featureBins as number;
      }
    }

    console.log(`Initialized program database with ${this.programs.size} programs`);
  }

  /**
   * Add a program to the database
   */
  add(program: Program, iteration?: number, targetIsland?: number): string {
    // Update iteration if provided
    if (iteration !== undefined) {
      program.iterationFound = iteration;
      this.lastIteration = Math.max(this.lastIteration, iteration);
    }

    this.programs.set(program.id, program);

    // Calculate feature coordinates
    const featureCoords = this.calculateFeatureCoords(program);

    // Determine target island
    let islandIdx: number;
    if (targetIsland !== undefined) {
      islandIdx = targetIsland;
    } else if (program.parentId) {
      const parent = this.programs.get(program.parentId);
      if (parent && parent.metadata.island !== undefined) {
        islandIdx = parent.metadata.island;
      } else {
        islandIdx = this.currentIsland;
      }
    } else {
      islandIdx = this.currentIsland;
    }

    islandIdx = islandIdx % this.islands.length;

    // Add to island-specific feature map
    const featureKey = this.featureCoordsToKey(featureCoords);
    const islandFeatureMap = this.islandFeatureMaps[islandIdx];
    let shouldReplace = !islandFeatureMap.has(featureKey);

    if (!shouldReplace) {
      const existingProgramId = islandFeatureMap.get(featureKey)!;
      if (!this.programs.has(existingProgramId)) {
        shouldReplace = true;
      } else {
        const existingProgram = this.programs.get(existingProgramId)!;
        shouldReplace = this.isBetter(program, existingProgram);
      }
    }

    if (shouldReplace) {
      const existingProgramId = islandFeatureMap.get(featureKey);
      if (existingProgramId) {
        this.islands[islandIdx].delete(existingProgramId);
        if (this.archive.has(existingProgramId)) {
          this.archive.delete(existingProgramId);
          this.archive.add(program.id);
        }
      }
      islandFeatureMap.set(featureKey, program.id);
    }

    // Add to island
    this.islands[islandIdx].add(program.id);
    program.metadata.island = islandIdx;

    // Update archive
    this.updateArchive(program);

    // Enforce population limit
    this.enforcePopulationLimit(program.id);

    // Update best program tracking
    this.updateBestProgram(program);
    this.updateIslandBestProgram(program, islandIdx);

    return program.id;
  }

  /**
   * Get a program by ID
   */
  get(programId: string): Program | null {
    return this.programs.get(programId) || null;
  }

  /**
   * Sample a parent and inspirations from a specific island
   */
  sampleFromIsland(
    islandId: number,
    numInspirations: number = 5
  ): [Program, Program[]] {
    islandId = islandId % this.islands.length;
    const islandPrograms = Array.from(this.islands[islandId]);

    if (islandPrograms.length === 0) {
      throw new Error(`Island ${islandId} is empty`);
    }

    // Sample parent based on exploration/exploitation ratio
    const randVal = Math.random();
    let parent: Program;

    if (randVal < this.config.explorationRatio) {
      // Exploration: random sampling
      parent = this.sampleFromIslandRandom(islandId);
    } else if (
      randVal <
      this.config.explorationRatio + this.config.exploitationRatio
    ) {
      // Exploitation: sample from archive
      parent = this.sampleFromArchiveForIsland(islandId);
    } else {
      // Weighted sampling
      parent = this.sampleFromIslandWeighted(islandId);
    }

    // Sample inspirations
    const otherPrograms = islandPrograms.filter((id) => id !== parent.id);
    const inspirationIds =
      otherPrograms.length <= numInspirations
        ? otherPrograms
        : this.sampleRandom(otherPrograms, numInspirations);

    const inspirations = inspirationIds
      .map((id) => this.programs.get(id)!)
      .filter(Boolean);

    return [parent, inspirations];
  }

  /**
   * Get the best program
   */
  getBestProgram(metric?: string): Program | null {
    if (this.programs.size === 0) return null;

    if (!metric && this.bestProgramId) {
      const best = this.programs.get(this.bestProgramId);
      if (best) return best;
    }

    const programs = Array.from(this.programs.values());

    if (metric) {
      const sorted = programs
        .filter((p) => metric in p.metrics)
        .sort((a, b) => b.metrics[metric] - a.metrics[metric]);
      return sorted[0] || null;
    }

    const sorted = programs.sort(
      (a, b) =>
        getFitnessScore(b.metrics, this.config.featureDimensions) -
        getFitnessScore(a.metrics, this.config.featureDimensions)
    );
    return sorted[0] || null;
  }

  /**
   * Check if should migrate programs between islands
   */
  shouldMigrate(): boolean {
    const minGen = Math.min(...this.islandGenerations);
    return minGen - this.lastMigrationGeneration >= this.config.migrationInterval;
  }

  /**
   * Migrate programs between islands
   */
  migratePrograms(): void {
    const numMigrants = Math.floor(
      this.config.populationSize * this.config.migrationRate
    );

    for (let i = 0; i < this.islands.length; i++) {
      const sourceIsland = i;
      const targetIsland = (i + 1) % this.islands.length;

      const sourcePrograms = Array.from(this.islands[sourceIsland]);
      if (sourcePrograms.length === 0) continue;

      // Select best programs from source island
      const migrants = sourcePrograms
        .map((id) => this.programs.get(id)!)
        .filter(Boolean)
        .sort(
          (a, b) =>
            getFitnessScore(b.metrics, this.config.featureDimensions) -
            getFitnessScore(a.metrics, this.config.featureDimensions)
        )
        .slice(0, numMigrants);

      // Add to target island
      for (const migrant of migrants) {
        this.add({ ...migrant, id: uuidv4() }, undefined, targetIsland);
      }
    }

    this.lastMigrationGeneration = Math.min(...this.islandGenerations);
    console.log(
      `Migrated ${numMigrants} programs per island at generation ${this.lastMigrationGeneration}`
    );
  }

  /**
   * Increment island generation count
   */
  incrementIslandGeneration(islandIdx: number): void {
    this.islandGenerations[islandIdx]++;
  }

  /**
   * Save database to disk
   */
  save(checkpointPath: string, iteration: number): void {
    if (!fs.existsSync(checkpointPath)) {
      fs.mkdirSync(checkpointPath, { recursive: true });
    }

    // Save programs
    const programsData = Array.from(this.programs.values());
    fs.writeFileSync(
      path.join(checkpointPath, 'programs.json'),
      JSON.stringify(programsData, null, 2)
    );

    // Save metadata
    const metadata = {
      lastIteration: this.lastIteration,
      bestProgramId: this.bestProgramId,
      islandBestPrograms: this.islandBestPrograms,
      archive: Array.from(this.archive),
      islands: this.islands.map((island) => Array.from(island)),
      islandGenerations: this.islandGenerations,
      lastMigrationGeneration: this.lastMigrationGeneration,
    };

    fs.writeFileSync(
      path.join(checkpointPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`Saved checkpoint at iteration ${iteration} to ${checkpointPath}`);
  }

  /**
   * Load database from disk
   */
  load(checkpointPath: string): void {
    const programsPath = path.join(checkpointPath, 'programs.json');
    const metadataPath = path.join(checkpointPath, 'metadata.json');

    if (!fs.existsSync(programsPath) || !fs.existsSync(metadataPath)) {
      throw new Error(`Checkpoint not found at ${checkpointPath}`);
    }

    // Load programs
    const programsData = JSON.parse(fs.readFileSync(programsPath, 'utf8'));
    this.programs.clear();
    for (const program of programsData) {
      this.programs.set(program.id, program);
    }

    // Load metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    this.lastIteration = metadata.lastIteration;
    this.bestProgramId = metadata.bestProgramId;
    this.islandBestPrograms = metadata.islandBestPrograms;
    this.archive = new Set(metadata.archive);
    this.islands = metadata.islands.map((island: string[]) => new Set(island));
    this.islandGenerations = metadata.islandGenerations;
    this.lastMigrationGeneration = metadata.lastMigrationGeneration;

    console.log(`Loaded checkpoint from ${checkpointPath}`);
  }

  /**
   * Calculate feature coordinates for a program
   */
  private calculateFeatureCoords(program: Program): number[] {
    const coords: number[] = [];

    for (const dim of this.config.featureDimensions) {
      let value: number;

      if (dim === 'complexity') {
        value = program.complexity || program.code.length;
      } else if (dim === 'diversity') {
        value = this.calculateDiversity(program);
      } else if (dim === 'score') {
        value = getFitnessScore(program.metrics, this.config.featureDimensions);
      } else {
        value = program.metrics[dim] || 0;
      }

      // Bin the value
      const bins = this.featureBinsPerDim[dim] || 10;
      const binIdx = this.valueTobin(dim, value, bins);
      coords.push(binIdx);
    }

    return coords;
  }

  /**
   * Calculate diversity of a program
   */
  private calculateDiversity(program: Program): number {
    if (this.diversityReferenceSet.length === 0) {
      return 0;
    }

    const distances = this.diversityReferenceSet.map((refCode) =>
      calculateEditDistance(program.code, refCode)
    );

    return distances.reduce((sum, d) => sum + d, 0) / distances.length;
  }

  /**
   * Convert value to bin index
   */
  private valueTobin(dimension: string, value: number, bins: number): number {
    const stats = this.featureStats.get(dimension);

    if (!stats) {
      // First time seeing this dimension, initialize stats
      this.featureStats.set(dimension, {
        min: value,
        max: value,
        values: [value],
      });
      return 0;
    }

    // Update stats
    stats.min = Math.min(stats.min, value);
    stats.max = Math.max(stats.max, value);
    stats.values.push(value);

    // Calculate bin
    const range = stats.max - stats.min;
    if (range === 0) return 0;

    const binIdx = Math.floor(((value - stats.min) / range) * bins);
    return Math.min(binIdx, bins - 1);
  }

  /**
   * Convert feature coordinates to a string key
   */
  private featureCoordsToKey(coords: number[]): string {
    return coords.join(',');
  }

  /**
   * Check if one program is better than another
   */
  private isBetter(program1: Program, program2: Program): boolean {
    const score1 = getFitnessScore(program1.metrics, this.config.featureDimensions);
    const score2 = getFitnessScore(program2.metrics, this.config.featureDimensions);
    return score1 > score2;
  }

  /**
   * Update archive with new program
   */
  private updateArchive(program: Program): void {
    if (this.archive.size < this.config.archiveSize) {
      this.archive.add(program.id);
    } else {
      // Replace worst program in archive if this one is better
      const archivePrograms = Array.from(this.archive)
        .map((id) => this.programs.get(id)!)
        .filter(Boolean);

      const worst = archivePrograms.sort(
        (a, b) =>
          getFitnessScore(a.metrics, this.config.featureDimensions) -
          getFitnessScore(b.metrics, this.config.featureDimensions)
      )[0];

      if (worst && this.isBetter(program, worst)) {
        this.archive.delete(worst.id);
        this.archive.add(program.id);
      }
    }
  }

  /**
   * Update best program tracking
   */
  private updateBestProgram(program: Program): void {
    if (!this.bestProgramId) {
      this.bestProgramId = program.id;
      return;
    }

    const currentBest = this.programs.get(this.bestProgramId);
    if (!currentBest || this.isBetter(program, currentBest)) {
      this.bestProgramId = program.id;
    }
  }

  /**
   * Update island-specific best program
   */
  private updateIslandBestProgram(program: Program, islandIdx: number): void {
    const currentBestId = this.islandBestPrograms[islandIdx];

    if (!currentBestId) {
      this.islandBestPrograms[islandIdx] = program.id;
      return;
    }

    const currentBest = this.programs.get(currentBestId);
    if (!currentBest || this.isBetter(program, currentBest)) {
      this.islandBestPrograms[islandIdx] = program.id;
    }
  }

  /**
   * Enforce population size limit
   */
  private enforcePopulationLimit(excludeProgramId?: string): void {
    if (this.programs.size <= this.config.populationSize) return;

    // Sort programs by fitness
    const programs = Array.from(this.programs.values())
      .filter((p) => p.id !== excludeProgramId)
      .sort(
        (a, b) =>
          getFitnessScore(a.metrics, this.config.featureDimensions) -
          getFitnessScore(b.metrics, this.config.featureDimensions)
      );

    // Remove worst programs
    const toRemove = programs.slice(
      0,
      this.programs.size - this.config.populationSize
    );

    for (const program of toRemove) {
      this.programs.delete(program.id);
      const island = program.metadata.island as number;
      if (island !== undefined) {
        this.islands[island].delete(program.id);
      }
      this.archive.delete(program.id);
    }
  }

  /**
   * Sample random program from island
   */
  private sampleFromIslandRandom(islandId: number): Program {
    const islandPrograms = Array.from(this.islands[islandId]);
    const randomId = islandPrograms[Math.floor(Math.random() * islandPrograms.length)];
    return this.programs.get(randomId)!;
  }

  /**
   * Sample program from archive for a specific island
   */
  private sampleFromArchiveForIsland(islandId: number): Program {
    const islandArchive = Array.from(this.archive).filter((id) => {
      const program = this.programs.get(id);
      return program && program.metadata.island === islandId;
    });

    if (islandArchive.length === 0) {
      return this.sampleFromIslandRandom(islandId);
    }

    const randomId = islandArchive[Math.floor(Math.random() * islandArchive.length)];
    return this.programs.get(randomId)!;
  }

  /**
   * Sample program from island with fitness weighting
   */
  private sampleFromIslandWeighted(islandId: number): Program {
    const islandPrograms = Array.from(this.islands[islandId])
      .map((id) => this.programs.get(id)!)
      .filter(Boolean);

    const fitnesses = islandPrograms.map((p) =>
      getFitnessScore(p.metrics, this.config.featureDimensions)
    );
    const totalFitness = fitnesses.reduce((sum, f) => sum + f, 0);

    const rand = Math.random() * totalFitness;
    let cumulative = 0;

    for (let i = 0; i < islandPrograms.length; i++) {
      cumulative += fitnesses[i];
      if (rand < cumulative) {
        return islandPrograms[i];
      }
    }

    return islandPrograms[islandPrograms.length - 1];
  }

  /**
   * Sample random elements from array
   */
  private sampleRandom<T>(array: T[], n: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  /**
   * Log island status
   */
  logIslandStatus(): void {
    console.log('Island status:');
    for (let i = 0; i < this.islands.length; i++) {
      const size = this.islands[i].size;
      const gen = this.islandGenerations[i];
      const best = this.islandBestPrograms[i];
      console.log(`  Island ${i}: ${size} programs, gen ${gen}, best: ${best}`);
    }
  }
}
