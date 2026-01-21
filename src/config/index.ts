import defaultConfig from './default';
import devConfig from './dev';
import prodConfig, { productionLock } from './prod';
import { Config, DeepPartial, Environment } from './types';

const mergeDeep = <T>(target: T, source: DeepPartial<T>): T => {
  const output = { ...target } as any;
  Object.entries(source || {}).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    if (isObject(value) && isObject(output[key])) {
      output[key] = mergeDeep(output[key], value as DeepPartial<any>);
    } else {
      output[key] = value;
    }
  });
  return output;
};

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const environment = (process.env.NODE_ENV as Environment) ?? 'development';

const envOverrides: Record<Environment, DeepPartial<Config>> = {
  development: devConfig,
  production: prodConfig,
  staging: prodConfig,
  test: devConfig
};

const merged = mergeDeep(defaultConfig, envOverrides[environment] ?? {});
const locked =
  environment === 'production' ? mergeDeep(merged, productionLock ?? {}) : merged;

const runtimeConfig: Config = {
  ...locked,
  environment
};

export default runtimeConfig;
export type { Config, DelaySpan } from './types';
