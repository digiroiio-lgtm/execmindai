type ProviderUsage = {
  count: number;
  models: Record<string, number>;
};

export interface TelemetrySnapshot {
  requestCount: number;
  providerUsage: Record<string, ProviderUsage>;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  totalLatencyMs: number;
}

const telemetry: TelemetrySnapshot = {
  requestCount: 0,
  providerUsage: {},
  tokensIn: 0,
  tokensOut: 0,
  estimatedCost: 0,
  totalLatencyMs: 0
};

const COST_PER_TOKEN = 0.000002;

function normalizeProvider(providerName: string) {
  return providerName.toLowerCase();
}

function addProviderUsage(providerName: string, model: string) {
  const key = normalizeProvider(providerName);
  const usage = telemetry.providerUsage[key] ?? { count: 0, models: {} };
  usage.count += 1;
  usage.models[model] = (usage.models[model] ?? 0) + 1;
  telemetry.providerUsage[key] = usage;
}

export function recordTelemetry(
  providerName: string,
  model: string,
  tokensIn: number,
  tokensOut: number,
  latencyMs: number
) {
  telemetry.requestCount += 1;
  telemetry.tokensIn += tokensIn;
  telemetry.tokensOut += tokensOut;
  telemetry.estimatedCost += (tokensIn + tokensOut) * COST_PER_TOKEN;
  telemetry.totalLatencyMs += latencyMs;
  addProviderUsage(providerName, model);
  console.info(
    `[ExecMindAI][Telemetry] provider=${providerName},model=${model},tokensIn=${tokensIn},tokensOut=${tokensOut},latencyMs=${latencyMs.toFixed(
      1
    )}`
  );
}

export function snapshotTelemetry(): TelemetrySnapshot {
  return { ...telemetry, providerUsage: { ...telemetry.providerUsage } };
}
