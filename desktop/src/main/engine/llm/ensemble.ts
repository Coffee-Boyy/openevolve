/**
 * LLM ensemble with weighted model sampling
 */

import { LLMInterface, Message, GenerateOptions } from './base';
import { OpenAILLM } from './openai';
import { LLMModelConfig } from '../config';

export class LLMEnsemble {
  private models: LLMInterface[];
  private weights: number[];
  private cumulativeWeights: number[];

  constructor(modelsConfig: LLMModelConfig[]) {
    if (modelsConfig.length === 0) {
      throw new Error('LLMEnsemble requires at least one model configuration');
    }

    // Initialize models
    this.models = modelsConfig.map((config) => new OpenAILLM(config));

    // Extract and normalize weights
    this.weights = this.models.map((model) => model.weight);
    const totalWeight = this.weights.reduce((sum, w) => sum + w, 0);

    if (totalWeight === 0) {
      throw new Error('Total model weights cannot be zero');
    }

    this.weights = this.weights.map((w) => w / totalWeight);

    // Compute cumulative weights for sampling
    this.cumulativeWeights = [];
    let cumulative = 0;
    for (const weight of this.weights) {
      cumulative += weight;
      this.cumulativeWeights.push(cumulative);
    }

    if (modelsConfig.length > 1) {
      console.log(
        'Initialized LLM ensemble with models:',
        modelsConfig.map((config, i) => 
          `${config.name} (weight: ${this.weights[i].toFixed(2)})`
        ).join(', ')
      );
    }
  }

  /**
   * Sample a model from the ensemble based on weights
   */
  private sampleModel(): LLMInterface {
    const random = Math.random();
    const index = this.cumulativeWeights.findIndex((w) => random < w);
    const selectedModel = this.models[index !== -1 ? index : this.models.length - 1];
    console.log(`Sampled model: ${selectedModel.model}`);
    return selectedModel;
  }

  /**
   * Generate text using a randomly selected model based on weights
   */
  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const model = this.sampleModel();
    return model.generate(prompt, options);
  }

  /**
   * Generate text using system message and context
   */
  async generateWithContext(
    systemMessage: string,
    messages: Message[],
    options?: GenerateOptions
  ): Promise<string> {
    const model = this.sampleModel();
    return model.generateWithContext(systemMessage, messages, options);
  }

  /**
   * Generate using all models and return all responses
   */
  async generateAllWithContext(
    systemMessage: string,
    messages: Message[],
    options?: GenerateOptions
  ): Promise<string[]> {
    const promises = this.models.map((model) =>
      model.generateWithContext(systemMessage, messages, options)
    );
    return Promise.all(promises);
  }
}
