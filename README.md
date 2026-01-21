# ExecMindAI — Executive Decision Engine

ExecMindAI is an AI-powered decision and prioritization engine for busy executives. It turns scattered thoughts and spoken or written moments of intention into structured, time-aware decisions so leaders can stop juggling mental clutter and focus on what matters.

## Core value

* **Quiet decision partner** — No notification spam and minimal UI keep the experience calm while automatically structuring meeting, task, reminder, and context signals.
* **Structured outputs** — Every input is parsed into times, people, intent, and context, then classified (Meeting, Task, Reminder, Context). Nothing floats, and the system always proposes a next step rather than leaving ideas unstructured.
 *Remains true to the guiding rule: does this reduce executive mental load?*

## Input handling

1. Voice and text inputs are treated identically. The user speaks or types and never needs to route content manually.
2. The parsing engine extracts time references, people, intents, and context tags.
3. Meetings map to calendars, tasks produce time-aware work items, reminders create future triggers, and context is stored for background intelligence.

## Integrations & behavior

* **Phase 1**: Connects to Google Calendar and Apple Calendar (read/write) with executive-smart defaults that always propose before acting.
* **Background agent**: Observes travel plans, priorities, and themes, then offers soft, respectful suggestions (opportunity/risk hints, daily nudges). It never generates tasks on its own or spams the user—only advisory nudges.

## Suggestion service

The Phase 1 service layer emits assistant suggestions via an SSE stream and captures feedback so `silenceUntil`, `momentumScore`, and the behavior logs stay up to date:

* `GET /events` keeps the UI synced with new suggestion payloads (`suggestionId`, `relatedDecisionId`, `contextTags`, `suggestionText`, `toneHint`, `ctaOptions`, `deliveredAt`).
* `POST /suggestions` accepts new candidates (from the rule engine or manual admin) and writes them to `data/suggestion_log.json`.
* `POST /suggestions/{id}/feedback` records accept/delay/ignore responses, updates `context_store.json`/`decision_records.json`, and appends to `decision_behavior_log.json`.

This service is built with Express (`npm start`) and keeps JSON-backed stores in `data/` that the parser, UI, and agent can inspect for the next suggestion cycle.

## Decision logging

ExecMindAI logs decision behavior (time horizon, type, latency, accept/delay/ignore, follow-up completion) while avoiding raw personal text or sensitive detail. This becomes strategic intelligence without violating privacy.

## Success criteria

* Executives feel they no longer have to think about where to capture thoughts—they just speak or type and their day makes sense.
* The tool stays calm, noise-free, and feels like a second brain, not another task list.
