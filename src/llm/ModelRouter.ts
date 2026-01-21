import { AnthropicProvider } from './AnthropicProvider';
import { GoogleProvider } from './GoogleProvider';
import { LLMClient } from './LLMClient';
import { OpenAIProvider } from './OpenAIProvider';
import { XAIProvider } from './XAIProvider';

export type AgentType = 'planner' | 'suggestion';
export type IntentFlags = {
  quiet?: boolean;
  budget?: 'low' | 'standard' | 'high';
  depth?: 'low' | 'medium' | 'high';
};

const providerMap: Record<string, LLMClient> = {
  openai: new OpenAIProvider(process.env.LLM_API_KEY ?? '', process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1'),
  anthropic: new AnthropicProvider(process.env.ANTHROPIC_API_KEY ?? ''),
  google: new GoogleProvider(process.env.GOOGLE_API_KEY ?? ''),
  xai: new XAIProvider(process.env.XAI_API_KEY ?? '')
};

const providerPreference = (process.env.LLM_PROVIDER ?? 'openai').toLowerCase();

const defaultProvider = providerMap[providerPreference] ?? providerMap.openai;

export function routeModel(agent: AgentType, flags: IntentFlags = {}) {
  const tokensByDepth = {
    low: 256,
    medium: 512,
    high: 1024
  };
  const maxTokens = tokensByDepth[flags.depth ?? 'medium'];
  let model = 'gpt-4o-mini';

  if (agent === 'planner') {
    model = flags.depth === 'high' ? 'gpt-4o' : 'gpt-4o-mini';
  } else {
    model = flags.quiet ? 'gpt-4o-mini' : 'gpt-4o';
  }

  if (flags.budget === 'low') {
    model = 'gpt-4o-mini';
  }

  const fallbackOrder = ['openai', 'anthropic', 'google', 'xai']
    .filter((key) => key !== providerPreference)
    .map((key) => providerMap[key]);
  const providers = [defaultProvider, ...fallbackOrder];
  return {
    providers,
    model,
    maxTokens
  };
}
