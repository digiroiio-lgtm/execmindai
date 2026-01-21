const test = require('node:test');
const assert = require('node:assert/strict');

const { routeModel } = require('../dist/llm/ModelRouter');
const { enforceOutputGuard, GuardViolation } = require('../dist/llm/outputGuard');
const { executeWithResilience } = require('../dist/llm/ResilientExecutor');

class MockProvider {
  constructor(name, failCount = 0) {
    this.providerName = name;
    this.failCount = failCount;
    this.callCount = 0;
  }

  async generate(prompt, options) {
    this.callCount += 1;
    if (this.callCount <= this.failCount) {
      const err = new Error('forced failure');
      err.status = 500;
      throw err;
    }

    return `${this.providerName}-${options.model}:${prompt}`;
  }
}

test('ModelRouter selects provider list and model based on agent type and flags', () => {
  const { providers, model } = routeModel('suggestion', { quiet: true });
  assert.strictEqual(model.includes('mini'), true);
  assert.ok(providers.length >= 1);
});

test('Enforce output guard prevents long suggestion text', () => {
  const shortText = 'Follow up with investor now.';
  assert.strictEqual(enforceOutputGuard('suggestion', shortText), shortText);

  const longText = 'Sentence one. Sentence two. Sentence three.';
  assert.throws(() => enforceOutputGuard('suggestion', longText), GuardViolation);
});

test('Resilient executor falls back to next provider after repeated errors', async () => {
  const badProvider = new MockProvider('bad', 2);
  const goodProvider = new MockProvider('good', 0);
  const providers = [badProvider, goodProvider];
  const prompt = 'Test prompt';
  const result = await executeWithResilience('suggestion', prompt, { model: 'test-model', maxTokens: 100 }, providers);
  assert.strictEqual(result.startsWith('good-test-model:'), true);
  assert.strictEqual(badProvider.callCount, 3);
  assert.strictEqual(goodProvider.callCount, 1);
});
