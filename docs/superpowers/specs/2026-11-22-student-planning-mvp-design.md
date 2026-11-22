# Student Companion: Confirmed Study Plan MVP

## Why

The competition prototype currently showcases a capable-looking dashboard, but the assistant is a deterministic mock and cannot propose a conflict-checked, reviewable, saved study plan. The smallest meaningful improvement is one trustworthy end-to-end student scheduling workflow, not more campus features.

## Scope (this increment)

- Use only the existing fictional timetable, assignment deadlines, and demo date (Monday 23 November 2026).
- For requests to plan a week or study for deadlines, propose up to three 60-minute sessions for pending assignments before their deadlines. As an MVP heuristic, pick the two closest deadlines and one additional high-weight task; explicitly list others as not included.
- Prefer starting study within the two days before each deadline where possible, rather than filling every available Monday slot. Search earlier slots as a fallback when needed.
- Use pure application code to check lesson and already-confirmed study blocks. Cancelled lessons are not busy time. Sessions must never overlap and must stay within an explicit 09:00–21:00 MYT study window.
- Surface assumptions (especially vague meetings). A mentioned “Wednesday evening” blocks Wednesday 18:00–21:00 for the proposal only; do not pretend the time was provided.
- Display a reviewable proposal in the existing agent panel. Students may adjust start/end times or reject it. Validate edits and recheck conflicts at confirmation.
- Store confirmed sessions in browser-local demo state, surviving reload, and show them on the home dashboard.
- Cover core logic with unit tests and show the distinction between the demo rule-based planner and a real LLM.

## Non-goals

- No real AC/Moodle integrations, scraping, credential collection, real student information, push notifications or official university claims.
- No Gemini integration yet: provider selection and secret management remain a separate technical decision. A scripted planner must not be misrepresented as a genuine LLM agent.
- No redesign of Jinquan's current interface, no database migration, no production deployment, no automatic creation of calendar events without confirmation.

## Architecture and UX

`web/src/lib/planning.ts` owns deterministic schedule creation and validation, with plain serializable types. The existing demo agent emits a `study-plan` card for planning requests. The existing agent panel renders editable sessions and explicit Confirm / Reject actions. `state.tsx` validates again before saving and persists a collection of confirmed sessions with the other demo UI state. `HomeView.tsx` displays the confirmed sessions in a small section above the existing widgets. This leaves the existing page/shell structure intact.

## Risks and decisions

- The fixed demo clock is intentional for repeatable judging. Show dates clearly; never call these live university facts.
- “Evening” lacks precise times. Block a conservative window, label the assumption, and allow the user to edit the plan; no inferred meeting is saved.
- Browser localStorage is for demo only. Data is device-specific, may be cleared and is not synchronized. A future authenticated backend should be authoritative.
- Invalid or stale persisted data should not crash the UI. Verify all fields and rerun conflict checks when confirming.
- When the planner cannot find a feasible slot before a deadline, report the unscheduled task instead of inventing an impossible appointment.

## Delivery milestones after this increment

1. Agree on precise ownership and shared data contracts with Jinquan and UI/UX before wider UI changes.
2. Put the deterministic scheduler behind a typed tool interface; wire a real, server-only LLM tool-calling loop after model and key ownership are agreed.
3. Add authorized database persistence and test the demo journey on desktop and mobile before preparing presentation material.
