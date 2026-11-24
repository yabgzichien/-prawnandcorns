# HANDOFF: XMUM Compass, campus connectors branch

Written 24 Nov 2026 for any AI agent (or human) picking this work up. Read it fully before changing anything. It states what the project is for, what was built and why, how the agent works, how everything is wired, how to run and test it, the rules you must not break, and what is left.

---

## 1. What this project is

**XMUM Compass** is a student super-app prototype for the **XMUM AI Agent Innovation Competition 2026** (handbook: `XMUM_AI_Agent_Innovation_Competition_2026_Handbook.md`). XMUM is Xiamen University Malaysia. The app gives a student one calm place for timetable, deadlines, fees, campus map, clubs, library room booking, hostel problem reporting, and an **AI agent** that reads what changed across university systems, works out what it means for the student's week, and proposes fixes that the student approves.

Judging weights (handbook): problem relevance 20%, innovation 20%, functionality and technical implementation 25%, practical impact 20%, presentation and demo 15%. The pitch is 10 minutes plus 5 minutes of Q&A. The demo therefore has to be reliable, visual and explainable.

Team (from the root `README.md`): David and Jinquan (technical), fyy and JianXuan (UI/UX), Keevan KK and Khoo Li Ling (pitching and documentation). Yang is the person directing this work.

### The one rule that shapes everything: competition rule 7

Handbook rule 7: projects must not access, collect, disclose or include any Personal, Non-Public or Confidential (PNC) information without prior permission. Moodle, the Academic Centre (AC), the Finance Office and student email are all non-public. Therefore:

- **Every record in the app is invented.** The demo student is "Alex Tan" (`DEMO-0000`). Lecturers are "(demo)" names. Email addresses end in `@demo.invalid`.
- **No real system is contacted.** There is no scraping, no real login, no password field anywhere. Do not add one.
- The pitch line is: *real architecture, fake data. Swap one adapter per system once XMUM approves.*
- Public facts may be used (room numbers, building names, public contact emails). Who booked what, fees, grades and emails are invented.

---

## 2. Repository layout and branches

- Git repo root: `/Users/yang/Project/XMUMAI_Comp/prawnsandcorns`. The web app is in `web/` (Next.js 16.4.6, React 19.3, Tailwind 4, `motion` for animation, `three` / react-three-fiber for the 3D map, Playwright for e2e).
- Branch history, oldest first: `main` (front-end prototype and 3D map) -> `feat/compass-planning-mvp` by David (Gemini tool loop, deterministic study planner, approval card, Playwright e2e) -> **`feat/campus-connectors`** (everything in this handoff).
- **All the work described here is committed on `feat/campus-connectors`, in a git worktree at `.claude/worktrees/campus-connectors/`.** It is **not pushed and not merged** into `main`. Do not push or open a PR unless the user asks.
- The user's main checkout (`/Users/yang/Project/XMUMAI_Comp/prawnsandcorns`, branch `main`) has **uncommitted edits** to `web/src/app/globals.css`, `web/src/components/map/Campus3D.tsx` and `web/src/components/map/MapView.tsx`, plus untracked `docs/`. Do not touch them. This branch also edits `MapView.tsx`, so merging into `main` will probably conflict there.
- A commit by Yang (`30b15ae`, warns when a deadline is ticked in Compass but still open in Moodle) sits in the middle of the branch. It is intact. Do not rewrite history.
- **Privacy warning:** `xmumeservice.htm` sits untracked at the root of the user's main checkout. It is a saved page from the real XMUM e-services portal and contains the user's real name. It is not on the branch. Never copy it into the repo, never commit it, never put the name in code, tests, docs, commit messages or any external service. Room data from it was used only as public layout facts (room numbers, wings, capacities), with descriptions paraphrased.

### Working rules for this repo

