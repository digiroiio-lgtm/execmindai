import { AgentType, routeModel } from './ModelRouter';
import { LLMClient } from './LLMClient';
import { GuardViolation } from './outputGuard';
import { recordTelemetry } from './telemetry';

type CircuitState = {
  errorCount: number;
  openedUntil: number | null;
};

const circuitStates = new Map<string, CircuitState>();
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 20_000;

function getCircuit(provider: LLMClient): CircuitState {
  let state = circuitStates.get(provider.providerName);
  if (!state) {
    state = { errorCount: 0, openedUntil: null };
    circuitStates.set(provider.providerName, state);
  }
  return state;
}

function recordSuccess(provider: LLMClient) {
  const state = getCircuit(provider);
  state.errorCount = 0;
  state.openedUntil = null;
}

function recordFailure(provider: LLMClient) {
  const state = getCircuit(provider);
  state.errorCount += 1;
  if (state.errorCount >= CIRCUIT_THRESHOLD) {
    state.openedUntil = Date.now() + CIRCUIT_OPEN_MS;
    console.warn(`[ExecMindAI][Circuit] ${provider.providerName} tripped until ${new Date(state.openedUntil).toISOString()}`);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeWithResilience(
  agentType: AgentType,
  prompt: string,
  options: { model: string; maxTokens: number },
  providers: LLMClient[]
): Promise<string> {
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const circuit = getCircuit(provider);
    if (circuit.openedUntil && circuit.openedUntil > Date.now()) {
      continue;
    }

    let attempt = 0;
    const maxAttempts = 3;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const start = Date.now();
        const result = await provider.generate(prompt, options);
        const latency = Date.now() - start;
        const tokensIn = prompt.trim().split(/\s+/).filter(Boolean).length;
        const tokensOut = result.trim().split(/\s+/).filter(Boolean).length;
        recordTelemetry(provider.providerName, options.model, tokensIn, tokensOut, latency);
        recordSuccess(provider);
        return result;
      } catch (err) {
        recordFailure(provider);
        const statusCode = (err as any)?.status ?? 500;
        if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
          throw err;
        }
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
        const jitter = Math.random() * 200;
        console.warn(
          `[ExecMindAI][Retry] ${provider.providerName} attempt ${attempt} failed (${statusCode}), retrying in ${delayMs + jitter}ms`
        );
        await delay(delayMs + jitter);
      }
    }
    console.warn(`[ExecMindAI][Fallback] Switching provider after ${provider.providerName} failure`);
  }

  throw new GuardViolation('All LLM providers failed', agentType);
}
