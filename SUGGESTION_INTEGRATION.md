# Suggestion Integration

This note describes how ExecMindAI wires the assistant’s rule set (`ASSISTANT_SUGGESTIONS.md`) into the parser/context pipeline and decision logging so the background agent can evaluate `contextTags`, `momentumScore`, `silenceUntil`, and other signals before ever surfacing a suggestion.

## 1. Parser → decision + context records

1. **Parser emits InputPrimitive** (see `DATA_MODEL.md`). For every input it attaches:
   * `contextTags` with confidence and optional source (e.g., “travel”, “healthcare”).
   * `intentCandidates` that produce one or more `DecisionRecord`s.
2. **DecisionRecord creation** writes:
   * `contextSnapshot` merging recent `contextTags` (from InputPrimitive + ContextStore) so the agent immediately knows the active themes.
   * `priorityHint` and `timeHorizon` used later for momentum scoring and suggestion gating.
3. **ContextStore update** happens atomically with DecisionRecord creation:
   * Each `contextTag` key updates `lastMentionedAt`, `relatedDecisions`, and `momentumScore` (e.g., recency weighted: +1 base, decays over 12h).
   * Travel signals also populate `travelStatus` (location + range), letting the agent know where the executive will be.
   * If the user dismissed a suggestion earlier, set `silenceUntil` on the relevant context to respect suppression.

## 2. Decision log & suggestion metadata

1. Every DecisionRecord retains `status`. When the system proposes an action (calendar/task/reminder), it immediately logs a `DecisionBehaviorLog` entry with:
   * `timeHorizon`, `decisionType`, and `latencyMs` placeholders (filled when the user responds).
   * `relatedContextTags` to inform future suggestion evaluation.
2. When a suggestion is considered, capture a `SuggestionLog` (new table/JSON record) containing:
   * `suggestionId`, `relatedDecisionId`, trigger rule (`context-momentum`, `opportunity`, `risk`, etc.), `confidenceScore`, `channel`, and `contextState`.
   * `silenceUntil` evaluation known before dispatch; if active, the suggestion is silently discarded and still logged for analytics.
3. When the user responds (`accepted`, `ignored`, `delayed`), update `DecisionBehaviorLog.userOutcome` and optionally raise `silenceUntil` if ignored (`currentTime + backoff`, e.g., 4h) so future triggers respect the suppression window.

## 3. Suggestion evaluation flow

1. At fixed intervals or on new inputs, the suggestion engine inspects:
   * ContextStore entries with `momentumScore` above threshold (e.g., >0.7) and `silenceUntil <= now`.
   * Related `DecisionRecord`s where `status=proposed` and `priorityHint=high` or `timeHorizon=short`.
   * Matching opportunities (via travel windows, topic overlap, hybrid matches).
2. Each candidate passes through the rule set:
   * Combine evidence (context match + decision priority/opportunity) to compute a `suggestionConfidence`.
   * Check that the same context+opportunity pair hasn’t generated a suggestion in the past 48h (`ContextStore.suggestionHistory`).
   * Verify `suggestionBudget` (max 3/day) before dispatch.
3. Approved suggestions augment the UI/home feed (or send a gentle notification). They carry `toneHint` metadata for presentation, and their dispatch increments counters (`dailySuggestionCount`, `decision.suggestionCount`).

## 4. Implementation notes

* Start Phase 1 with JSON/LocalStorage-backed stores: `decision_records.json`, `context_store.json`, `suggestion_log.json`.
* Keep the suggestion engine lightweight—run every new decision or once per 15 minutes, whichever comes first.
* All writes should be idempotent (use `decisionId` or `suggestionId` as dedupe keys) to avoid duplicate suggestions.

With this wiring, the assistant can safely evaluate the context, honor silence windows, and log every interaction as part of the decision intelligence fabric.
