import { LLMClient } from './LLMClient';

export class AnthropicProvider implements LLMClient {
  readonly providerName = 'anthropic';

  constructor(private apiKey: string) {}

  async generate(prompt: string, options: { model: string; maxTokens: number }): Promise<string> {
    return `Anthropic(${options.model}): ${prompt}`;
  }
}
