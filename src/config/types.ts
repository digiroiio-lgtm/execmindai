export type Environment = 'development' | 'production' | 'staging' | 'test';

export type DelaySpan = 'short' | 'medium' | 'long';

export type AgentType = 'planner' | 'suggestion';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface GuardSettings {
  maxOutputTokens: Record<AgentType, number>;
}

export interface CacheSettings {
  suggestionTtlMs: number;
}

export interface RuntimeSettings {
  quietMode: boolean;
  logLevel: LogLevel;
}

export interface SecuritySettings {
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

export interface Config {
  environment: Environment;
  server: {
    port: number;
    requestTimeoutMs: number;
  };
  suggestion: {
    dailyLimit: number;
    suggestionBudgetWindowHours: number;
    delayMinutes: Record<DelaySpan, number>;
    contextRetentionHours: number;
    momentumGainOnAccept: number;
    momentumGainOnIgnore: number;
  };
  llm: {
    provider: string;
    model: string;
    apiKey: string;
    baseUrl: string;
  };
  featureFlags: {
    enableBackgroundAgent: boolean;
    enableSuggestionBroadcast: boolean;
    enableVerboseLogging: boolean;
  };
  guard: GuardSettings;
  cache: CacheSettings;
  runtime: RuntimeSettings;
  security: SecuritySettings;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
