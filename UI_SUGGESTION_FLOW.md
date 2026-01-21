# Suggestion Delivery & Feedback Flow

ExecMindAI must surface assistant suggestions gently through the UI while capturing feedback (accept/delay/ignore) to update `silenceUntil` and `decision` behavior logs. This note sketches the pathway from rule evaluation to notification and response handling.

## 1. Trigger → delivery

1. Suggestion engine selects a candidate (see `SUGGESTION_INTEGRATION.md`). Each candidate has:
   * `suggestionId`, `relatedDecisionId`, `toneHint`, `confidence`, `suggestionText`, `ctaOptions`.
2. The UI receives the candidate via a lightweight event bus (websocket/poll). It determines placement:
   * **Home feed card**: If the user is in the app, place a slim card above “Today’s Briefing.” Includes icon, short text, CTA buttons (e.g., Follow Up / Review / Not Now) and indicator of suggested context.
   * **Minimal notification**: If the user is away but enabled gentle alerts, send a single line notification (no vibration) referencing context and CTA.
3. UI marks the `DecisionRecord` (or higher-level `contextTag`) as having an active suggestion so repeated suggestions are blocked until resolved.

## 2. Feedback buttons

Buttons in the suggestion card:
* **Accept / Follow Up** — triggers an immediate action (e.g., draft calendar invite, open task editor) or records a positive response; logs `userOutcome=accepted`.
* **Delay** — records `userOutcome=delayed`, sets `silenceUntil = now + delaySpan` (configurable: short=15m, medium=1h, long=4h). Suggestion remains bookmarked in the UI until the window passes.
* **Ignore / Not Now** — records `userOutcome=ignored`, raises `silenceUntil = now + backoff` (e.g., 4h) to prevent repeat; optionally hides the card.

Deletion or swipe actions also count as `ignored` if no affirmative response is chosen within 5 minutes.

## 3. Feedback handling

1. UI reports choice back to the suggestion engine:
   * Updates `DecisionBehaviorLog` with `userOutcome`, `latency`, `followUpCompleted`.
   * Sets `ContextStore.silenceUntil` for affected tags (if delay/ignore).
2. If the suggestion triggered automation (e.g., drafting a calendar invite), the action flow records `status=accepted` and updates `suggestionLog`.
3. All logs are appended to `suggestion_log.json` (Phase 1) and flagged for agent analytics so future suggestions learn from ignores/delays.

## 4. Visual cues

* Suggested cards stay visually distinct (light border, subtle accent) and vanish once acted upon or suppressed.
* Daily suggestion counter lives in the footer; reaching max (3/day) greys out new suggestion badges until midnight.
* Silence window status may show a tiny “suggestions muted until 3:15 PM” badge inside the profile or assistant panel, reinforcing the system respects downtime.

By walking through this pathway, each assistant suggestion becomes a low-friction prompt that the executive can handle instantly, while every interaction teaches the system when to stay silent.
