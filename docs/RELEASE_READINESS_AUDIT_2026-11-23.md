# XMUM Compass: Release Readiness Audit

**Audit date:** 23 November 2026
**Baseline branch:** `feat/compass-planning-mvp`, starting at `8002ae7`
**Scope:** React UI, Gemini API, deterministic study planner, persistence, Moodle demo wording, security, copy governance and responsive UX.
**Decision:** **Conditional GO for a controlled local competition demo. NO-GO for public hosting.**

**Follow-up on 23 November 2026:** Automated Chromium E2E coverage was added after the initial audit. This section includes the latest verification results for the same branch.

## Results by area

| Area | Outcome | Evidence and limitations |
| --- | --- | --- |
| Build and unit tests | PASS | Final check after UI changes: 39/39 unit tests, TypeScript, ESLint, production build and copy-style check all passed |
| Chromium browser regression | PASS | 10/10 automated E2E tests passed in headless Chromium 159. The Playwright suite is project-owned and repeatable with `npm run test:e2e` |
| Route availability | PASS | Local production preview HTTP 200 for Home, Timetable, Assignments, Map, Courses, Clubs, Finance and Mail |
| AI Agent functionality | PASS (local API) | Live model/tool interaction tested with fictional data and an unsaved study-plan card; model response does not auto-save |
| AI latency | Improved, not guaranteed | Same assignment prompt took 17.03 seconds with Hydrogen and 4.07 seconds with Flash. After changing the preview to Flash, the weekly study-plan prompt took 3.90 seconds with `propose_study_plan`, three sessions and the assumed meeting block. Each is one observed request, not a performance percentile |
| Study-plan validation | PASS (logic) | Tests cover meeting assumptions, class conflicts, deadlines, past times, adjacent sessions, saved sessions, duplicate IDs and rejection of invalid saves |
| Browser persistence | PASS (Chromium) | Real browser test edits the proposed schedule, blocks a conflict, saves three sessions, reloads, removes one and reloads again. Rejection and storage-write failure are also checked separately |
| Moodle example | PASS (logic and copy) | Explicit fictional wording; completing the demo no longer claims real Moodle access. Cancellable timers prevent a closed walkthrough silently becoming connected |
| API request protection | PASS (local guard) | Cross-origin 403, wrong media type 415, malformed input 400 and oversized content 413. Body byte limit now applies even without Content-Length and with streamed chunks |
| Secret handling | PASS (source inspection) | Gemini credentials remain in the ignored `.env.local` and are sent only to Google's API from the server. Status endpoint exposes model configuration but not the key |
| Mobile 320px and keyboard navigation | PASS (Chromium), UNVERIFIED (Safari) | Headless Chromium tests all eight routes at 320 CSS px, including simulated 200% root text sizing. Focus trapping and returning focus to the launcher after Escape are browser-tested. Safari WebDriver could not create a session because Allow Remote Automation is disabled |
| Light/dark appearance and accessibility | PARTIAL | Dark mode survives reload; modal focus behavior and 200% CSS root font-size reflow pass in Chromium. Actual resolved contrast, native zoom behavior, VoiceOver and physical-device touch targets still require manual validation |
| Public remote deployment | FAIL / BLOCKED | No application authentication, persistent per-user or per-IP rate limiting, usage quotas or abuse monitoring. `GEMINI_ENABLE_REMOTE` must stay disabled |

## Confirmed fixes in this audit

1. **P1, false save success:** Persist accepted study sessions immediately to browser storage before returning success, instead of relying solely on a follow-up effect that swallowed storage errors.
2. **P1, misleading Moodle integration:** Make every connection state and call to action explicitly a fictional walkthrough. Cancel all pending connection timers when the user exits or the component unmounts.
3. **P1, oversized JSON payload:** Enforce a 16 KiB byte limit while reading the request stream, not just via a client-controlled Content-Length header.
4. **P1, slow live AI demo:** Change the default and local preview primary model to Gemini 2.5 Flash based on direct endpoint timing. Keep Hydrogen opt-in, with its original guarded tool support and medium thinking configuration.
5. **P1, 320px horizontal overflow:** The Home widget and Mail Assistant grids used implicit min-content widths. Use explicit minmax-zero tracks and shrinkable grid children.
6. **P1, enhanced text reflow:** At 200% root font size on a 320px viewport, multiple pages expanded beyond the viewport. Adjust narrow layout flex wrapping, navigation constraints, date rows, card titles and intrinsic widths. The eight-route Chromium regression now passes.
7. **P1, keyboard focus:** The modal sheet previously lost focus when the launcher unmounted. Trap focus in modal sheets and return it after the exit animation to the same or a corresponding launcher.
8. **QA infrastructure:** Add Playwright browser regressions for mobile and desktop, covering rendering, scheduling, save/reload/remove, storage failures, rejection, demo cancellation, theme persistence, keyboard access and cross-origin rejection.

## End-to-end user acceptance checklist (manual)

- [ ] On physical Safari, ask for a study plan, edit a proposed start/end time, and confirm a valid proposal.
- [x] Chromium: saved sessions remain on Home after refresh; remove one and verify it stays removed after reload.
- [x] Chromium: editing a session to overlap a class disables Confirm and displays a conflict error.
- [x] Chromium: rejecting a new proposal leaves Home unchanged even after refreshing.
- [x] Chromium: simulate a blocked localStorage write and confirm the UI does not claim success.
- [x] Chromium: cancel the Moodle walkthrough before completion and confirm it does not silently connect; complete a separate walkthrough successfully.
- [x] Chromium: all eight routes reflow at 320 CSS px with a simulated 200% root font size and no document-level horizontal scrolling.
- [x] Chromium: dark theme persists after reload, modal Tab stays inside and Escape restores focus to its launch control.
- [ ] Safari/iPhone: physical-device layout, native text size and VoiceOver announcements. Automated DOM checks do not establish screen-reader behavior.
- [ ] Rehearse the same AI prompt several times. Record median and worst-case response times, errors, tool calls and provider usage. A single four-second run is not an SLA.

## No-go conditions and operational risks

- **Public access requires a separate security milestone:** authentication, authorization boundaries if real student data is added, distributed rate limiting, per-user budget control, monitoring, and a privacy/retention decision. Local origin checks are not substitutes.
- **No actual university integrations:** timetable, assignment, finance and room data are fictional. Display labels must stay explicit.
- **No cloud persistence:** confirmation saves in the current browser only, and storage can be cleared.
- **Safari E2E remains blocked by environment configuration:** Safari WebDriver returned "Allow remote automation" disabled. Headless Chromium was used instead and is now verified. Safari itself remains unverified.

## Verification commands

From `web/`: `npm run check:copy`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. Browser regression requires `npx playwright install chromium` once, then `npm run test:e2e`; the test runner starts a local dev server when one is not already running. From repo root: `git diff --check`. The E2E suite chooses rule-based Demo mode, with isolated browser contexts, and does not send Gemini API prompts. The separate local live Gemini verification used only fictional data and did not perform actions on real accounts.

**Release control:** No push, merge, cloud deployment or public endpoint enablement is authorized in this audit. The local development preview is not a deployment.
