export interface LLMClient {
  readonly providerName: string;
  generate(prompt: string, options: { model: string; maxTokens: number }): Promise<string>;
}
