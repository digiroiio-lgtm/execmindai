import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import config from './config';
import { DelaySpan } from './config/types';

const app = express();
app.use(cors());
app.use(express.json());
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.setTimeout(config.server.requestTimeoutMs);
  next();
});

const DATA_DIR = path.resolve(__dirname, '../data');
const STORES = {
  decisionRecords: path.join(DATA_DIR, 'decision_records.json'),
  contextStore: path.join(DATA_DIR, 'context_store.json'),
  suggestionLog: path.join(DATA_DIR, 'suggestion_log.json'),
  behaviorLog: path.join(DATA_DIR, 'decision_behavior_log.json')
} as const;

type StoreKey = keyof typeof STORES;

const suggestionClients = new Set<Response>();

interface SuggestionLogEntry {
  suggestionId: string;
  relatedDecisionId: string;
  contextTags: string[];
  suggestionText: string;
  toneHint: string;
  ctaOptions: string[];
  triggerRule: string;
  confidence: number;
  syncAction: string | null;
  decisionType: string;
  timeHorizon: string;
  deliveredAt: string;
  outcome: 'accepted' | 'delayed' | 'ignored' | null;
  feedbackAt: string | null;
  delaySpan: DelaySpan | null;
  silenceUntil: string | null;
}

interface ContextEntry {
  contextTag: string;
  lastMentionedAt: string;
  relatedDecisions: string[];
  momentumScore: number;
  travelStatus: null | { location: string; startAt: string; endAt: string };
  silenceUntil: string | null;
  suggestionHistory: Array<{ suggestionId: string; sentAt: string }>;
}

interface DecisionRecord {
  decisionId: string;
  createdAt: string;
  hasActiveSuggestion?: boolean;
  lastSuggestionId?: string;
  lastSuggestionOutcome?: string;
}

interface BehaviorLogEntry {
  logId: string;
  suggestionId: string;
  decisionId: string;
  timeHorizon: string;
  decisionType: string;
  latencyMs: number;
  userOutcome: 'accepted' | 'delayed' | 'ignored';
  followUpCompleted: boolean;
  agentSuggestionOrigin: string;
}

const nowIso = () => new Date().toISOString();
const contextRetentionMs = config.suggestion.contextRetentionHours * 60 * 60 * 1000;
const suggestionBudgetMs = config.suggestion.suggestionBudgetWindowHours * 60 * 60 * 1000;
const logVerbose = (...message: unknown[]) => {
  if (config.featureFlags.enableVerboseLogging) {
    console.log('[ExecMindAI]', ...message);
  }
};

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  for (const file of Object.values(STORES)) {
    try {
      await fs.access(file);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'ENOENT') {
        await fs.writeFile(file, '[]', 'utf-8');
      } else {
        throw err;
      }
    }
  }
}

async function readStore<T>(storePath: string): Promise<T[]> {
  const raw = await fs.readFile(storePath, 'utf-8');
  return JSON.parse(raw) as T[];
}

async function writeStore<T>(storePath: string, data: T[]) {
  await fs.writeFile(storePath, JSON.stringify(data, null, 2), 'utf-8');
}

function makeId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function minutesForSpan(span?: DelaySpan) {
  const key = span ?? 'short';
  return config.suggestion.delayMinutes[key];
}

async function broadcastSuggestion(payload: SuggestionLogEntry) {
  const data = JSON.stringify(payload);
  for (const res of suggestionClients) {
    res.write(`data: ${data}\n\n`);
  }
}

