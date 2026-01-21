# ExecMindAI End-to-End Flow

This document outlines how ExecMindAI (voice or text) moves from raw executive thoughts to structured decisions, prioritized actions, and background intelligence—all while keeping noise down and mental load low.

## 1. Ingestion (voice = text)

1. A user speaks or types a thought wherever they prefer (mobile, desktop, quick capture).
2. The input is immediately routed to the ingestion queue; there is no distinction between voice vs text, no manual routing.
3. The system acknowledges receipt and shows a calm status (e.g., “Thanks, I’m structuring that for you”).

## 2. Parsing & structuring

1. The parser extracts primitives:
   * **Time references** (today, tomorrow, specific dates/times, ranges, implied due windows)
   * **People** (names, roles, teams)
   * **Intent** (meeting, task, reminder, payment, follow-up, research, healthcare, travel, etc.)
   * **Context** tags (travel, fundraising, healthcare, operations, high-priority, etc.)
2. Each fragment is classified as **Meeting, Task, Reminder, or Context-only**.
3. The system ensures no fragment remains floating; everything is attached to a decision intent or contextual awareness.

## 3. Decision routing

* **Meeting** fragments → prepare a calendar suggestion for Google/Apple (read/write). Show a proposed time span, participants, travel context; let user accept/adjust before writing.
* **Task** fragments → create a short task with a due moment, recommended priority, and supporting context (people, related projects).
* **Reminder** fragments → queue a future trigger with soft wording and a suggested delivery time/duration.
* **Context-only** fragments → store in the decision graph for background agent intelligence (no immediate action, but used for future hints).

Every decision is logged with metadata: time horizon (immediate vs speculative), type, latency, accept/delay/ignore behavior, and follow-up completion, without storing raw personal text.

## 4. User confirmation and edit

* System surfaces a minimal confirmation view that summarizes parsed pieces and proposed actions.
* The executive can accept, adjust (time, wording, participants), delay, or ignore. No action is taken without consent.
* The system respects “no clutter” by keeping UI sparse and quiet; confirmations are short, tonal, and minimal.

## 5. Execution

* Accepted meetings sync with calendar APIs; proposed updates are written with executive-smart defaults (avoid conflicts, suggest slots).
* Tasks feed the task list with due times, priorities, and contextual tags.
* Reminders are scheduled via the reminder service (notifications or future prompts).
* Context data goes into the background intelligence layer for future suggestions.

Everything is logged as a “decision behavior” record, not content.

## 6. Background agent & ongoing intelligence

1. The background agent continually reads:
   * Calendar events
   * Task backlog & completion signals
   * Context from recent inputs (travel plans, fundraising, healthcare themes, etc.)
2. It generates soft, advisory nudges such as:
   * “You’re in Boston next week; a relevant fundraising dinner is open for RSVP.”
   * “You marked this priority as urgent—consider blocking 30 minutes today.”
3. No self-created tasks; no spam. Suggestions are polite, infrequent, and future-oriented.

## 7. Outcome

* The executive never has to think about how to capture ideas—they simply speak/type.
* Every thought is structured, logged, and either scheduled or stored for context.
* ExecMindAI stays calm, second-brain-like, reducing mental load rather than adding noise.
