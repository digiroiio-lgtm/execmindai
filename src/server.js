const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.resolve(__dirname, '../data');
const STORES = {
  decisionRecords: path.join(DATA_DIR, 'decision_records.json'),
  contextStore: path.join(DATA_DIR, 'context_store.json'),
  suggestionLog: path.join(DATA_DIR, 'suggestion_log.json'),
  behaviorLog: path.join(DATA_DIR, 'decision_behavior_log.json')
};

const suggestionClients = new Set();

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  for (const file of Object.values(STORES)) {
    try {
      await fs.access(file);
    } catch (err) {
      if (err.code === 'ENOENT') {
        await fs.writeFile(file, '[]', 'utf-8');
      } else {
        throw err;
      }
    }
  }
}

async function readStore(storePath) {
  const raw = await fs.readFile(storePath, 'utf-8');
  return JSON.parse(raw);
}

async function writeStore(storePath, data) {
  await fs.writeFile(storePath, JSON.stringify(data, null, 2), 'utf-8');
}

const nowIso = () => new Date().toISOString();

function makeId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function minutesForSpan(span) {
  const mapping = {
    short: 15,
    medium: 60,
    long: 240
  };
  return mapping[span] || mapping.short;
}

async function broadcastSuggestion(payload) {
  const data = JSON.stringify(payload);
  for (const res of suggestionClients) {
    res.write(`data: ${data}\n\n`);
  }
}

async function updateContextStore(contextTags, suggestionId, relatedDecisionId) {
  if (!contextTags || contextTags.length === 0) {
    return;
  }

  const store = await readStore(STORES.contextStore);
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

    context.suggestionHistory = (context.suggestionHistory || []).filter((item) => {
      const age = Date.now() - new Date(item.sentAt).getTime();
      return age <= 48 * 60 * 60 * 1000;
    });
    context.suggestionHistory.push({ suggestionId, sentAt: now });
  });

  await writeStore(STORES.contextStore, store);
}

async function markDecisionForSuggestion(decisionId, suggestionId) {
  const records = await readStore(STORES.decisionRecords);
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

async function clearActiveSuggestion(decisionId, outcome) {
  const records = await readStore(STORES.decisionRecords);
  const record = records.find((entry) => entry.decisionId === decisionId);
  if (record) {
    record.hasActiveSuggestion = false;
    record.lastSuggestionOutcome = outcome;
  }
  await writeStore(STORES.decisionRecords, records);
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: nowIso() });
});

app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders && res.flushHeaders();
  res.write('retry: 10000\n\n');

  suggestionClients.add(res);
  req.on('close', () => {
    suggestionClients.delete(res);
  });
});

app.post('/suggestions', async (req, res) => {
  try {
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

    const suggestionId = makeId('sug');
    const deliveredAt = nowIso();
    const entry = {
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

    const log = await readStore(STORES.suggestionLog);
    log.push(entry);
    await writeStore(STORES.suggestionLog, log);

    await updateContextStore(contextTags, suggestionId, relatedDecisionId);
    await markDecisionForSuggestion(relatedDecisionId, suggestionId);

    await broadcastSuggestion({
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
      deliveredAt
    });

    res.status(201).json({ suggestionId, deliveredAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to emit suggestion' });
  }
});

app.post('/suggestions/:id/feedback', async (req, res) => {
  try {
    const { outcome, delaySpan } = req.body;
    if (!['accepted', 'delayed', 'ignored'].includes(outcome)) {
      return res.status(400).json({ error: 'invalid outcome' });
    }

    const log = await readStore(STORES.suggestionLog);
    const suggestion = log.find((entry) => entry.suggestionId === req.params.id);
    if (!suggestion) {
      return res.status(404).json({ error: 'suggestion not found' });
    }

    const feedbackAt = nowIso();
    suggestion.outcome = outcome;
    suggestion.feedbackAt = feedbackAt;
    suggestion.delaySpan = delaySpan || null;

    let newSilence = null;
    if (outcome === 'accepted') {
      newSilence = null;
    } else {
      const minutes = outcome === 'delayed' ? minutesForSpan(delaySpan) : minutesForSpan('long');
      newSilence = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    }

    suggestion.silenceUntil = newSilence;
    await writeStore(STORES.suggestionLog, log);

    const contextStore = await readStore(STORES.contextStore);
    (suggestion.contextTags || []).forEach((tag) => {
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
        entry.momentumScore = Math.max(0.1, (entry.momentumScore || 0.5) - 0.3);
      } else {
        entry.silenceUntil = newSilence;
        entry.momentumScore = Math.min(5, (entry.momentumScore || 0) + 0.25);
      }

      entry.lastMentionedAt = feedbackAt;
    });
    await writeStore(STORES.contextStore, contextStore);

    await clearActiveSuggestion(suggestion.relatedDecisionId, outcome);

    const behaviorLog = await readStore(STORES.behaviorLog);
    const deliveredAt = new Date(suggestion.deliveredAt).getTime();
    const latencyMs = Math.max(0, new Date(feedbackAt).getTime() - deliveredAt);
    behaviorLog.push({
      logId: makeId('beh'),
      suggestionId: suggestion.suggestionId,
      decisionId: suggestion.relatedDecisionId,
      timeHorizon: suggestion.timeHorizon || 'short',
      decisionType: suggestion.decisionType || 'task',
      latencyMs,
      userOutcome: outcome,
      followUpCompleted: outcome === 'accepted',
      agentSuggestionOrigin: suggestion.triggerRule || 'agent'
    });
    await writeStore(STORES.behaviorLog, behaviorLog);

    res.json({ suggestionId: suggestion.suggestionId, outcome, silenceUntil: newSilence });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register feedback' });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 3000;
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
