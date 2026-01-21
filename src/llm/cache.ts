import { AgentType } from './ModelRouter';
import config from '../config';

const TTL_MS = config.cache.suggestionTtlMs;

function normalizeVariables(vars: Record<string, unknown>) {
  const keys = Object.keys(vars).sort();
  const normalized: Record<string, unknown> = {};
  keys.forEach((key) => {
    const value = vars[key];
    normalized[key] = typeof value === 'object' ? JSON.stringify(value) : value;
  });
  return normalized;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function contextHash(variables: Record<string, unknown>) {
  const normalized = normalizeVariables(variables);
  return hashString(JSON.stringify(normalized));
}

type CacheEntry = {
  output: string;
  createdAt: number;
};

const cache = new Map<string, CacheEntry>();

export function getCacheKey(agent: AgentType, promptVersion: string, contextHashValue: string) {
  return `${agent}:${promptVersion}:${contextHashValue}`;
}

export function getCachedOutput(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.output;
}

export function setCachedOutput(key: string, output: string) {
  cache.set(key, { output, createdAt: Date.now() });
}
