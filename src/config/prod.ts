import { Config, DeepPartial } from './types';

const prodConfig: DeepPartial<Config> = {
  environment: 'production',
  suggestion: {
    dailyLimit: process.env.PROD_DAILY_SUGGESTION_LIMIT
      ? Number(process.env.PROD_DAILY_SUGGESTION_LIMIT)
      : 3
  },
  featureFlags: {
    enableVerboseLogging: false
  }
};

export default prodConfig;
