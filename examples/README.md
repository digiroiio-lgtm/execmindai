# ExecMindAI Examples

These reference artifacts help new developers understand the data flow from raw input through parsing, suggestion delivery, and feedback.

* `voice_text_input.txt` – A synthetic executive utterance that ExecMindAI would capture.
* `parsed_decision.json` – Structured decision output derived from the parser.
* `suggestion_payload.json` – The JSON sent to `POST /suggestions` when the background agent crafts a nudge.
* `feedback_payload.json` – The JSON posted back to `POST /suggestions/{id}/feedback` when a suggestion is accepted or delayed.

Each file mirrors the schemas defined in `DATA_MODEL.md` and `API_CONTRACT.md`, so they can be used for manual testing or onboarding walkthroughs.