async function updateContextStore(contextTags: string[], suggestionId: string, relatedDecisionId: string) {
  if (!contextTags.length) {
    return;
  }

  const store = await readStore<ContextEntry>(STORES.contextStore);
  const now = nowIso();

  contextTags.forEach((tag) => {
    let context = store.find((entry) => entry.contextTag === tag);
    if (!context) {
      context = {
        contextTag: tag,
        lastMentionedAt: now,
        relatedDecisions: [],
        momentumScore: 0,
        travelStatus: null,
        silenceUntil: null,
        suggestionHistory: []
      };
      store.push(context);
    }

    context.lastMentionedAt = now;
    context.momentumScore = Math.min(5, (context.momentumScore || 0) + 1);
    if (!context.relatedDecisions.includes(relatedDecisionId)) {
      context.relatedDecisions.push(relatedDecisionId);
    }

    context.suggestionHistory = context.suggestionHistory.filter((item) => {
      const age = Date.now() - new Date(item.sentAt).getTime();
      return age <= contextRetentionMs;
    });

    context.suggestionHistory.push({ suggestionId, sentAt: now });
  });

  await writeStore(STORES.contextStore, store);
}

async function markDecisionForSuggestion(decisionId: string, suggestionId: string) {
  const records = await readStore<DecisionRecord>(STORES.decisionRecords);
  let record = records.find((entry) => entry.decisionId === decisionId);
  if (!record) {
    record = {
      decisionId,
      createdAt: nowIso(),
      hasActiveSuggestion: true,
      lastSuggestionId: suggestionId
    };
    records.push(record);
  } else {
    record.hasActiveSuggestion = true;
    record.lastSuggestionId = suggestionId;
  }
  await writeStore(STORES.decisionRecords, records);
}

async function clearActiveSuggestion(decisionId: string, outcome: string) {
  const records = await readStore<DecisionRecord>(STORES.decisionRecords);
  const record = records.find((entry) => entry.decisionId === decisionId);
  if (record) {
    record.hasActiveSuggestion = false;
    record.lastSuggestionOutcome = outcome;
  }
  await writeStore(STORES.decisionRecords, records);
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: nowIso() });
});

app.get('/events', (req: Request, res: Response) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  req.socket.setKeepAlive(true);
  res.flushHeaders && res.flushHeaders();
  res.write('retry: 10000\n\n');

  suggestionClients.add(res);
  req.on('close', () => {
    suggestionClients.delete(res);
  });
});

interface SuggestionRequestBody {
  relatedDecisionId: string;
  contextTags?: string[];
  suggestionText: string;
  toneHint?: string;
  ctaOptions?: string[];
  triggerRule?: string;
  confidence?: number;
  syncAction?: string | null;
  decisionType?: string;
  timeHorizon?: string;
}

