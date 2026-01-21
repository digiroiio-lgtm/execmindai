import { Config, DelaySpan, Environment } from './types';

const env = process.env;

function parseNumber(key: string, fallback: number) {
  const value = env[key];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(key: string, fallback: boolean) {
  const value = env[key]?.toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function parseDelayMinutes(): Record<DelaySpan, number> {
  return {
    short: parseNumber('SUGGESTION_DELAY_SHORT', 15),
    medium: parseNumber('SUGGESTION_DELAY_MEDIUM', 60),
    long: parseNumber('SUGGESTION_DELAY_LONG', 240)
  };
}

const defaultConfig: Config = {
  environment: (env.NODE_ENV as Environment) ?? 'development',
  server: {
    port: parseNumber('SUGGESTION_PORT', 3000),
    requestTimeoutMs: parseNumber('SUGGESTION_TIMEOUT_MS', 15000)
  },
  suggestion: {
    dailyLimit: Math.max(1, parseNumber('DAILY_SUGGESTION_LIMIT', 3)),
    suggestionBudgetWindowHours: parseNumber('DAILY_SUGGESTION_WINDOW_HOURS', 24),
    delayMinutes: parseDelayMinutes(),
    contextRetentionHours: parseNumber('CONTEXT_RETENTION_HOURS', 48),
    momentumGainOnAccept: Number.isFinite(parseFloat(env['MOMENTUM_ON_ACCEPT'] ?? ''))
      ? parseFloat(env['MOMENTUM_ON_ACCEPT'] as string)
      : -0.3,
    momentumGainOnIgnore: Number.isFinite(parseFloat(env['MOMENTUM_ON_IGNORE'] ?? ''))
      ? parseFloat(env['MOMENTUM_ON_IGNORE'] as string)
      : 0.25
  },
  llm: {
    provider: env['LLM_PROVIDER'] ?? 'openai',
    model: env['LLM_MODEL'] ?? 'gpt-4o-mini',
    apiKey: env['LLM_API_KEY'] ?? '',
    baseUrl: env['LLM_BASE_URL'] ?? 'https://api.openai.com/v1'
  },
  featureFlags: {
    enableBackgroundAgent: parseBoolean('ENABLE_BACKGROUND_AGENT', true),
    enableSuggestionBroadcast: parseBoolean('ENABLE_SUGGESTION_BROADCAST', true),
    enableVerboseLogging: parseBoolean('ENABLE_VERBOSE_LOGGING', false)
  }
};

export default defaultConfig;
