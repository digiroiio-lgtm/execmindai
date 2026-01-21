import { LLMClient } from './LLMClient';

export class OpenAIProvider implements LLMClient {
  readonly providerName = 'openai';

  constructor(private apiKey: string, private baseUrl: string) {}

  async generate(prompt: string, options: { model: string; maxTokens: number }): Promise<string> {
    return `OpenAI(${options.model},${options.maxTokens}): ${prompt}`;
  }
}
