import { AgentContext, BaseAgent } from './BaseAgent';
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
  constructor(context: AgentContext) {
    super(context, undefined, 'planner');
  }

  async run(input: PlannerInput): Promise<string> {
    await this.initialize();
    const response = await this.invokePrompt(
      'task_decomposition' as PromptId,
      {
        intent: input.intent,
        priorities: input.priorities.join(', '),
        window: input.windowHint
      },
      {
        depth: 'high',
        budget: 'standard',
        quiet: false
      }
    );

    const mission = `${input.intent} (${input.priorities.join(', ')})`;
    const toStringArray = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
    const task: TaskItem = {
      taskId: randomUUID(),
      decisionId: this.context.decisionId,
      mission,
      dueAt: input.windowHint,
      priority: 'normal',
      relatedPeople: toStringArray(this.context.metadata?.relatedPeople),
      contextTags: toStringArray(this.context.metadata?.contextTags),
      followUpNeeded: true
    };

    await taskHistoryStore.record(task);
    return response;
  }
}
