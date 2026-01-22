/**
 * Base interface for LLM implementations
 */

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Base LLM interface that all implementations must follow
 */
export interface LLMInterface {
  /**
   * Model name
   */
  readonly model: string;

  /**
   * Model weight in ensemble
   */
  readonly weight: number;

  /**
   * Generate text from a simple prompt
   */
  generate(prompt: string, options?: GenerateOptions): Promise<string>;

  /**
   * Generate text with system message and conversation context
   */
  generateWithContext(
    systemMessage: string,
    messages: Message[],
    options?: GenerateOptions
  ): Promise<string>;
}

/**
 * Options for text generation
 */
export interface GenerateOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stop?: string[];
}
