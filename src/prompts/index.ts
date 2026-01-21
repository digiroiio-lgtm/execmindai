import { PromptRegistry } from './prompt-registry';
import { TaskDecompositionPrompt } from './task_decomposition.prompt';
import { SuggestionGenerationPrompt } from './suggestion_generation.prompt';

const registry = new PromptRegistry({
  task_decomposition: TaskDecompositionPrompt,
  suggestion_generation: SuggestionGenerationPrompt
});

export default registry;
export { PromptRegistry, TaskDecompositionPrompt, SuggestionGenerationPrompt };
export type { PromptDefinition, PromptId } from './prompt-registry';
