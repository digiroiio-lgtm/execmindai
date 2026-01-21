# Agent → Prompt Mapping

ExecMindAI’s agents now exist as typed classes that source their behavior from versioned prompts defined under `src/prompts/`. This document clarifies which prompt each agent uses, when it runs, and the intent of the exchange.

| Agent | Prompt | Trigger | Input Snapshot | Behavior |
| --- | --- | --- | --- | --- |
| `PlannerAgent` | `task_decomposition@1.0.0` | Decisions requiring a structured plan (e.g., multi-step follow-up or task cluster) | `{ intent, priorities, window }` derived from parsed decision context | Splits high-level intent into actionable steps and surfaces dependencies so suggestions and calendar entries stay grounded. |
| `SuggestionAgent` | `suggestion_generation@1.0.0` | Background agent evaluation (momentum/context changes, travel overlaps, delayed follow-ups) | `{ context, decisions, travel }` pulled from `ContextStore` and `DecisionBehaviorLog` | Produces a single calm advisory nudge with CTA, respecting `silenceUntil` before delivering. |

Each prompt is versioned so we can roll out improved wording without retooling code. Agents call `PromptRegistry.getPrompt(id)` and log the prompt version in `BaseAgent.invokePrompt`. When you need a new prompt, add it under `src/prompts/` and register it in `src/prompts/index.ts`.
