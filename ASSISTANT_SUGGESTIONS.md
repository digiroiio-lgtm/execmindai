# Assistant Suggestion Rule Set

ExecMindAI’s assistant suggestions are the quiet intelligence you hear from the background agent: advisory, contextual, infrequent, and never a task manager or alarm blast. These rules ensure it surfaces only when value is clear and tone stays executive-calm.

## 1. When the assistant may speak

1. **Context match + momentum** — A `contextTag` (travel, fundraising, healthcare, AI, etc.) has a high `momentumScore` and at least one related upcoming decision (meeting/task/reminder) is in `status=proposed`. The agent can remind: “You’ll be in Boston during these dates; a relevant investor dinner is open for RSVP.”
2. **Opportunity alignment** — Context overlaps with external opportunity data (e.g., known events from the opportunity catalog). Match occurs when:
   * Travel dates intersect the event window, or
   * Decision priority (`priorityHint=high`) aligns with opportunity topic, AND
   * No similar suggestion was sent in the past 48 hours.
3. **Risk or behavior signal** — A decision has been `delayed` or `ignored` while its `timeHorizon=short` and there is an unaddressed follow-up. Suggestion gently nudges: “This urgent board follow-up is still pending—would you like me to hold 15 minutes this afternoon?”
4. **Context refresh** — When the context store receives a new signal that expands a current theme (e.g., “AI research retreat” plus “AI trend”), confirm with a suggestion that packages the insight.

## 2. Conditions that suppress suggestions

1. **Silence windows** — Use `contextStore.silenceUntil` to mute the agent for a configurable span after the user dismisses a suggestion or explicitly says “not now.”
2. **Low confidence** — Do not surface suggestions when the combined confidence of matched context/opportunity is below `0.65`.
3. **Do-not-disturb** — If a calendar block or user preference indicates DND, prevent suggestions unless safety-critical (healthcare reminder, travel alert).
4. **Suggestion budget** — Limit to **3 suggestions per day** and **1 reminder per decision** to avoid spam.

## 3. Suggestion tone and delivery

* **Tone** — Polite, advisory, succinct. Use phrasing like “Consider,” “Quick note,” “If helpful,” “You might want to,” never commanding.
* **Format** — One-line summary + soft CTA (Follow up / Review / OK). Avoid forcing actions; instead offer options (Review Now / Delay / Save for later).
* **Channel** — Minimal native notification or inline message inside home feed; not a push unless the user explicitly opts into “gentle nudge” alerts.

## 4. Logging & feedback

* Every suggestion logs `suggestionId`, `relatedDecisionId`, context tags, trigger rule, delivery channel, and user feedback (`accepted`, `ignored`, `delayed`).
* Feedback feeds a simple reinforcement rule: repeated ignores raise `silenceUntil`.

## 5. Example signals

| Trigger | Suggestion Example | Tone | Guardrail |
| --- | --- | --- | --- |
| Travel + opportunity overlap | “Boston fund tour intersects with a London investor brunch—want me to hold a slot?” | Calm, option-focused | Only if no suggestion in 48h |
| Task delayed + high priority | “The Upwork deliverable is still pending; want to block 30 mins before tomorrow’s meeting?” | Suggestive, not urgent | Respect silenceUntil |
| Context tag refreshed (AI + healthcare) | “AI healthcare trend report is ready for review. Shall I queue it for tomorrow?” | Advisory | Only if `momentumScore>0.7` |
| Decision `proposed` and matching contact nearby | “Investor John S. is in town this week, and you have a free slot Friday afternoon—shall I save a draft invite?” | Gentle question | Do not auto send |

By following these rules, ExecMindAI keeps the assistant suggestions aligned with your executive flow: never noisy, always useful, and built on clear context + behavior signals.
