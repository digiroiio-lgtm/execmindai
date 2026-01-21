import registry, { PromptDefinition, PromptId } from '../prompts';

export interface AgentContext {
  decisionId: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export abstract class BaseAgent {
  private initialized = false;

  constructor(protected context: AgentContext, protected promptRegistry = registry) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    console.log(`[${this.constructor.name}] initializing for decision ${this.context.decisionId}`);
    this.initialized = true;
  }

  protected getPrompt(id: PromptId): PromptDefinition {
    const prompt = this.promptRegistry.getPrompt(id);
    console.log(`[${this.constructor.name}] using prompt ${prompt.id}@${prompt.version}`);
    return prompt;
  }

  protected async invokePrompt(id: PromptId, variables: Record<string, unknown>): Promise<string> {
    const prompt = this.getPrompt(id);
    const filledTemplate = prompt.template.replace(/\{(.+?)\}/g, (_, key) => {
      const value = variables[key];
      return typeof value === 'string' ? value : JSON.stringify(value ?? '');
    });
    console.log(`[${this.constructor.name}] invoking prompt:\n${filledTemplate}`);
    // Placeholder for LLM call; returns mocked string.
    return `executed ${prompt.id} with context ${this.context.decisionId}`;
  }

  abstract run(...args: unknown[]): Promise<string>;
}
