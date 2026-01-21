import { Config, DeepPartial } from './types';

const prodConfig: DeepPartial<Config> = {
  environment: 'production',
  suggestion: {
    dailyLimit: 3
  },
  featureFlags: {
    enableVerboseLogging: false
  }
};

const prodLock: DeepPartial<Config> = {
  guard: {
    maxOutputTokens: {
      planner: 500,
      suggestion: 150
    }
  },
  cache: {
    suggestionTtlMs: 48 * 60 * 60 * 1000
  },
  runtime: {
    quietMode: true,
    logLevel: 'info'
  }
  ,
  security: {
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 10
    }
  }
};

export const productionLock = prodLock;
export default prodConfig;
