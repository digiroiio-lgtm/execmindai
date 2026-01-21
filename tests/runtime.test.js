const test = require('node:test');
const assert = require('node:assert/strict');
const { rm, mkdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const MODULE_PATHS = [
  path.resolve(__dirname, '../dist/server.js'),
  path.resolve(__dirname, '../dist/memory/index.js'),
  path.resolve(__dirname, '../dist/memory/ContextStore.js'),
  path.resolve(__dirname, '../dist/memory/DecisionLog.js'),
  path.resolve(__dirname, '../dist/memory/TaskHistoryStore.js')
];

async function prepareDataDir(name) {
  const dir = path.resolve(__dirname, name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  return dir;
}

function loadServer(dataDir) {
  process.env.EXECMIND_DATA_DIR = dataDir;
  MODULE_PATHS.forEach((modulePath) => {
    delete require.cache[modulePath];
  });
  return require('../dist/server');
}

function parseSsePayload(chunks) {
  const payloadLine = chunks.find((chunk) => chunk.includes('data:'));
  if (!payloadLine) return null;
  return JSON.parse(payloadLine.replace(/^data:\s*/, '').trim());
}

test('SSE stream emits a suggestion', async () => {
  const dataDir = await prepareDataDir('tmp-sse');
  const { prepareRuntime, registerTestSuggestionClient, createSuggestion } = loadServer(dataDir);
  await prepareRuntime();

  const events = [];
  const release = registerTestSuggestionClient({
    write(chunk) {
      events.push(chunk.toString());
    }
  });

  try {
    const result = await createSuggestion({
      relatedDecisionId: 'dec-sse',
      suggestionText: 'Stream test',
      decisionType: 'task',
      timeHorizon: 'short'
    });

    assert(events.length > 0, 'no SSE payload captured');
    const payload = parseSsePayload(events);
    assert(payload, 'expected SSE data line');
    assert.strictEqual(payload.relatedDecisionId, 'dec-sse');
    assert.strictEqual(payload.suggestionId, result.suggestionId);
  } finally {
    release();
  }
});

test('Feedback updates the suggestion log', async () => {
  const dataDir = await prepareDataDir('tmp-feedback');
  const { prepareRuntime, createSuggestion, submitSuggestionFeedback } = loadServer(dataDir);
  await prepareRuntime();

  const { suggestionId } = await createSuggestion({
    relatedDecisionId: 'dec-fb',
    suggestionText: 'Feedback test',
    decisionType: 'task',
    timeHorizon: 'short'
  });

  const feedback = await submitSuggestionFeedback(suggestionId, { outcome: 'accepted' });
  assert.strictEqual(feedback.outcome, 'accepted');

  const logContent = await readFile(path.join(dataDir, 'suggestion_log.json'), 'utf-8');
  const log = JSON.parse(logContent);
  const entry = log.find((item) => item.suggestionId === suggestionId);
  assert(entry, 'suggestion entry missing');
  assert.strictEqual(entry.outcome, 'accepted');
  assert.strictEqual(entry.silenceUntil, null);
});
