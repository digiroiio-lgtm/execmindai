import { LLMClient } from './LLMClient';

export class XAIProvider implements LLMClient {
  readonly providerName = 'xai';

  constructor(private apiKey: string) {}

  async generate(prompt: string, options: { model: string; maxTokens: number }): Promise<string> {
    return `xAI(${options.model}): ${prompt}`;
  }
}
