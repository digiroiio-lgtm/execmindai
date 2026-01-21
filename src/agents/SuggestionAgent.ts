import { BaseAgent } from './BaseAgent';
import { PromptId } from '../prompts/prompt-registry';
import { contextStore, decisionLog } from '../memory';

export interface SuggestionInput {
  contextTags: string[];
  recentDecisions: string[];
  travelWindows?: string[];
}

export class SuggestionAgent extends BaseAgent {
  async run(input: SuggestionInput): Promise<string> {
    await this.initialize();
    const contextSnapshot = contextStore.snapshot();
    const decisionSnapshot = decisionLog.snapshot();

    const contextSummary =
      contextSnapshot.length > 0
        ? contextSnapshot.map((entry) => `${entry.contextTag}(${entry.momentumScore.toFixed(1)})`).join(', ')
        : 'no active context yet';

    const decisionSummary =
      decisionSnapshot.length > 0
        ? decisionSnapshot
            .slice(-3)
            .map((record) => `${record.description} [${record.status}]`)
            .join('; ')
        : 'no decisions logged';

    return this.invokePrompt('suggestion_generation' as PromptId, {
      context: contextSummary,
      decisions: decisionSummary,
      travel: input.travelWindows?.join(', ') ?? 'no travel window detected'
    });
  }
}
