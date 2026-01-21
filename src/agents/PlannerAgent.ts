import { BaseAgent } from './BaseAgent';
import { PromptId } from '../prompts/prompt-registry';
import { randomUUID } from 'crypto';
import { taskHistoryStore } from '../memory';
import { TaskItem } from '../types/data';

export interface PlannerInput {
  intent: string;
  priorities: string[];
  windowHint: string;
}

export class PlannerAgent extends BaseAgent {
  async run(input: PlannerInput): Promise<string> {
    await this.initialize();
    const response = await this.invokePrompt('task_decomposition' as PromptId, {
      intent: input.intent,
      priorities: input.priorities.join(', '),
      window: input.windowHint
    });

    const mission = `${input.intent} (${input.priorities.join(', ')})`;
    const task: TaskItem = {
      taskId: randomUUID(),
      decisionId: this.context.decisionId,
      mission,
      dueAt: input.windowHint,
      priority: 'normal',
      relatedPeople: this.context.metadata?.relatedPeople ?? [],
      contextTags: this.context.metadata?.contextTags ?? [],
      followUpNeeded: true
    };

    await taskHistoryStore.record(task);
    return response;
  }
}
