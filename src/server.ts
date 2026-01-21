import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import config from './config';
import { DelaySpan } from './config/types';
import { initializeStores, contextStore, decisionLog } from './memory';
import { DecisionBehaviorLog } from './types/data';
import http from 'http';
import { AddressInfo } from 'net';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
app.use(cors());
app.use(express.json());
app.disable('x-powered-by');
app.use(helmet());
const suggestionRateLimiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Rate limit exceeded' });
  }
});
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.setTimeout(config.server.requestTimeoutMs);
  next();
});

const suggestionClients = new Set<Response>();
type SuggestionClient = {
  write(chunk: string): void;
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

const DATA_DIR = path.resolve(process.env.EXECMIND_DATA_DIR ?? path.resolve(__dirname, '../data'));
const LOG_STORES = {
  suggestionLog: path.join(DATA_DIR, 'suggestion_log.json'),
  behaviorLog: path.join(DATA_DIR, 'decision_behavior_log.json')
} as const;

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
const nowIso = () => new Date().toISOString();
const suggestionBudgetMs = config.suggestion.suggestionBudgetWindowHours * 60 * 60 * 1000;
const logVerbose = (...message: unknown[]) => {
  if (config.featureFlags.enableVerboseLogging) {
    console.log('[ExecMindAI]', ...message);
  }
};

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  for (const file of Object.values(LOG_STORES)) {
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

export async function prepareRuntime() {
  await initializeStores();
  await ensureDataFiles();
}

export function registerTestSuggestionClient(client: SuggestionClient) {
  const response = client as unknown as Response;
  suggestionClients.add(response);
  return () => {
    suggestionClients.delete(response);
  };
}

export async function createSuggestion(payload: SuggestionRequestBody) {
  if (!config.featureFlags.enableBackgroundAgent) {
    throw new HttpError(503, 'Background agent disabled');
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
  } = payload;

  if (!relatedDecisionId || !suggestionText) {
    throw new HttpError(400, 'relatedDecisionId and suggestionText are required');
  }

  const log = await readStore<SuggestionLogEntry>(LOG_STORES.suggestionLog);
  const windowStart = Date.now() - suggestionBudgetMs;
  const recentCount = log.filter((entry) => {
    const time = new Date(entry.deliveredAt).getTime();
    return time >= windowStart;
  }).length;

  if (recentCount >= config.suggestion.dailyLimit) {
    throw new HttpError(429, 'Daily suggestion budget reached');
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
  await writeStore(LOG_STORES.suggestionLog, log);

  await recordContextMentions(contextTags, suggestionId, relatedDecisionId);
  await markDecisionActive(relatedDecisionId, suggestionId);

  if (config.featureFlags.enableSuggestionBroadcast) {
    await broadcastSuggestion(entry);
  } else {
    logVerbose('Suggestion broadcast skipped (feature flag is off)');
  }

  return { suggestionId, deliveredAt };
}

export async function submitSuggestionFeedback(
  suggestionId: string,
  payload: SuggestionFeedbackBody
) {
  const { outcome, delaySpan } = payload;
  if (!['accepted', 'delayed', 'ignored'].includes(outcome)) {
    throw new HttpError(400, 'invalid outcome');
  }

  const log = await readStore<SuggestionLogEntry>(LOG_STORES.suggestionLog);
  const suggestion = log.find((entry) => entry.suggestionId === suggestionId);
  if (!suggestion) {
    throw new HttpError(404, 'suggestion not found');
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
  await writeStore(LOG_STORES.suggestionLog, log);

  await Promise.all(
    suggestion.contextTags.map(async (tag) => {
      if (!contextStore.find(tag)) {
        await contextStore.bumpContext(tag, { decisionId: suggestion.relatedDecisionId });
      }

      if (outcome === 'accepted') {
        await contextStore.adjustMomentum(tag, config.suggestion.momentumGainOnAccept);
        await contextStore.setSilence(tag, null);
      } else {
        await contextStore.adjustMomentum(tag, config.suggestion.momentumGainOnIgnore);
        await contextStore.setSilence(tag, newSilence);
      }
    })
  );

  await clearDecisionSuggestion(suggestion.relatedDecisionId, outcome);

  const behaviorLog = await readStore<DecisionBehaviorLog>(LOG_STORES.behaviorLog);
  const deliveredAt = new Date(suggestion.deliveredAt).getTime();
  const latencyMs = Math.max(0, new Date(feedbackAt).getTime() - deliveredAt);
  behaviorLog.push({
    logId: makeId('beh'),
    suggestionId: suggestion.suggestionId,
    decisionId: suggestion.relatedDecisionId,
    timeHorizon: suggestion.timeHorizon as DecisionBehaviorLog['timeHorizon'],
    decisionType: suggestion.decisionType as DecisionBehaviorLog['decisionType'],
    latencyMs,
    userOutcome: outcome,
    followUpCompleted: outcome === 'accepted',
    agentSuggestionOrigin: suggestion.triggerRule
  });
  await writeStore(LOG_STORES.behaviorLog, behaviorLog);

  return { suggestionId: suggestion.suggestionId, outcome, silenceUntil: newSilence };
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

async function recordContextMentions(contextTags: string[], suggestionId: string, decisionId: string) {
  await Promise.all(
    contextTags.map((tag) =>
      contextStore.bumpContext(tag, {
        decisionId,
        suggestionId
      })
    )
  );
}

async function markDecisionActive(decisionId: string, suggestionId: string) {
  await decisionLog.touch(decisionId, {
    hasActiveSuggestion: true,
    lastSuggestionId: suggestionId
  });
}

async function clearDecisionSuggestion(decisionId: string, outcome: string) {
  await decisionLog.touch(decisionId, {
    hasActiveSuggestion: false,
    lastSuggestionOutcome: outcome
  });
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

app.post(
  '/suggestions',
  suggestionRateLimiter,
  async (req: Request<{}, {}, SuggestionRequestBody>, res: Response) => {
    try {
      const result = await createSuggestion(req.body);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error(err);
      res.status(500).json({ error: 'Failed to emit suggestion' });
    }
  }
);

interface SuggestionFeedbackBody {
  outcome: 'accepted' | 'delayed' | 'ignored';
  delaySpan?: DelaySpan;
}

app.post(
  '/suggestions/:id/feedback',
  suggestionRateLimiter,
  async (req: Request<{ id: string }, {}, SuggestionFeedbackBody>, res: Response) => {
    try {
      const result = await submitSuggestionFeedback(req.params.id, req.body);
      res.json(result);
    } catch (err) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error(err);
      res.status(500).json({ error: 'Failed to register feedback' });
    }
  }
);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

export async function startServer(overridePort?: number) {
  const basePort =
    overridePort ??
    (process.env.PORT ? Number(process.env.PORT) : config.server.port);
  await initializeStores();
  await ensureDataFiles();

  return new Promise<{ server: http.Server; port: number }>((resolve, reject) => {
    const server = app.listen(basePort, '127.0.0.1');
    server.once('listening', () => {
      const address = server.address() as AddressInfo;
      console.log(`ExecMindAI suggestion service listening on http://localhost:${address.port}`);
      resolve({ server, port: address.port });
    });
    server.once('error', (err) => {
      reject(err);
    });
  });
}

export { app };

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to initialize stores', err);
    process.exit(1);
  });
}
