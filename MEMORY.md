# Memory Stores

ExecMindAI now keeps lightweight, version-aligned memory stores so every suggestion can see richer context, decisions, and task history. The stores live in `src/memory/` and mirror `DATA_MODEL.md` fields.

* `ContextStore` – manages `contextTag`, `lastMentionedAt`, `momentumScore`, `silenceUntil`, and `travelStatus`; agents call `snapshot()` or `find()` before prompting and updates honor retention rules plus silent windows.
* `DecisionLog` – records `DecisionRecord`s with `status`, `priorityHint`, `contextSnapshot`, and suggestion markers; you can `touch()` entries as suggestions emit or clear them later.
* `TaskHistoryStore` – archives `TaskItem`s produced by `PlannerAgent` for a replayable view of what actions were suggested/prepared.

Each store exposes `snapshot()` and `reset()` so you can replay flows or clean memory between sessions. They also persist to JSON (`data/*.json`) for Phase 1 before upgrading to a database.
