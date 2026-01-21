# ExecMindAI API Contract

This document is the single source of truth for integrating with ExecMindAI’s suggestion service. All clients should rely on these three endpoints and the described payloads so the UI and agents stay in sync.

## GET /events (SSE stream)

**Purpose:** Stream freshly approved assistant suggestions (from the background agent) to connected clients so cards/notifications can show up in real time without polling.

**Request:** SSE subscription over HTTP GET; no body required. Clients should open an `EventSource` connection to `/events` and listen for `data:` frames.

**Response:** Each SSE frame delivers the latest suggestion log entry as JSON:
```json
{
  "suggestionId": "sug-1714670928523-4f8d9a",
  "relatedDecisionId": "dec-12345",
  "contextTags": ["travel-boston", "fundraising"],
  "suggestionText": "You’re in Boston during these dates; a relevant investor dinner is open—shall I hold a slot?",
  "toneHint": "gentle",
  "ctaOptions": ["follow_up", "review"],
  "triggerRule": "travel_opportunity",
  "confidence": 0.82,
  "syncAction": null,
  "decisionType": "meeting",
  "timeHorizon": "short",
  "deliveredAt": "2025-02-23T09:34:08.123Z"
}
```

**Streaming notes:** The server sends `retry: 10000` during the handshake so `EventSource` automatically reconnects if the network drops. Duplicate `suggestionId`s should be deduped client-side; the stream only emits non-muted suggestions (silence windows are enforced server-side).

## POST /suggestions

**Purpose:** Create a new assistant suggestion candidate based on parser output, agent rules, or tooling. The server records it, writes to the JSON logs, updates context/decision stores, and—if budget and feature flags allow—broadcasts it to connected clients.

**Request schema:**
```json
{
  "relatedDecisionId": "string",             // required
  "contextTags": ["string"],                 // optional inferred themes
  "suggestionText": "string",                // required one-liner
  "toneHint": "gentle",                      // optional; defaults to "gentle"
  "ctaOptions": ["accept","delay"],          // optional button set
  "triggerRule": "agent",                    // optional rule identifier
  "confidence": 0.75,                        // optional match score
  "syncAction": "createDraftCalendar",       // optional automation hint
  "decisionType": "task",                    // meeting|task|reminder|context
  "timeHorizon": "short"                     // short|medium|long
}
```

**Response schema (success):**
```json
{
  "suggestionId": "sug-1714670928523-4f8d9a",
  "deliveredAt": "2025-02-25T11:12:05.000Z"
}
```

**Errors:**  
- `400 Bad Request` when required fields missing.  
- `429 Too Many Requests` when the daily suggestion budget (configurable, default 3/day) is exceeded.  
- `503 Service Unavailable` when the background agent feature flag is disabled.  

## POST /suggestions/{id}/feedback

**Purpose:** Record the executive’s reaction (accept / delay / ignore) so the suggestion lifecycle honours silence windows, updates momentum, and logs decision behavior.

**Request schema:**
```json
{
  "outcome": "accepted",     // or "delayed" | "ignored"
  "delaySpan": "short"       // optional for delayed outcomes (short|medium|long)
}
```

**Response schema (success):**
```json
{
  "suggestionId": "sug-1714670928523-4f8d9a",
  "outcome": "delayed",
  "silenceUntil": "2025-02-25T11:27:05.000Z"
}
```

**Behavior notes:**  
- Accepted → clears `silenceUntil` for the affected contexts and logs a positive `DecisionBehaviorLog`.  
- Delayed/Ignored → extends `silenceUntil` (configured spans) and increments momentum for the muted context.  
- Every feedback event appends to `suggestion_log.json` & `decision_behavior_log.json` for analytics.  
- `404 Not Found` if the suggestion ID is unknown.
