# Data Store contracts

All Phase‑1 persistence lives in `data/*.json`. These files are append-only clients for ExecMindAI's memory and analytics—each file owns a single responsibility, respects retention rules, and avoids storing raw speech/text that could be sensitive.

| File | Stores | Write cadence | Retention | Contains raw text? |
| --- | --- | --- | --- | --- |
| `decision_records.json` | Structured `DecisionRecord`s (ID, intent classification, time hints, status, decision metadata). Every suggestion or parser action touches this store when a decision is proposed, accepted, or updated. | O(1) per parsed decision or suggestion state change | Live indefinitely for Phase 1 (rotate/archive later). | ❌ (only metadata, raw text lives in parser payloads and is not persisted here). |
| `context_store.json` | `ContextEntry`s tracking context tags, mention recency, momentum score, travel windows, and `silenceUntil`. Updated whenever suggestions fire, feedback arrives, or new context is parsed. | O(1) per context mention, roughly matching incoming inputs | Rolling interest window (configurable `CONTEXT_RETENTION_HOURS`) before historical entries decay. | ❌ (stores only tags and sanitized metadata). |
| `suggestion_log.json` | Candidate suggestions + feedback audit (trigger rule, CTA, delivered timestamp, outcome, silenceUntil). Every emitted suggestion and its feedback append to this file. | O(1) per suggestion, typically bounded by the daily limit | Archive annually or after analytics retention policy; old entries can be pruned. | ❌ (stores only suggestion summaries, not original speech). |
| `decision_behavior_log.json` | Analytics records covering latency, outcome, horizon, and whether the agent suggested an action. Written when feedback occurs. | O(1) per feedback event | Retain to understand decision behavior trends; anonymize before long-term analysis. | ❌ (no raw user text). |
| `task_history.json` | `TaskItem` archive created by `PlannerAgent` runs (mission, due date, priority, relevant contexts). | Append when planner decomposes intent | Phase 1: kept until intentional reset, later move to DB with TTL. | ❌ (task missions are synthesized, not raw transcripts). |

Every store is JSON-backed now for rapid prototyping. When moving to a database, the same ownership boundaries should apply so privacy expectations remain MachineAIdegen. If a store ever needs raw text (e.g., for debugging), wrap it with explicit retention flags and obtain consent before persisting.
