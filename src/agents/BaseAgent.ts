import registry, { PromptDefinition, PromptId } from '../prompts';
import { AgentType, IntentFlags, routeModel } from '../llm/ModelRouter';
import { executeWithResilience } from '../llm/ResilientExecutor';
import { enforceOutputGuard, GuardViolation } from '../llm/outputGuard';
import { contextHash, getCacheKey, getCachedOutput, setCachedOutput } from '../llm/cache';

export interface AgentContext {
  decisionId: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export abstract class BaseAgent {
  private initialized = false;

  constructor(
    protected context: AgentContext,
    protected promptRegistry = registry,
    protected agentRole: AgentType = 'planner'
  ) {}

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

  protected async invokePrompt(
    id: PromptId,
    variables: Record<string, unknown>,
    flags: IntentFlags = {}
  ): Promise<string> {
    const prompt = this.getPrompt(id);
    const filledTemplate = prompt.template.replace(/\{(.+?)\}/g, (_, key) => {
      const value = variables[key];
      return typeof value === 'string' ? value : JSON.stringify(value ?? '');
    });
    console.log(`[${this.constructor.name}] invoking prompt:\n${filledTemplate}`);
    const { providers, model, maxTokens } = routeModel(this.agentRole, flags);
    console.log(
      `[${this.constructor.name}] routed to ${providers[0].providerName} (model ${model}, maxTokens ${maxTokens})`
    );
    const cacheKey = getCacheKey(this.agentRole, prompt.version, contextHash(variables));
    const cached = getCachedOutput(cacheKey);
    if (cached) {
      console.log(`[${this.constructor.name}] cache hit for ${cacheKey}`);
      return cached;
    }
    const raw = await executeWithResilience(this.agentRole, filledTemplate, { model, maxTokens }, providers);
    try {
      const guarded = enforceOutputGuard(this.agentRole, raw);
      setCachedOutput(cacheKey, guarded);
      return guarded;
    } catch (err) {
      if (err instanceof GuardViolation) {
        console.error('[ExecMindAI][GuardViolation]', err.message);
      }
      throw err;
    }
  }

  abstract run(...args: unknown[]): Promise<string>;
}
