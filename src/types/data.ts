export type TimeHint = {
  type: 'datetime' | 'range' | 'window';
  value: string;
  confidence: number;
};

export type IntentCandidate = {
  intentType: 'meeting' | 'task' | 'reminder' | 'context';
  confidence: number;
};

export interface InputPrimitive {
  inputId: string;
  source: 'voice' | 'text';
  timestampReceived: string;
  rawText: string;
  timeHints: TimeHint[];
  people: Array<{ name: string; role?: string; confidence: number }>;
  intentCandidates: IntentCandidate[];
  contextTags: Array<{ tag: string; confidence: number }>;
  parserMetadata?: Record<string, unknown>;
}

export interface DecisionRecord {
  decisionId: string;
  decisionType: 'meeting' | 'task' | 'reminder' | 'context';
  primaryTime: string | { start: string; end: string };
  timeWindow?: { start: string; end: string };
  description: string;
  rawText?: string;
  participants?: string[];
  priorityHint: 'high' | 'normal' | 'contextual';
  confidence: number;
  status: 'proposed' | 'accepted' | 'adjusted' | 'ignored';
  proposedAction?: string;
  contextSnapshot?: Record<string, unknown>;
  createdAt: string;
  hasActiveSuggestion?: boolean;
  lastSuggestionId?: string;
  lastSuggestionOutcome?: string;
}

export interface TravelStatus {
  location: string;
  startAt: string;
  endAt: string;
}

export interface ContextEntry {
  contextTag: string;
  lastMentionedAt: string;
  relatedDecisions: string[];
  travelStatus: TravelStatus | null;
  momentumScore: number;
  silenceUntil: string | null;
  suggestionHistory: Array<{ suggestionId: string; sentAt: string }>;
}

export interface TaskItem {
  taskId: string;
  decisionId: string;
  mission: string;
  dueAt: string;
  priority: 'critical' | 'normal' | 'context';
  relatedPeople: string[];
  contextTags: string[];
  followUpNeeded: boolean;
}

export interface DecisionBehaviorLog {
  logId: string;
  suggestionId: string;
  decisionId: string;
  timeHorizon: 'short' | 'medium' | 'long';
  decisionType: 'meeting' | 'task' | 'reminder' | 'context';
  latencyMs: number;
  userOutcome: 'accepted' | 'delayed' | 'ignored';
  followUpCompleted: boolean;
  agentSuggestionOrigin: string;
}
