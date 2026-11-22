# XMUM Student Companion: Technical status and demo checklist

**Reference:** XMUM AI Agent Innovation Competition 2026 handbook in this repository. Submission deadline: 16 December 2026 (time not stated in handbook); final event: 20 December 2026.

## What the repository actually contains

| Area | Current implementation | Honest limitation |
| --- | --- | --- |
| Web UX | Next.js 16 frontend with Dashboard, Timetable, Assignments, Map, Courses, Clubs, Finance and Mail | Existing design belongs to the team's UI workstream; do not redesign unilaterally |
| Assistant | Rule-based Demo mode and server-side Gemini model with bounded function/tool calling when an API key is configured | Live Gemini access has **not** been verified without a local key; no real university integrations |
| Scheduling MVP | Pure deterministic study-plan generation, conflict/deadline validation and explicit review/confirm/reject | Uses fictional academic data and a fixed demo clock |
| Persistence | Confirmed study sessions in localStorage, visible after refresh on Home; removal/reset available | Device/browser only, no sync, accounts or backend database |
| University integrations | Mock Moodle/academic data and contacts/campus content for a fictional student | No authorized API integration, no real student records |
| Database/hosting | Neon and Vercel proposed | Not integrated or deployed in this increment |

## Demonstration flow (fictional data only)

1. Open Home; note the demo student, demo date (23 November 2026) and fictitious class/assignment data.
2. Ask: **"Help me plan my week around my deadlines. I have a meeting on Wednesday evening."**
3. Assistant reads the demo tasks/classes, uses application scheduling logic and presents up to three one-hour study sessions. The current deterministic priority rule selects the two earliest deadlines plus one additional higher-weight assignment and tries to spread work over the two days before each deadline.
4. The unspecified Wednesday meeting time is displayed as an *assumption*, blocked 18:00–21:00. It is **not** silently added as a real calendar item.
5. Edit an end time so it overlaps a class, or push it past the assignment deadline. Confirm must be disabled with a clear reason.
6. Correct the time and choose **Confirm & save**. The sessions now appear on Home.
7. Refresh the browser and verify that the confirmed sessions remain. Remove one session; refresh again and check it stays removed.
8. Reset demo and verify saved sessions are cleared.
9. Reject a new proposal; ensure no new sessions were saved.

## Technical boundaries

**LLM:** The planner uses deterministic scheduling rules. When a real Gemini or other model is selected, the model should parse intent and decide which *typed* tools to call, while the application independently validates dates, overlaps, approval and commits. Tool output should identify provenance (demo, publicly sourced or authorized integration) and avoid implying live sync where none exists. Put provider credentials and server-only tool endpoints in a secure deployment environment, not in the browser.

**Data contract:** `StudyTask { id, title, due, status, weight }`; `BusyBlock { label, start, end }`; `StudySession { id, taskId, title, start, end }`; `StudyProposal { sessions, blocked, assumptions, skipped }`. All saved session times use ISO-8601 with `+08:00` and Malaysian wall-clock dates.

**Conflict policy:** Study sessions must be 30 to 180 minutes, start no earlier than the fixed demo clock, remain inside 09:00–21:00 MYT, end before their own assignment deadline and never overlap non-cancelled classes, assumed meeting blocks, another proposed session or a previously saved session. Absent/uncertain meeting times require explicit assumption copy and user review.

**Privacy:** Per the handbook, no personal, non-public or confidential data may be accessed or included without permission. The prototype uses invented records and stores only the user-selected fictional demo study sessions locally. Do not use real Campus ID credentials or claim official XMUM endorsement.

## Remaining technical work, in order

1. **Model choice and ownership:** Gemini API has been chosen. Add a valid Gemini Developer API key securely to `web/.env.local` and run a real API test; confirm who owns billing and rate limits. The server route and tool boundary exist but live provider access is currently unverified.
2. **Database:** Add Neon only when there is a genuine need for multi-device persistent accounts, and agree on authentication/data retention first. Browser-local demo persistence remains appropriate for current judging scope.
3. **Integration permissions:** Obtain explicit authorization before exploring Moodle/AC; otherwise keep demo data and clearly name it.
4. **Frontend integration:** Coordinate confirmed data contracts and small component interfaces with Jinquan and the UI/UX team before modifying main navigation, home hierarchy or design system.
5. **QA and evidence:** Test Chrome and Safari desktop/mobile sizes, invalid inputs, slow operations, reload/reset, screenshots and a live demo rehearsal. Capture test outcomes for the technical and presentation criteria.

## Verification evidence (22 November 2026)

- **14/14** combined planner and Gemini protocol tests passed using `npm test` (including 10 scheduling/persistence tests and 4 mocked Gemini tool-calling tests).
- TypeScript (`npx tsc --noEmit`), ESLint (`npm run lint`) and production build (`npm run build`) passed.
- Production server HTTP smoke test: Home `/`, `/assignments`, and `/map` returned **200**.
- **Still unverified:** the exact end-to-end clickable interaction in Chrome/Safari, localStorage across real browser reload, narrow mobile layout, and accessibility keyboard testing. These need a team manual QA pass; a successful build does not establish them.
- **New Gemini integration:** protocol tests use a mock transport, not real Gemini. There is no local Gemini key in this checkout. Demo mode can be previewed now; a successful live Gemini tool-call request needs a key in `web/.env.local` followed by a server restart. The server refuses remote Gemini POST by default until production protections are added.

## Gemini connector boundaries (22 November 2026)

`web/src/app/api/agent/route.ts` is the sole browser-visible endpoint. The provider key goes in the server's `.env.local`, not client JavaScript. `gemini-agent.ts` implements a bounded model tool-call loop; `gemini-tools.ts` exposes a static allowlist of read-only fictional-data tools and a proposal-only scheduling tool. The browser still performs final confirmation, and no real-world calendar, Moodle or AC operations are available.

The GET status endpoint reports configuration without exposing the key. If no key is configured, POST returns 503 and the UI visibly defaults to the existing scripted Demo assistant. Tests with a mocked provider transport verify tool calls, allowlisting, card rendering contracts and secret-safe upstream error responses. **Live model response, quota and provider compatibility remain unverified**, and the exact UI flow needs real-device review before competition presentation.

## Official evaluation breakdown

Problem identification and relevance **20%**, innovation and creativity **20%**, functionality and technical implementation **25%**, practical application and potential impact **20%**, presentation and demonstration **15%**. The team should optimize first for one verifiable end-to-end agent scenario, then breadth.

## Release limits

Changes here are prepared on an isolated feature branch/worktree. No commits are merged to `main`, no production deployments, no external accounts accessed and no real academic data imported in this increment.
