# XMUM Compass: Release Readiness Audit

**Audit date:** 23 November 2026
**Baseline branch:** `feat/compass-planning-mvp`, starting at `8002ae7`
**Scope:** React UI, Gemini API, deterministic study planner, persistence, Moodle demo wording, security, copy governance and responsive UX.
**Decision:** **Conditional GO for a controlled local competition demo. NO-GO for public hosting.**

## Results by area

| Area | Outcome | Evidence and limitations |
| --- | --- | --- |
| Build and unit tests | PASS | 39 automated tests pass; TypeScript, lint, production build and copy-style check pass |
| Route availability | PASS | Local production preview HTTP 200 for Home, Timetable, Assignments, Map, Courses, Clubs, Finance and Mail |
| AI Agent functionality | PASS (local API) | Live model/tool interaction tested with fictional data and an unsaved study-plan card; model response does not auto-save |
| AI latency | Improved, not guaranteed | Same assignment prompt took 17.03 seconds with Hydrogen and 4.07 seconds with Flash. After changing the preview to Flash, the weekly study-plan prompt took 3.90 seconds with `propose_study_plan`, three sessions and the assumed meeting block. Each is one observed request, not a performance percentile |
| Study-plan validation | PASS (logic) | Tests cover meeting assumptions, class conflicts, deadlines, past times, adjacent sessions, saved sessions, duplicate IDs and rejection of invalid saves |
| Browser persistence | PASS (logic), UNVERIFIED (browser) | Save now checks the actual localStorage write before reporting success. Unit tests cover blocked/full storage. A fresh Safari/Chrome click, reload and remove sequence is still required |
| Moodle example | PASS (logic and copy) | Explicit fictional wording; completing the demo no longer claims real Moodle access. Cancellable timers prevent a closed walkthrough silently becoming connected |
| API request protection | PASS (local guard) | Cross-origin 403, wrong media type 415, malformed input 400 and oversized content 413. Body byte limit now applies even without Content-Length and with streamed chunks |
| Secret handling | PASS (source inspection) | Gemini credentials remain in the ignored `.env.local` and are sent only to Google's API from the server. Status endpoint exposes model configuration but not the key |
| Mobile 320px and keyboard navigation | UNVERIFIED | No automated browser session was available for visual measurement or interaction checks. Safari WebDriver can start but session creation reports that Allow Remote Automation is disabled in Safari Settings |
| Light/dark appearance and accessibility | PARTIAL | Semantic tokens, native buttons/inputs and focus-visible styles exist; actual contrast, VoiceOver announcements, text zoom and modal focus behavior need browser and assistive-technology checks |
| Public remote deployment | FAIL / BLOCKED | No application authentication, persistent per-user or per-IP rate limiting, usage quotas or abuse monitoring. `GEMINI_ENABLE_REMOTE` must stay disabled |

## Confirmed fixes in this audit

1. **P1, false save success:** Persist accepted study sessions immediately to browser storage before returning success, instead of relying solely on a follow-up effect that swallowed storage errors.
2. **P1, misleading Moodle integration:** Make every connection state and call to action explicitly a fictional walkthrough. Cancel all pending connection timers when the user exits or the component unmounts.
3. **P1, oversized JSON payload:** Enforce a 16 KiB byte limit while reading the request stream, not just via a client-controlled Content-Length header.
4. **P1, slow live AI demo:** Change the default and local preview primary model to Gemini 2.5 Flash based on direct endpoint timing. Keep Hydrogen opt-in, with its original guarded tool support and medium thinking configuration.

## End-to-end user acceptance checklist (manual)

- [ ] On desktop Safari, ask for a study plan, edit a proposed start/end time, and confirm a valid proposal.
- [ ] Refresh the browser: saved sessions remain on Home. Remove one and verify it stays removed after reload.
- [ ] Make an overlap or deadline violation: Confirm becomes unavailable and the error is understandable.
- [ ] Reject a new proposal: the dashboard remains unchanged.
- [ ] Test storage disabled or full: a failed write is not reported as saved.
- [ ] Open the Moodle demo, start the walkthrough, then close before completion. Reopen and verify it still says disconnected until a new run completes.
- [ ] At 320 CSS px and with enlarged text, confirm that times, error messages, and Save/Reject remain reachable without horizontal scrolling.
- [ ] Check both themes, keyboard-only focus, Escape/Back behavior and reduced-motion settings. Test focus return from modal dialogs and VoiceOver announcements.
- [ ] Rehearse the same AI prompt several times. Record median and worst-case response times, errors, tool calls and provider usage. A single four-second run is not an SLA.

## No-go conditions and operational risks

- **Public access requires a separate security milestone:** authentication, authorization boundaries if real student data is added, distributed rate limiting, per-user budget control, monitoring, and a privacy/retention decision. Local origin checks are not substitutes.
- **No actual university integrations:** timetable, assignment, finance and room data are fictional. Display labels must stay explicit.
- **No cloud persistence:** confirmation saves in the current browser only, and storage can be cleared.
- **Browser E2E was blocked by environment configuration:** WebDriver returned "Allow remote automation" disabled; do not mark UI interactions as tested just because source and HTTP tests pass.

## Verification commands

From `web/`: `npm run check:copy`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. From repo root: `git diff --check`. Use a localhost-only preview, then verify page and API HTTP responses. All Google calls in this audit read fictional data and did not perform actions on real accounts.

**Release control:** No push, merge, cloud deployment or public endpoint enablement is authorized in this audit. The local development preview is not a deployment.
