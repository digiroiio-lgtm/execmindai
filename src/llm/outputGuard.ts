import { AgentType } from './ModelRouter';
import config from '../config';

export class GuardViolation extends Error {
  constructor(message: string, public readonly agent: AgentType) {
    super(message);
    this.name = 'GuardViolation';
  }
}

type GuardRule = {
  maxTokens: number;
  maxSentences?: number;
  allowedCta?: RegExp;
  maxCtaMatches?: number;
};

const guardRules: Record<AgentType, GuardRule> = {
  planner: {
    maxTokens: config.guard.maxOutputTokens.planner
  },
  suggestion: {
    maxTokens: config.guard.maxOutputTokens.suggestion,
    maxSentences: 2,
    allowedCta: /\b(Follow up|Review|Delay)\b/gi,
    maxCtaMatches: 1
  }
};

function countSentences(text: string) {
  const matches = text.match(/[^.!?]+[.!?]/g);
  return matches ? matches.length : text.trim() ? 1 : 0;
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function enforceOutputGuard(agent: AgentType, output: string): string {
  const rule = guardRules[agent];
  const trimmed = output.trim();
  const tokens = countWords(trimmed);
  if (tokens > rule.maxTokens) {
    const message = `Output (${tokens} tokens) exceeds maxTokens(${rule.maxTokens}) for ${agent}`;
    console.warn(`[ExecMindAI][Guard] ${message}`);
    throw new GuardViolation(message, agent);
  }

  if (rule.maxSentences !== undefined) {
    const sentences = countSentences(trimmed);
    if (sentences < 1 || sentences > rule.maxSentences) {
      const message = `Output has ${sentences} sentences (allowed 1-${rule.maxSentences}) for ${agent}`;
      console.warn(`[ExecMindAI][Guard] ${message}`);
      throw new GuardViolation(message, agent);
    }
  }

  if (rule.allowedCta) {
    const matches = trimmed.match(rule.allowedCta) ?? [];
    if (rule.maxCtaMatches !== undefined && matches.length > rule.maxCtaMatches) {
      const message = `CTA mentions (${matches.length}) exceed allowed ${rule.maxCtaMatches} for ${agent}`;
      console.warn(`[ExecMindAI][Guard] ${message}`);
      throw new GuardViolation(message, agent);
    }
  }

  return trimmed;
}
