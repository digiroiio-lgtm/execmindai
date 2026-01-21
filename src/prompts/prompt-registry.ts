export type PromptId = 'task_decomposition' | 'suggestion_generation';

export interface PromptDefinition {
  id: PromptId;
  version: string;
  description: string;
  template: string;
  lastUpdated: string;
}

export class PromptRegistry {
  constructor(private definitions: Record<PromptId, PromptDefinition>) {}

  getPrompt(id: PromptId): PromptDefinition {
    const definition = this.definitions[id];
    if (!definition) {
      throw new Error(`Prompt ${id} not registered`);
    }
    return definition;
  }

  listPrompts(): PromptDefinition[] {
    return Object.values(this.definitions);
  }
}