- **Read `web/AGENTS.md`**: this Next.js version has breaking changes. Read the relevant guide in `web/node_modules/next/dist/docs/` before writing Next code (route handlers, params are `Promise`s, etc.).
- Run commands from `web/`. Use `.ts` extensions in relative imports inside `src/lib/**` so the Node test runner (`node --experimental-strip-types`) can load them. Files that need the `@/` alias are UI or route code and are not imported by unit tests.
- **Copy rules** (`docs/ux/UX_GUIDELINES.md`, enforced by `npm run check:copy`): no decorative middle dots or bullet glyphs anywhere in owned source, tests or docs. Plain sentences. Keep states distinct: Suggested, Not saved, Saved in this browser, Failed, Unavailable. Never imply university sync.
- Never claim something is "saved" unless storage really succeeded. Never claim real university access.
- Commit after each coherent step, with a clear message. Check `git log` first because other people commit here.
- The Next dev server allows one instance per project folder. The user may already be running `npm run dev -- -p 3457` from the worktree. Check with `lsof -iTCP:3457 -sTCP:LISTEN` before starting another, and never kill a server you did not start.
- Use `http://localhost:3457`, **not** `127.0.0.1`, with a dev server started without `-H`: pages do not hydrate on the other host, and local storage is per host (the console and Compass window share it).

---

## 3. How to run and test

```bash
cd /Users/yang/Project/XMUMAI_Comp/prawnsandcorns/.claude/worktrees/campus-connectors/web
npm ci                      # already done in the worktree
npm run dev -- -p 3457      # Compass at /, presenter console at /demo
npm test                    # copy-style check + node:test unit tests (124 tests, 1 skipped)
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e            # Playwright; Chromium is installed; needs port 3456 and NO other dev server in this folder
```

