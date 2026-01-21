# Prompt Versioning & Agent Behavior

ExecMindAI agents rely on written prompts (see `src/prompts/*`) to stay predictable and calm. This document explains how prompt updates should be handled so every behavioral change is auditable.

## Evolution pattern

1. **Versions** – Each prompt file exports a `PromptDefinition` with `version` semantics (`v1.0.0`). Increment the version when you make changes that may alter output meaning, tone, or structure.
2. **Minor updates** – Typos, clarifying comments, or additional instructions that do not change the expected response structure can keep the same version or bump a patch (e.g., `v1.0.0` → `v1.0.1`).
3. **Major changes** – Adding/removing required variables, changing output format (number of bullet points, JSON vs prose), or shifting agent intent must bump the version (`v1.0.0` → `v2.0.0`) so downstream consumers know behavior may have changed.

## Breaking vs non-breaking

| Change type | Action |
| --- | --- |
| Tone/wording tweaks that preserve payload shape | Non-breaking; increment patch. |
| Adding new required placeholders | Breaking; version bump and update docs so dependent code stays in sync. |
| Changing response schema (e.g., now returning JSON) | Breaking; create a new prompt version and update `AGENT_PROMPT_MAPPING.md`. |
| Adjusting intent (e.g., Planner now asks for priorities) | Breaking; treat as `major` because clients expect the same action count/tone. |

## Updating Agent Mapping

Whenever a prompt version changes:

* Update `src/prompts/index.ts` to export the new definition (already ensures the registry tracks the latest version).
* Document the change in `AGENT_PROMPT_MAPPING.md`, adding a note with the new version, what changed, and why it matters.
* Backfill release notes (in `AGENT_PROMPT_MAPPING.md` or a separate changelog) so reviewers can audit what each agent will do before deployment.

Cross-reference `AGENT_PROMPT_MAPPING.md` and `src/prompts/*` whenever you edit prompts so downstream services remain aligned with the declared versions and behaviors.
