import { PromptDefinition } from './prompt-registry';

export const SuggestionGenerationPrompt: PromptDefinition = {
  id: 'suggestion_generation',
  version: '1.0.0',
  description: 'Identifies soft advisory nudges based on travel, momentum, and priorities.',
  template: `You are ExecMindAI’s suggestion agent. Look at the active context tags, recent decisions, and travel windows,
then craft a single calm suggestion. Include why it matters, a gentle call-to-action, and respect silence windows.`,
  lastUpdated: '2024-05-01'
};