- Unit tests live in `web/tests/*.test.ts`. Shared helpers: `web/tests/campus-helpers.ts` (routes connector fetches straight into the mock handlers with no network).
- e2e specs live in `web/tests-e2e/` (`campus`, `library`, `helpdesk`, `desktop`, `mobile`). To run them against an already running server, make a temporary config with `baseURL: "http://localhost:3457"` and no `webServer`, and delete it afterwards.
- **Known pre-existing e2e failures (also fail on David's untouched branch):** `desktop.spec.ts` cross-origin test gets 503 instead of 403 when no `GEMINI_API_KEY` is set (the key check comes before the origin check), and `mobile.spec.ts` "reflow at 200% text size" fails on `/courses` (342px vs 320px). Not caused by this branch.
- `tests/extraction-live.test.ts` is skipped unless `GEMINI_API_KEY` is set. It runs the spec's extraction check against real Gemini. **Live Gemini has never been run**: no API key was available. All Gemini behaviour is tested with mocked `fetch`.
- Gemini config is in `web/.env.example` (`GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_ENABLE_REMOTE`). Keys stay server-side, never in git.

---

## 4. The product, page by page

Student app (shell: `web/src/components/shell/AppShell.tsx`, providers in `Providers.tsx`):

| Route | What it is |
| --- | --- |
| `/` | Today: ask bar, widgets (next class, class changes, due soon, today, fees, clubs, find a room), "Your study plan", and "Reminders, bookings and calendar" |
| `/hub` | Student hub: tiles for Timetable, Assignments, Campus map (2D and 3D), Courses, Clubs, Finance, **Library rooms**, **Help desk**. Sections open under the tiles (`?section=...`) |
| `/mail` | Mail assistant: drafts emails to the right university office. Shows an AskA pointer for hostel faults |
| `/connections` | Connect or disconnect the four mock systems through a mock consent screen. Shows last read time and failures |
| `/timetable`, `/assignments`, `/map`, `/courses`, `/clubs`, `/finance` | Redirect into the hub |
| `/library`, `/helpdesk` | Redirect into the hub sections |
| Assistant | Slide-over panel (Ctrl or Cmd + K, or the Ask button). This is the agent |

Presenter console (a separate window, no student navigation, never linked from the student app):

| Route | What it is |
| --- | --- |
| `/demo` | Announcements: the 12 scenario events, search and filter, "Triggered so far", suggested run |
| `/demo/library` | Library desk: the same availability Compass reads, laid out like a booking page, plus buttons to fill or close rooms |
| `/demo/aska` | AskA desk: tickets the student submitted; mark in progress, schedule technician, resolve |
| `/demo/mail` | Write your own email (custom emails are treated as untrusted) |
| `/demo/student-portal`, `/demo/student-portal/account-status`, `/demo/student-portal/files`, `/demo/student-portal/documents/[id]` | Mock student portal: Dashboard, Account Status ledger, Download File, a printable document page. Read the fictional ledger |

The console is styled as a pseudo university e-services portal (dark sidebar, top bar, breadcrumbs, white cards) at the user's request. It uses **no real logo, crest, name or link** and says "Demo console, fictional data" on every page. The original spec said it must not resemble a real site; a revision note in the spec records the change. Keep both properties: layout feel yes, impersonation no.

---

## 5. The agentic side (the heart of the competition entry)

### 5.1 The idea

Compass pretends to be connected to four university systems. It syncs from them, detects what changed, hands the changes to an AI agent, which reasons about what each change means for the student's week and **proposes fixes to the student's own plan**. **Nothing changes until the student approves.** The agent can never edit a university record, only things the student owns: study sessions, reminders, personal calendar entries, email drafts, library bookings (by the student's own tap) and help desk tickets (reviewed by the student). Safety story: agent proposes, code validates, human approves, one Undo.

### 5.2 Data flow (follow this order when debugging)

1. **Demo world** (`web/src/lib/world/`). The world is NOT a database. It is the base invented data plus an ordered list of triggered scenario event ids. `buildWorld(ids)` always gives the same world for the same ids; unknown ids are ignored. Works on server (Vercel keeps no memory) and in the browser. Events live in `world/events.ts` (12 of them), effects applied by `world/world.ts` (`applyEvent` returns a new world, never edits in place). Browser storage of the id list, plus custom emails: `world/storage.ts` (`triggerEvent`, `resetScenario`, `subscribeScenario`; it also dispatches a same-window event because the `storage` event only fires in OTHER tabs).
2. **Mock APIs** (`web/src/app/api/mock/**`). Moodle (`/api/mock/moodle?wsfunction=...`, copies real Moodle web service shapes), AC (`ac/timetable`, `ac/notices`), Finance (`finance/account`, `finance/instalments`), Mail (`mail/messages`, `mail/messages/[id]`), Library (`library/rooms?date=`). Every request carries the triggered event ids in header `x-compass-events`. Shared behaviour in `world/mock-http.ts`: 250 ms artificial delay (env `COMPASS_MOCK_DELAY_MS`), outage handling, response stamped `fictional demo data`, read only. Response builders are pure functions in `world/payloads.ts`.
3. **Connectors** (`web/src/lib/connectors/`). One per system (`connectors.ts`), each fetches its mock API and translates into the **common Compass format** (`types.ts`: Class, Deadline, Fee, Notice, Event items with stable ids like `ac:class:c5`). Normalisers in `normalize.ts`. Fake token and consent state in `connections.ts` (no password ever). Moodle outage: the server cannot remember it failed once, so the **browser reports the outage it has already seen** in header `x-compass-outage-seen`; a system is down only until seen.
4. **Sync engine** (`web/src/lib/sync/`). `engine.ts` `syncAll` runs connectors in parallel; one failure keeps that system's last data and is reported. `diff.ts` `diffSnapshots` is plain code (not AI): Added, Removed, Changed with exact fields; first sync is a quiet baseline; a system connected later gets its own baseline; changes carry `since` and `now` event lists; `mergePending` folds repeated changes to one item. `describe.ts` makes one plain sentence per change naming the source. `store.ts` persists and sanitises. `CampusProvider.tsx` runs sync on open, on Sync now, on Retry and on console events (no timer). `view.ts` converts items into the older page shapes so pages fall back to built-in data when a system is not connected.
5. **Banner.** `components/shell/UpdatesBanner.tsx`: "N updates from Moodle and AC. Review with Compass?" plus failure lines plus AskA ticket updates. Materialises with blur and scale, hides while the assistant is open.
6. **Agent.** Two interchangeable modes, below.
7. **Approval card** (`components/agent/UpdatesCard.tsx`): ticked rows with reason and source, inline Edit, questions with "Ask lecturer" (draft email) and Ignore, Approve selected, Reject all. `applyUpdates` in `lib/state.tsx` saves, `undoLastApply` restores (also un-acknowledges).

### 5.3 Two agent modes

- **Scripted (offline) mode**: `web/src/lib/agent.ts` `runAgent`, a generator of events (plan, step, tool, text, card). Runs in the browser, needs no network or key. UI label: "Offline demo mode (fictional data)". Intents (detected by `detectIntent`, order matters): sync review, library room booking, hostel fault (AskA), study plan, layout, email, room, ge, next, class, deadlines, fees, clubs, schedule, help. The agent panel falls back to this mode automatically, with a visible note, if Gemini errors.
- **Gemini mode**: server route `web/src/app/api/agent/route.ts` calls `lib/gemini-agent.ts` `runGeminiToolLoop` (Google generateContent function calling). Limits: **7 turns, 14 tool calls** (David's were 4 and 8; a full review is about five sequential steps), 30 s primary and 40 s fallback timeout, body limit 40 KB. Only allowlisted tools run (`ALLOWED_TOOLS` from `TOOL_DECLARATIONS`). Client adapter `lib/gemini-client.ts`. Origin checks in `agent-origin.ts`; remote requests are blocked unless `GEMINI_ENABLE_REMOTE=true`.

### 5.4 Agent tools (declared in `gemini-agent.ts`, executed in `gemini-tools.ts` `createDemoExecutor`)

Reading: `get_demo_assignments`, `get_demo_timetable`, `get_demo_finance`, `find_demo_room` (David's names were kept; they now read connected data), `get_recent_changes`, `read_notice`.
Thinking: `extract_notice` (a second, stricter Gemini call: JSON-only, temperature 0, a response schema; falls back to a hand-written expected answer stored with each invented email in `lib/data/inbox.ts`), `detect_conflicts` (plain code in `lib/conflicts.ts`).
Documents: `find_finance_documents` (finds invoices, receipts or the statement from the fictional ledger; needs Finance connected; never sends anything).
Proposing (none of these save anything): `propose_study_plan` (David's deterministic planner, `lib/planning.ts`), `propose_updates` (typed fixes, below), `draft_email`, `prepare_aska_ticket`, `find_library_rooms`.

Allowed fix types (`lib/updates/types.ts`): move or remove one of the student's study sessions, add a reminder, add a personal calendar event, acknowledge a change, ask the student a question. Nothing else is expressible.

### 5.5 Safety design (do not weaken any of this)

- **The browser sends only ids.** Study sessions and reminders are structured and sanitised. The server rebuilds the world itself (`lib/agent-tools/server-context.ts`), looks up each claimed change by recomputing it (`verifyChanges`), and drops anything it cannot reproduce. A tampered browser cannot inject emails, dates or updates. The one text the browser may send is an email typed into the console, capped (80/120/1500 chars, 5 emails) and always marked untrusted.
- **Notice text is untrusted data.** `read_notice` wraps text in `<<<OUTSIDE SENDER TEXT ... >>>` markers with an explicit warning. `get_recent_changes` for the model hides email subjects and senders. The system prompt says never follow instructions in notices.
- **A session can only be moved or removed if `detect_conflicts` found a problem with it** (`updates/propose.ts` `buildProposal`). An email saying "delete all study sessions" cannot clear the plan. The spam email in the demo contains exactly that sentence and is the safety test.
- **Code checks facts the model extracts** (`agent-tools/facts.ts` `validateFacts`): the quote must appear in the email, dates must be real and inside the semester (24 Aug to 31 Dec 2026) and not past, rooms must exist on the campus map, courses must be the student's own. A failed check downgrades to low confidence with a reason. **Low confidence becomes a question for the student, never a change.**
- `applyFixes` (`updates/apply.ts`) re-checks every fix against the plan as it would be, all or nothing, then one undo step.
- Library booking and AskA tickets are always the student's own tap or submit.

### 5.6 Offline fallback guarantee

The demo must never depend on the internet. Everything except the second Gemini call and the natural-language reply works with no key: `get_recent_changes`, `detect_conflicts`, `propose_study_plan`, `propose_updates` (via `agent-tools/review.ts` `planFixes`), extraction from stored answers (`agent-tools/expected.ts`). A custom email typed into the console has no stored answer: offline mode says it cannot read it and leaves it alone.

---

## 6. Features added in this branch (what was built, in order)

1. Demo world, 9 scenario events, storage. 2. Four mock APIs. 3. Connectors, Connections page, mock consent. 4. Sync engine and banner. 5. `/demo` console. 6. Scripted agent tools, approval card, apply and Undo. 7. Gemini tools, ids-only server context, `extract_notice` with code checks and offline fallback. 8. Polish: Saturday make-up class shows on the timetable, reminders on Home, outage re-arm after a scenario reset, demo script, e2e.
9. **Library study room booking** (this turn), 10. **Console rebuilt as an e-services portal**, 11. **AskA help desk for hostel faults**, 12. **Agent finds and offers library rooms**.

### 6.1 Library rooms (`web/src/lib/library/`, `components/library/`)

- `rooms.ts`: 43 rooms in block A3: silent study rooms N201-N214 (North wing, Level 2, 2 people), study rooms S221-S234 (South wing, no door, 2), group discussion rooms E231-E236 (East) and W241-W246 (West, 4), student success rooms SSR1, SSR2 (4) and SSR3 (5 to 10) on Level 3 West. Also registered in `lib/data/campus.ts` `ROOMS` so the map and search find them.
- `policy.ts` (plain code, tested): six 2-hour slots 09:00-21:00; book up to 3 days ahead counting today; **one slot per person per day**; cancel until 15 minutes after the start; a started slot cannot be booked; uses the demo clock `DEMO_NOW` (Mon 23 Nov 2026 13:20 MYT), so today's bookable slots are 15:00, 17:00, 19:00.
- `availability.ts`: deterministic invented "reserved by others" pattern (hash of room, date, slot; busier in the afternoon and for group rooms), plus `LibraryBlock`s added by scenario events. Three library events: group rooms full tomorrow afternoon, N205 under maintenance, evening rush (everything reserved from 17:00 tomorrow).
- `search.ts`: `parseRoomRequest` (reads day, time, group size, room kind from plain words) and `findRooms` / `searchRooms` (smallest room that fits, nearest the time asked, never more than one slot away, widens only when needed and says it is not an exact match).
- `plan.ts`: schematic floor plan geometry, **not to scale**, labelled so in the UI. `client.ts`: the adapter to the mock API.
- UI: `LibraryView.tsx` (day tabs, room-type tabs, slot chips, rules, My bookings with cancel, a warning when a slot overlaps a class or study session), `RoomLocator.tsx` (**the map pull-out**: the existing `CampusCanvas` focused on block A3 plus the floor plan with the room and wing lit up). Deep link: `/hub?section=library&room=N205&date=2026-11-25&slot=0`.
- Bookings live in app state (`lib/state.tsx` `bookLibraryRoom`, `cancelLibraryBooking`), saved in `xmum-compass:v1`, shown on Home, undoable by toast. **Saved in this browser only; nothing is sent to a real library.**
- If the console closes a room the student booked, My bookings flags it and offers "Find another room".

### 6.2 AskA help desk (`lib/aska.ts`, `components/helpdesk/`)

At XMUM, hostel faults (water leaks, air-conditioner problems, and so on) are reported on the AskA help desk, not by emailing the Accommodation Office. So:
- `detectDormIssue` classifies a message (aircon, leak, electrical, furniture, pests; urgent on flooding, sparks, no power, and so on; IT-type words like laptop or wifi are excluded). `parseLocation` reads "D3-512" or "LY2 1203". `draftTicket` builds the category path ("Operation and Maintenance Office > Hostel maintenance > Air-conditioner"), title and description.
- Scripted agent intent "dorm", Gemini tool `prepare_aska_ticket`, Mail assistant callout, and a Help desk hub page. The ticket form (`AskaTicketSheet.tsx`) is a mock of the real form and says nothing is sent. Tickets are saved in app state.
- The console's AskA page writes status updates to one key (`compass:aska-updates:v1`, only the console writes it). Compass reads it, shows progress and a technician visit, offers "Add to my calendar", and surfaces updates in the banner (`components/helpdesk/useAska.ts`; "told once" via `compass:aska-seen:v1`).
- The ticket sheet is lifted to app level (`openAskaTicket` in state, mounted in `AppShell`) so it does not nest inside the assistant sheet (a `transform` ancestor breaks `position: fixed`). Opening it closes the assistant.

### 6.2b Invoices and receipts (`web/src/lib/finance/`, added after the first handoff)

- `ledger.ts`: `buildLedger(world)` makes the fictional account statement (invoices are debits, payments are credits, running balance; ids like `DEMO-IV-200102` and `DEMO-OR-100307`). It follows the demo fees, so the console event "Post tuition instalment 2" adds an unpaid invoice. `sanitizeLedger` cleans anything read from the network.
- `search.ts`: `parseDocumentRequest` and `findDocuments` read plain words (invoice or receipt, tuition, hostel, instalment, month, latest, unpaid, statement). A paid invoice is paired with its receipt. Nearest matches are labelled.
- `pdf.ts`: dependency-free PDF writer (`documentPdf`, `statementPdf`). `download.ts` hands bytes to the browser. `client.ts` and `useLedger.ts` read `/api/mock/finance/ledger`.
- Surfaces: scripted agent intent `invoice` and card `documents` (`components/agent/DocumentsCard.tsx`), Gemini tool `find_finance_documents` (reads the ledger as the student's Finance connection last saw it, `campus.asOf.finance`), Finance page section, and the mock Student Portal pages.
- Real pages saved by the user (`Account Status.html`, `Dashboard.html`, `AskA - XMUM.html`) sit untracked in the repo root and contain the user's real name and real financial records. They were used for page structure only. Never commit or copy them.
- The AskA ticket now names the department and category as the real form does: "Operation and Maintenance Office > Hostel maintenance > ...".

### 6.3 Storage keys and who writes them (one writer per key)

| Key | Written by | Cleared by |
| --- | --- | --- |
| `xmum-compass:v1` (settings, study sessions, reminders, calendar entries, library bookings, AskA tickets) | Compass window (`lib/state.tsx`, single `persistedOf` helper so no save path forgets a field) | Compass "Reset demo" |
| `compass:scenario-events:v1`, `compass:custom-mail:v1`, `compass:aska-updates:v1` | Console window | Console "Reset scenario" and Compass "Reset demo" |
| `compass:connections:v1`, `compass:sync:v1`, `compass:acknowledged:v1`, `compass:aska-seen:v1` | Compass window | Compass "Reset demo" |

The console only reads the Compass keys. Console Reset deliberately leaves what the student saved.

---

## 7. Key decisions and deviations from the spec (`docs/superpowers/specs/2026-11-24-campus-connectors-agent-design.md`)

- Room **A1-210** instead of C2-201 for the moved class: the campus map has no block C2 and the spec requires rooms to exist on the map.
- "Extend a deadline clashes with a study session" is implemented as a **stale study session** conflict (planned for the old date).
- David's tool names (`get_demo_*`) kept. Loop limits raised to 7 turns and 14 calls; request body 16 KB to 40 KB.
- Console got a fifth then sixth group ("Inbox and systems", "Library"); events grew 9 to 12; the console now looks like an e-services portal (spec section 10 has a revision note).
- Library and AskA are Compass features with their own small mock API and storage, **not connectors**. They are deliberately not in `SystemId`, to avoid rippling through `CONNECTORS`, sync loops and the Connections page.
- Sync runs on open, Sync now, Retry and console events (no timer). `extract_notice` is a separate Gemini call.
- Review prompt matching (`lib/sync/review.ts` `isSyncReviewPrompt`) is deliberately narrow so it does not steal "is my class cancelled" or dashboard phrases. There is a test listing phrases that must keep their old routes.

---

## 8. Verification status (be honest about this)

- **Code verified:** 124 unit tests (123 pass, 1 skipped live-Gemini), lint clean, `tsc` clean, `npm run build` passes.
- **Executed:** 27 of 29 Playwright tests pass (the 2 failures are pre-existing, see section 3). Specs cover the whole loop (console to banner to review to approve to Undo), noise and prompt-injection email, ambiguous email question, Moodle outage and Retry, library booking and rules and map pull-out, room closed after booking, agent room search, AskA ticket and technician flow, 320px layouts.
- **Observed by hand** in the built-in browser pane: banner loop across two windows, approve and undo, outage and Retry, Saturday make-up, library sheet with map, AskA card.
- **Unverified:** live Gemini (including `extract_notice`, `find_library_rooms`, `prepare_aska_ticket` with a real model), Safari and real devices, screen readers, dark mode of the hub content panel (it looks washed out; this predates this branch).

---

## 9. Known issues and loose ends

- Hub content panel in dark mode has low contrast (pre-existing styling; new sections inherit it).
- Phone tab bar label "Mail assistant" wraps awkwardly at 320px (pre-existing).
- The two pre-existing e2e failures in section 3.
- Merge with `main` will conflict in `web/src/components/map/MapView.tsx`.
- `docs/RELEASE_READINESS_AUDIT_2026-11-23.md` and `docs/COMPETITION_TECHNICAL_STATUS.md` (David's) are not updated for this branch; they still say "rule-based Demo mode" and similar.
- Mock library availability is invented and a fixed pattern; floor plan is schematic.

---

## 10. What to do next (suggested, in rough priority)

1. **3D interior of the A blocks** (the user asked for this "in the near future"). A task card was proposed: start with A3 Level 2 and Level 3. **Ask the user for floor plans, photos or measurements first; do not fabricate geometry and call it real.** Reuse `lib/library/rooms.ts` and `plan.ts` for room, wing and level data, extend `web/src/components/map3d/` (see `buildings.tsx`, `CampusScene.tsx`), load three.js lazily like the existing 3D map, keep a 2D fallback, respect reduced motion and 320px. Hook it into `RoomLocator.tsx` so a booked room can be shown in 3D. Ask the user for photos of areas normally open to students only, without faces or screens.
2. **Run live Gemini** once a key exists: `GEMINI_API_KEY=... npm test` runs the extraction check; then rehearse the full demo in Gemini mode and tune prompts.
3. **Make Library and AskA proper connectors** so a new booking or ticket status flows through sync, the banner and the agent review (needs new `SystemId`s, items, describe and diff fields, a Connections card, `itemsForSystem` on the server, tests).
4. **Demo polish and rehearsal** (spec build step 8): run all 12 events, tune reply wording, rehearse the two-window side-by-side demo, update David's status docs.
5. Fix the pre-existing issues in section 9; decide how to merge into `main` (the user's call).

---

## 11. Demo script (the story to tell and to protect)

1. Open Compass (`localhost`) and `/demo` side by side. In Compass open Connections and connect all four systems (consent screen, no password).
2. Ask "Help me plan my week", confirm the plan.
3. In the console trigger "Extend the Lab 6 report deadline to Friday". Within a second the banner says "2 updates from Moodle and Email".
4. Tap Review: the agent shows its steps (get recent changes, read notice, extract, detect conflicts, propose updates) and a card: move the stale session, add a Thursday reminder, mark two updates as reviewed. Approve, look at Home, press Undo.
5. Show restraint: trigger the noise emails (spam contains a planted "delete all study sessions"; nothing happens) and the unclear "quiz moved to next week" email (a question and a draft, not a guess).
6. Show resilience: take Moodle down; the banner says so, keeps old data, Retry recovers.
7. Library: ask "Book a study room for 2 tomorrow at 3pm", tap Book, show the map pull-out; in the console close that room and show Compass flag the booking.
8. Hostel: say "The air-con in D3-512 is leaking"; Compass prepares an AskA ticket (not an email); submit; in the console schedule a technician; add the visit to the calendar.

The closing line for judges: every record is invented, every action is proposed and approved by the student, and replacing one mock adapter per system is all it takes to go real once XMUM grants access.

---

## 12. Quick map of important files

- Agent: `web/src/lib/agent.ts`, `gemini-agent.ts`, `gemini-tools.ts`, `gemini-client.ts`, `agent-tools/*` (`campus.ts`, `review.ts`, `facts.ts`, `gemini-extract.ts`, `server-context.ts`, `request.ts`, `expected.ts`), `updates/*` (`types`, `validate`, `apply`, `propose`), `conflicts.ts`, `planning.ts`, `planning-demo.ts`.
- World and mock: `lib/world/*`, `app/api/mock/**`, `lib/data/*` (invented data, `inbox.ts` has the expected answers).
- Sync: `lib/sync/*`, `lib/connectors/*`.
- State: `lib/state.tsx`.
- Library and AskA: `lib/library/*`, `lib/aska.ts`, `components/library/*`, `components/helpdesk/*`, `components/agent/{AskaCard,RoomsCard,UpdatesCard,Cards,AgentPanel}.tsx`.
- Portal: `components/portal/*`, `app/demo/**`.
- Docs: `docs/CAMPUS_CONNECTORS_DEMO.md` (how it works and a stage script), the spec in `docs/superpowers/specs/`, `docs/ux/*` (copy and UX rules), this file.
