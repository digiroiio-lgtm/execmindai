import { BaseAgent } from './BaseAgent';
import { PromptId } from '../prompts/prompt-registry';

export interface PlannerInput {
  intent: string;
  priorities: string[];
  windowHint: string;
}

export class PlannerAgent extends BaseAgent {
  async run(input: PlannerInput): Promise<string> {
    await this.initialize();
    return this.invokePrompt('task_decomposition' as PromptId, {
      intent: input.intent,
      priorities: input.priorities.join(', '),
      window: input.windowHint
    });
  }
}
