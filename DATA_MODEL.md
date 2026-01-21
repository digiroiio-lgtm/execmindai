# ExecMindAI Data Model

This document captures the core types that transform raw voice/text inputs into structured decisions, actions, and context for ExecMindAI’s MVP.

## 1. Input primitives

Each raw user input enters the system as a single `InputPrimitive`. The parser enriches it and tracks provenance:

* `inputId` — unique identifier.
* `source` — `"voice"` or `"text"`.
* `timestampReceived`.
* `rawText`.
* `timeHints` — list of `{ type: "datetime"|"range"|"window", value: ISO, confidence }`.
* `people` — list of `{ name, role?, confidence }`.
* `intentCandidates` — scored list of `{ intentType: meeting|task|reminder|context, confidence }`.
* `contextTags` — inferred topics (travel, fundraising, healthcare, research, etc.) with confidence.
* `parserMetadata` — language, sentiment, any resolved entities (e.g., locations or project names).

## 2. Decision records

Once classified, the primitive becomes one or more `DecisionRecord`s:

* `decisionId` — ties downstream actions/logging to the source.
* `decisionType` — `meeting`, `task`, `reminder`, or `context`.
* `primaryTime` — normalized single datetime or `{ start, end }`.
* `timeWindow` — optional range for fuzzier planning.
* `description` — human summary (exec phrasing) and linked `rawText`.
* `participants` — alias for `people` used in calendars.
* `priorityHint` — executive smart default (`high`, `normal`, `contextual`).
* `confidence`.
* `status` — `proposed`, `accepted`, `adjusted`, `ignored`.
* `proposedAction` — reference to calendar/task/reminder entity.
* `contextSnapshot` — surrounding tags, travel states, and recent decisions for logging/agent.
* `createdAt`.

## 3. Action entities

Actions represent outputs that ExecMindAI can sync with downstream systems.

**CalendarEvent**
* `eventId` (exec AI internal).
* `decisionId`.
* `title`, `location`, `notes`.
* `startAt`, `endAt`.
* `attendees`.
* `syncStatus` — `pending`, `synced`, `error`.

**TaskItem**
* `taskId`.
* `decisionId`.
* `mission` (short directive), `dueAt`.
* `priority` — `critical`|`normal`|`context`.
* `relatedPeople`, `contextTags`.
* `followUpNeeded` (boolean).

**ReminderTrigger**
* `reminderId`.
* `decisionId`.
* `message`, `triggerAt`, `channel` (app push, email, etc.).
* `toneHint` — e.g., `gentle`, `urgent`.

## 4. Decision behavior logging

This analytics layer logs how the executive interacts with decisions.

* `logId`.
* `decisionId`.
* `timeHorizon` — `short` (today), `medium`, `long`.
* `decisionType`.
* `latencyMs` between proposal and action.
* `userOutcome` — `accepted`, `delayed`, `ignored`.
* `followUpCompleted` — boolean.
* `agentSuggestionOrigin` — if a background nudge influenced the outcome.

## 5. Context store

ExecMindAI keeps lightweight context for the background agent:

* `contextTag` key.
* `lastMentionedAt`.
* `relatedDecisions` (references).
* `travelStatus` — e.g., `{ location, startAt, endAt }`.
* `momentumScore` — recency-weighted value to prioritize agent suggestions.
* `silenceUntil` — optional timestamp to honor “stay silent” rules.

## 6. Background agent hooks

Agent rules reference these signals:

* If `contextTag=travel` and `travelStatus` ranges overlap with known events/opportunities → queue suggestion.
* When `momentumScore` high + `decisionStatus=proposed` + no follow-up → gently nudge.
* Respect `silenceUntil` by suppressing notifications unless safety-critical.

All records persist to JSON-first storage for Phase 1, then migrate to a lightweight DB once validated.
