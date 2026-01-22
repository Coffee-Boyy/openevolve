/**
 * Prompt sampling for OpenEvolve
 */

import { PromptConfig } from '../config';
import { Program } from '../types';
import { TemplateManager } from './templates';
import { formatMetrics, getFitnessScore, formatFeatureCoordinates } from '../utils';

/**
 * Prompt sampler for code evolution
 */
export class PromptSampler {
  private config: PromptConfig;
  private templateManager: TemplateManager;
  private systemTemplateOverride?: string;
  private userTemplateOverride?: string;

  constructor(config: PromptConfig) {
    this.config = config;
    this.templateManager = new TemplateManager(config.templateDir);
    console.log('Initialized prompt sampler');
  }

  /**
   * Set custom templates for this sampler
   */
  setTemplates(systemTemplate?: string, userTemplate?: string): void {
    this.systemTemplateOverride = systemTemplate;
    this.userTemplateOverride = userTemplate;
    console.log(`Set custom templates: system=${systemTemplate}, user=${userTemplate}`);
  }

  /**
   * Build a prompt for the LLM
   */
  buildPrompt(options: {
    currentProgram?: string;
    parentProgram?: string;
    programMetrics?: Record<string, number>;
    previousPrograms?: any[];
    topPrograms?: any[];
    inspirations?: any[];
    language?: string;
    evolutionRound?: number;
    diffBasedEvolution?: boolean;
    templateKey?: string;
    programArtifacts?: Record<string, any>;
    featureDimensions?: string[];
    [key: string]: any;
  }): { system: string; user: string } {
    const {
      currentProgram = '',
      parentProgram = '',
      programMetrics = {},
      previousPrograms = [],
      topPrograms = [],
      inspirations = [],
      language = 'typescript',
      evolutionRound = 0,
      diffBasedEvolution = true,
      templateKey,
      programArtifacts,
      featureDimensions = [],
      ...kwargs
    } = options;

    // Select template
    let userTemplateKey: string;
    if (templateKey) {
      userTemplateKey = templateKey;
    } else if (this.userTemplateOverride) {
      userTemplateKey = this.userTemplateOverride;
    } else {
      userTemplateKey = diffBasedEvolution ? 'diff_user' : 'full_rewrite_user';
    }

    const userTemplate = this.templateManager.getTemplate(userTemplateKey);

    // Get system message
    let systemMessage: string;
    if (this.systemTemplateOverride) {
      systemMessage = this.templateManager.getTemplate(this.systemTemplateOverride);
    } else {
      systemMessage = this.config.systemMessage;
      if (this.templateManager.hasTemplate(systemMessage)) {
        systemMessage = this.templateManager.getTemplate(systemMessage);
      }
    }

    // Format metrics as string for prompt
    const metricsStr = Object.entries(programMetrics)
      .map(([name, value]) => `- ${name}: ${typeof value === 'number' ? value.toFixed(4) : value}`)
      .join('\n');

    // Calculate fitness and feature coordinates
    const fitnessScore = getFitnessScore(programMetrics, featureDimensions);
    const featureCoords = formatFeatureCoordinates(programMetrics, featureDimensions);

    // Identify improvement areas
    const improvementAreas = this.identifyImprovementAreas(
      currentProgram,
      parentProgram,
      programMetrics,
      previousPrograms,
      featureDimensions
    );

    // Format evolution history
    const evolutionHistory = this.formatEvolutionHistory(
      previousPrograms,
      topPrograms,
      inspirations,
      language,
      featureDimensions
    );

    // Format artifacts if available
    let artifactsSection = '';
    if (this.config.includeArtifacts && programArtifacts) {
      artifactsSection = this.renderArtifacts(programArtifacts);
    }

    // Apply template variations if enabled
    let finalUserTemplate = userTemplate;
    if (this.config.useTemplateStochasticity) {
      finalUserTemplate = this.applyTemplateVariations(finalUserTemplate);
    }

    // Format the final user message - simple string replacement
    let userMessage = finalUserTemplate;
    const replacements = {
      metrics: metricsStr,
      fitness_score: fitnessScore.toFixed(4),
      feature_coords: featureCoords,
      feature_dimensions: featureDimensions.join(', ') || 'None',
      improvement_areas: improvementAreas,
      evolution_history: evolutionHistory,
      current_program: currentProgram,
      language,
      artifacts: artifactsSection,
      ...kwargs,
    };

    for (const [key, value] of Object.entries(replacements)) {
      userMessage = userMessage.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }

    return {
      system: systemMessage,
      user: userMessage,
    };
  }

