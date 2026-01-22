/**
 * OpenAI LLM implementation
 */

import OpenAI from 'openai';
import { LLMInterface, Message, GenerateOptions } from './base';
import { LLMModelConfig } from '../config';

export class OpenAILLM implements LLMInterface {
  private client: OpenAI;
  private config: LLMModelConfig;

  public readonly model: string;
  public readonly weight: number;

  constructor(config: LLMModelConfig) {
    this.config = config;
    this.model = config.name || 'gpt-4o-mini';
    this.weight = config.weight;

    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.apiBase,
      timeout: (config.timeout || 60) * 1000,
      maxRetries: config.retries || 3,
    });
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    return this.generateWithContext('You are a helpful assistant.', [
      { role: 'user', content: prompt },
    ], options);
  }

  async generateWithContext(
    systemMessage: string,
    messages: Message[],
    options?: GenerateOptions
  ): Promise<string> {
    const retries = this.config.retries || 3;
    const retryDelay = this.config.retryDelay || 5;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemMessage },
            ...messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
          ],
          temperature: options?.temperature ?? this.config.temperature ?? 0.7,
          top_p: options?.topP ?? this.config.topP ?? 0.95,
          max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4096,
          stop: options?.stop,
          seed: this.config.randomSeed,
          ...(this.config.reasoningEffort && {
            reasoning_effort: this.config.reasoningEffort as any,
          }),
        } as any);

        const response = completion.choices[0]?.message?.content;
        if (!response) {
          throw new Error('Empty response from OpenAI API');
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `OpenAI API call failed (attempt ${attempt + 1}/${retries}):`,
          error
        );

        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * 1000));
        }
      }
    }

    throw new Error(
      `Failed to generate response after ${retries} attempts: ${lastError?.message}`
    );
  }
}
