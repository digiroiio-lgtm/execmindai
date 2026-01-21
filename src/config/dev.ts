import { Config, DeepPartial, Environment } from './types';

const portOverride = process.env.DEV_SUGGESTION_PORT
  ? Number(process.env.DEV_SUGGESTION_PORT)
  : undefined;

const devConfig: DeepPartial<Config> = {
  environment: 'development',
  server: {
    port: portOverride ?? 3001
  },
  suggestion: {
    dailyLimit: 4
  },
  featureFlags: {
    enableVerboseLogging: true
  }
};

export default devConfig;