app.post('/suggestions', async (req: Request<{}, {}, SuggestionRequestBody>, res: Response) => {
  try {
    if (!config.featureFlags.enableBackgroundAgent) {
      logVerbose('Background agent disabled via config');
      return res.status(503).json({ error: 'Background agent disabled' });
    }

    const {
      relatedDecisionId,
      contextTags = [],
      suggestionText,
      toneHint = 'gentle',
      ctaOptions = ['accept'],
      triggerRule = 'agent',
      confidence = 0.75,
      syncAction = null,
      decisionType = 'task',
      timeHorizon = 'short'
    } = req.body;

    if (!relatedDecisionId || !suggestionText) {
      return res.status(400).json({ error: 'relatedDecisionId and suggestionText are required' });
    }

    const log = await readStore<SuggestionLogEntry>(STORES.suggestionLog);
    const windowStart = Date.now() - suggestionBudgetMs;
    const recentCount = log.filter((entry) => {
      const time = new Date(entry.deliveredAt).getTime();
      return time >= windowStart;
    }).length;

    if (recentCount >= config.suggestion.dailyLimit) {
      logVerbose('Daily suggestion budget hit', recentCount);
      return res.status(429).json({ error: 'Daily suggestion budget reached' });
    }

    const suggestionId = makeId('sug');
    const deliveredAt = nowIso();
    const entry: SuggestionLogEntry = {
      suggestionId,
      relatedDecisionId,
      contextTags,
      suggestionText,
      toneHint,
      ctaOptions,
      triggerRule,
      confidence,
      syncAction,
      decisionType,
      timeHorizon,
      deliveredAt,
      outcome: null,
      feedbackAt: null,
      delaySpan: null,
      silenceUntil: null
    };

    log.push(entry);
    await writeStore(STORES.suggestionLog, log);

    await updateContextStore(contextTags, suggestionId, relatedDecisionId);
    await markDecisionForSuggestion(relatedDecisionId, suggestionId);

    if (config.featureFlags.enableSuggestionBroadcast) {
      await broadcastSuggestion(entry);
    } else {
      logVerbose('Suggestion broadcast skipped (feature flag is off)');
    }

    res.status(201).json({ suggestionId, deliveredAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to emit suggestion' });
  }
});

interface SuggestionFeedbackBody {
  outcome: 'accepted' | 'delayed' | 'ignored';
  delaySpan?: DelaySpan;
}

app.post('/suggestions/:id/feedback', async (req: Request<{ id: string }, {}, SuggestionFeedbackBody>, res: Response) => {
  try {
    const { outcome, delaySpan } = req.body;

    const log = await readStore<SuggestionLogEntry>(STORES.suggestionLog);
    const suggestion = log.find((entry) => entry.suggestionId === req.params.id);
    if (!suggestion) {
      return res.status(404).json({ error: 'suggestion not found' });
    }

    const feedbackAt = nowIso();
    suggestion.outcome = outcome;
    suggestion.feedbackAt = feedbackAt;
    suggestion.delaySpan = delaySpan ?? null;

    const newSilence =
      outcome === 'accepted'
        ? null
        : new Date(Date.now() + minutesForSpan(delaySpan) * 60 * 1000).toISOString();

    suggestion.silenceUntil = newSilence;
    await writeStore(STORES.suggestionLog, log);

    const contextStore = await readStore<ContextEntry>(STORES.contextStore);
    suggestion.contextTags.forEach((tag) => {
      let entry = contextStore.find((item) => item.contextTag === tag);
      if (!entry) {
        entry = {
          contextTag: tag,
          lastMentionedAt: feedbackAt,
          relatedDecisions: [],
          momentumScore: 0,
          travelStatus: null,
          silenceUntil: null,
          suggestionHistory: []
        };
        contextStore.push(entry);
      }

      if (outcome === 'accepted') {
        entry.silenceUntil = null;
        entry.momentumScore = Math.max(
          0.1,
          (entry.momentumScore || 0.5) + config.suggestion.momentumGainOnAccept
        );
      } else {
        entry.silenceUntil = newSilence;
        entry.momentumScore = Math.min(
          5,
          (entry.momentumScore || 0) + config.suggestion.momentumGainOnIgnore
        );
      }

      entry.lastMentionedAt = feedbackAt;
    });
    await writeStore(STORES.contextStore, contextStore);

    await clearActiveSuggestion(suggestion.relatedDecisionId, outcome);

    const behaviorLog = await readStore<BehaviorLogEntry>(STORES.behaviorLog);
    const deliveredAt = new Date(suggestion.deliveredAt).getTime();
    const latencyMs = Math.max(0, new Date(feedbackAt).getTime() - deliveredAt);
    behaviorLog.push({
      logId: makeId('beh'),
      suggestionId: suggestion.suggestionId,
      decisionId: suggestion.relatedDecisionId,
      timeHorizon: suggestion.timeHorizon,
      decisionType: suggestion.decisionType,
      latencyMs,
      userOutcome: outcome,
      followUpCompleted: outcome === 'accepted',
      agentSuggestionOrigin: suggestion.triggerRule
    });
    await writeStore(STORES.behaviorLog, behaviorLog);

    res.json({ suggestionId: suggestion.suggestionId, outcome, silenceUntil: newSilence });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register feedback' });
  }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : config.server.port;

ensureDataFiles()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`ExecMindAI suggestion service listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize data stores', err);
    process.exit(1);
  });