  /**
   * Identify improvement areas
   */
  private identifyImprovementAreas(
    currentProgram: string,
    parentProgram: string,
    metrics: Record<string, number>,
    previousPrograms: any[],
    featureDimensions: string[]
  ): string {
    const areas: string[] = [];

    const currentFitness = getFitnessScore(metrics, featureDimensions);

    if (previousPrograms.length > 0) {
      const prevMetrics = previousPrograms[previousPrograms.length - 1].metrics || {};
      const prevFitness = getFitnessScore(prevMetrics, featureDimensions);

      if (currentFitness > prevFitness) {
        areas.push(
          `Fitness improved from ${prevFitness.toFixed(4)} to ${currentFitness.toFixed(4)}`
        );
      } else if (currentFitness < prevFitness) {
        areas.push(
          `Fitness declined from ${prevFitness.toFixed(4)} to ${currentFitness.toFixed(4)}`
        );
      }
    }

    // Suggest simplification if program is long
    if (
      this.config.suggestSimplificationAfterChars &&
      currentProgram.length > this.config.suggestSimplificationAfterChars
    ) {
      areas.push(
        `Program is quite long (${currentProgram.length} characters). Consider simplifying if possible.`
      );
    }

    return areas.length > 0 ? areas.join('\n') : 'Continue evolving the program.';
  }

  /**
   * Format evolution history
   */
  private formatEvolutionHistory(
    previousPrograms: any[],
    topPrograms: any[],
    inspirations: any[],
    language: string,
    featureDimensions: string[]
  ): string {
    const sections: string[] = [];

    // Top programs section
    if (topPrograms.length > 0) {
      sections.push('## Top Performing Programs\n');
      for (let i = 0; i < Math.min(topPrograms.length, 3); i++) {
        const prog = topPrograms[i];
        const fitness = getFitnessScore(prog.metrics || {}, featureDimensions);
        sections.push(`### Top Program ${i + 1} (fitness: ${fitness.toFixed(4)})`);
        sections.push('```' + language);
        sections.push(prog.code || '');
        sections.push('```\n');
      }
    }

    // Inspiration programs
    if (inspirations.length > 0) {
      sections.push('## Inspiration Programs\n');
      for (let i = 0; i < Math.min(inspirations.length, 2); i++) {
        const prog = inspirations[i];
        const fitness = getFitnessScore(prog.metrics || {}, featureDimensions);
        sections.push(`### Inspiration ${i + 1} (fitness: ${fitness.toFixed(4)})`);
        sections.push('```' + language);
        sections.push(prog.code || '');
        sections.push('```\n');
      }
    }

    return sections.join('\n');
  }

  /**
   * Render artifacts section
   */
  private renderArtifacts(artifacts: Record<string, any>): string {
    const sections: string[] = ['## Execution Artifacts\n'];

    for (const [key, value] of Object.entries(artifacts)) {
      if (key === 'stdout' || key === 'stderr') {
        const content = typeof value === 'string' ? value : String(value);
        if (content && content.length > 0) {
          const truncated =
            content.length > this.config.maxArtifactBytes
              ? content.slice(0, this.config.maxArtifactBytes) + '\n... (truncated)'
              : content;
          sections.push(`### ${key.toUpperCase()}`);
          sections.push('```');
          sections.push(truncated);
          sections.push('```\n');
        }
      }
    }

    return sections.join('\n');
  }

  /**
   * Apply template variations
   */
  private applyTemplateVariations(template: string): string {
    // Simple stochastic variations - randomly choose between synonyms
    const variations: Record<string, string[]> = {
      improve: ['improve', 'enhance', 'optimize', 'refine'],
      program: ['program', 'code', 'solution', 'implementation'],
      better: ['better', 'improved', 'superior', 'enhanced'],
    };

    let result = template;
    for (const [key, options] of Object.entries(variations)) {
      const chosen = options[Math.floor(Math.random() * options.length)];
      result = result.replace(new RegExp(`\\b${key}\\b`, 'gi'), chosen);
    }

    return result;
  }
}
