import { LLMClient } from './LLMClient';

export class GoogleProvider implements LLMClient {
  readonly providerName = 'google';

  constructor(private apiKey: string) {}

  async generate(prompt: string, options: { model: string; maxTokens: number }): Promise<string> {
    return `Google(${options.model}): ${prompt}`;
  }
}
