# Suggestion Delivery Implementation Plan

Since this repo currently holds only conceptual docs, this implementation plan sketches the concrete pieces you’d add once the UI and services exist so the assistant suggestion pathway is wired end-to-end.

## 1. Event bus and listener

1. **Suggestion stream**: Suggestions are emitted by the background agent service whenever a candidate passes the rule set (`SuggestionIntegration`). The service pushes JSON payloads to an event bus (WebSocket channel, SSE, or polling endpoint) that the client subscribes to.
   * Payload fields: `suggestionId`, `relatedDecisionId`, `contextTags`, `confidence`, `toneHint`, `suggestionText`, `ctaOptions` (`accept`, `delay`, `ignore`), and optional `syncAction` (e.g., `createDraftCalendar`).
2. **UI listener** (mobile/web):
   * Subscribes to the bus during app initialization.
   * Dedupes by `suggestionId`.
   * Determines whether to render inline (app in foreground) or send a gentle notification (background/away).
   * Adds the suggestion card to the top of the feed and marks the `DecisionRecord` with `hasActiveSuggestion`.

## 2. Feedback handler API

1. Each CTA button calls the feedback endpoint (`POST /suggestions/{id}/feedback`) with payload `{ outcome: "accepted"|"delayed"|"ignored", delaySpan?: "short"|"medium"|"long" }`.
2. The handler:
   * Updates the `SuggestionLog` entry (create if missing) with `outcome`, `feedbackAt`, and `delaySpan`.
   * Updates `DecisionBehaviorLog` entry for `relatedDecisionId` with `userOutcome`, `latencyMs`, and increments `followUpCompleted` if applicable.
   * For `delayed/ignored`, calculates `ContextStore.silenceUntil = now + span` (short=15m, medium=1h, long=4h + backoff). For `accepted`, clears silence and records `contextStore.suggestionCount` increments.
   * If `syncAction` exists (e.g., attempt to open task editor), trigger that automation path after logging.

## 3. Persistence hooks

1. **ContextStore update**: When the feedback handler runs, it updates `ContextStore` entries referenced by `contextTags`:
   * Sets `silenceUntil` (per tag) whenever outcome is `delayed` or `ignored`.
   * Resets or lowers momentum score after an accepted suggestion to avoid repeat nudges.
2. **Suggestion log**: Append each candidate and its feedback to `suggestion_log.json` (Phase 1). Entry fields:
   * `suggestionId`, `relatedDecisionId`, `triggerRule`, `contextTags`, `confidence`, `deliveredAt`, `outcome`, `feedbackAt`, `silenceUntil`.
   * This log feeds analytics and powers the `silenceUntil` logic (e.g., repeated ignores raise backoff).

## 4. UI state considerations

* Cards showing “suggestion muted until X” read `ContextStore.silenceUntil`.
* Feedback buttons become disabled once outcome recorded to prevent duplicates.
* If the delay window expires, the card reappears unless max suggestions/day already hit.

## 5. Deployment notes

* Implement the event bus listener and feedback endpoint in the MVP backend stack (Node/Express or serverless).
* Keep all suggestion feedback records in JSON for Phase 1 (to match `decision_records.json`, `context_store.json`), then migrate to a DB when scaling.
* Unit test the handler for each outcome, ensuring `silenceUntil` calculations follow the configured spans/backoffs.

## SSE Lifecycle & Guardrails

* **Client connect/disconnect** – The SSE endpoint (`GET /events`) registers every response in `suggestionClients`; when the user closes the tab or refreshes, the connection drops and `req.on('close')` removes the listener so resources stay bounded.
* **Keep-alive** – The SSE handshake emits `retry: 10000` to suggest reconnection timing, and each suggestion push writes a `data: ...` frame. There is no separate heartbeat, but the persistent connection makes sure clients stay subscribed without polling.
* **Reconnect behavior** – Clients using `EventSource` automatically reconnect after network loss or refresh because the server honors the `retry` directive. Deduplication happens client-side (`suggestionId` per payload) so reconnecting simply resumes new events without re-delivering old ones.
* **silenceUntil awareness** – Even though silence windows are tracked in `ContextStore`, the SSE stream never delivers suppressed suggestions; when feedback sets `silenceUntil`, the guardrails stop future candidate creation for that context until the timestamp expires. Clients can optionally display “suggestions muted until X” badges derived from the context store snapshot returned by the UI.

This plan gives you the wiring blueprint needed once the UI/services exist so suggestions stay useful, logged, and respectful of the “stay silent” rules you care about.
