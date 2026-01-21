const SUPPORTED_PROVIDERS = new Set(['openai', 'anthropic', 'google', 'xai']);

const fail = (message: string): never => {
  console.error(`Env validation failed: ${message}`);
  process.exit(1);
};

const requireEnv = (key: string) => {
  if (!process.env[key]) {
    fail(`${key} is required`);
  }
};

const getProvider = () => (process.env.LLM_PROVIDER ?? '').toLowerCase();

export function validateEnv() {
  requireEnv('NODE_ENV');
  requireEnv('PORT');
  requireEnv('LLM_PROVIDER');

  const provider = getProvider();

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    fail(`Unsupported LLM_PROVIDER: ${provider || 'undefined'}`);
  }

  if (provider === 'openai' && !process.env.OPENAI_API_KEY && !process.env.LLM_API_KEY) {
    fail('OPENAI_API_KEY required for openai provider');
  }

  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    fail('ANTHROPIC_API_KEY required for anthropic provider');
  }
}
