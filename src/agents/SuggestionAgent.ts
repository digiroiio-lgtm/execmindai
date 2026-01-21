import { BaseAgent } from './BaseAgent';
import { PromptId } from '../prompts/prompt-registry';

export interface SuggestionInput {
  contextTags: string[];
  recentDecisions: string[];
  travelWindows?: string[];
}

export class SuggestionAgent extends BaseAgent {
  async run(input: SuggestionInput): Promise<string> {
    await this.initialize();
    return this.invokePrompt('suggestion_generation' as PromptId, {
      context: input.contextTags.join(', '),
      decisions: input.recentDecisions.join('; '),
      travel: input.travelWindows?.join(', ') ?? ''
    });
  }
}
