export type Environment = 'development' | 'production' | 'staging' | 'test';

export type DelaySpan = 'short' | 'medium' | 'long';

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
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
