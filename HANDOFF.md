# HANDOFF: XMUM Compass, campus connectors branch

Written 24 Nov 2026 for any AI agent (or human) picking this work up. Read it fully before changing anything. It states what the project is for, what was built and why, how the agent works, how everything is wired, how to run and test it, the rules you must not break, and what is left.

---

## 0. Keeping this file current (mandatory for every agent session)

Several AI agent sessions work on this repo, often at the same time or one after another, and none of them can see the others' conversations. This file is how they find out what changed. It only works if everyone keeps it true.

- **After every change that touches a file** (code, tests, docs, config), add an entry at the top of the change log in section 15 **before you end your turn**. Do not batch entries for later, and do not skip a change because it seems small.
- Each entry says: the date, a short title, which files changed, what and why in plain sentences, what you actually ran and what it showed, and what is unfinished or unverified. Report test results as they were. Do not write "passes" for something you did not run.
- If your change makes another section of this file wrong (a route table, a storage key, a test count, a known issue), fix that section in the same turn. A stale section is worse than a missing one.
- Before you start, read section 15 and run `git status` and `git log -5`. Another session may be editing the same files. Do not overwrite uncommitted work you did not write.
- Edit the file in place. Do not rewrite or reorder other sessions' entries. Newer entries go on top of section 15.
- The copy rules still apply here: no decorative middle dots or bullet glyphs.

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
npm run test:e2e            # Playwright (playwright.config.ts presets compass:onboarding:v1=done for every spec; onboarding.spec.ts opts out); Chromium is installed; needs port 3456 and NO other dev server in this folder
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
| `/` | Today opens with the full-width Master calendar. Choose Today, Week (default) or Month. Customise adds Upcoming, Class changes, Fees, Degree progress, Clubs & events, Find a room and My plans below it. Desktop cards pack into available space and offer size presets while Customise is open. On mobile they stack at full width. |
| `/hub` | Student hub: tiles for Timetable, Assignments, Campus map (2D and 3D), Courses, Clubs, Finance, **Library rooms**, **Help desk**. Sections open under the tiles (`?section=...`) |
| `/mail` | Mail assistant: drafts emails to the right university office. Shows an AskA pointer for hostel faults |
| `/connections` | Connect or disconnect the four mock systems through a mock consent screen. Shows last read time and failures. On a first visit to `/`, a sheet (`components/onboarding/OnboardingSheet.tsx`) offers to connect all four at once, see 15 |
| `/timetable`, `/assignments`, `/map`, `/courses`, `/clubs`, `/finance` | Redirect into the hub |
| `/library`, `/helpdesk` | Redirect into the hub sections |
| Assistant | Slide-over panel (Ctrl or Cmd + K, or the Ask button). This is the agent |

Presenter console (a separate window, no student navigation, never linked from the student app):

| Route | What it is |
| --- | --- |
| `/demo` | Announcements: the 12 scenario events, search and filter, "Triggered so far", suggested run |
| `/demo/library` | Library desk: the same availability Compass reads, laid out like a booking page, plus buttons to fill or close rooms |
| `/demo/aska` | AskA desk: tickets the student submitted; mark in progress, schedule technician, resolve |
| `/demo/eca` | ECA event applications desk: one card per club event, checks done for you, an answer for each room and item, one Send. See 6.4 |
| `/demo/mail` | Webmail screen: inbox list with search and an Unread filter, reading pane, New message window (custom emails are treated as untrusted). Read state lives in `compass:mail-read:v1` (console-owned, cleared by Reset scenario). Helpers in `web/src/lib/mail/` |
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
9. **Library study room booking** (this turn), 10. **Console rebuilt as an e-services portal**, 11. **AskA help desk for hostel faults**, 12. **Agent finds and offers library rooms**, 13. **Club event applications and the ECA staff desk** (section 6.4).

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

### 6.4 Club event applications and the ECA desk (`web/src/lib/events/`, `components/events/`, `components/portal/EcaDeskPage.tsx`)

Why: a club committee that needs rooms and items files separate applications, and each office answers its own lines on its own day, so one event can take weeks and fills ECA staff inboxes. The two booking slips the user supplied show this: one event, one status for each room or item (Approved, Approve With Condition, Rejected), remarks such as a swapped room or a collect place, and offices named PAMO, IT and ECA. Decision record: `UX-ADR-004` in `docs/ux/DECISIONS.md`. **Nothing from those slips is in the repo** (they hold a real name, ID, phone and email). Everything is invented: the applicant is Alex Tan, advisers end in `@demo.invalid`, application numbers are `DEMO-EVT-...`, and the other clubs' applications in `lib/events/seed.ts` are invented.

- **Data**: `types.ts` (an application has `venue`, `item` and `care` lines; each line has its own status; statuses are Pending, Approved, Approve With Condition, Rejected; the event status is derived by `deriveEventStatus` but the desk may set it). `catalogue.ts` (rooms with public codes and approximate seats; items with an owning office, stock, a per-application maximum, and the office's collect and return windows and place). Demo policy, not XMUM policy: 14 days notice (a warning), events inside the semester (to 31 Dec 2026), rooms 08:00 to 22:00, offices closed on Sundays.
- **Checks** (`checks.ts`, plain code, shown to the student before Submit and to staff as "Suggested"): past or out of window dates, end before start, capacity against participants, a room another club holds (approved is a problem, only asked for is a warning), item maximum, stock, collect and return order, Sundays, return window closing before the event ends. The room another club really has is the one staff assigned (`effectiveVenueId`).
- **Student side**: Hub section `Club events` (`?section=events`), a five step sheet (`EventApplicationSheet`: Event, Rooms, Items, Arrangements, Review; mounted in `AppShell`, one sheet at a time). Submit is the only save, re-checked in `submitEventApplication` (`lib/state.tsx`). The page shows each line's status, remark, room swap ("You asked for X. You were given Y."), items approved in part, a progress bar, Withdraw (only while nothing is answered, with Undo), and **Download booking slip (PDF)** (`lib/events/slip.ts`, mirrors the slip sections; header uses a light bar because the shared PDF frame's black on near black text is hard to read).
- **Agent**: scripted intent `event` (checked BEFORE the library `booking` intent; "book a study room for 2" still goes to the library) and `eventstatus`; cards `event` and `event-status` (`components/agent/EventCard.tsx`); Gemini tool `prepare_event_application` takes the student's own words and the same parser decides every room, number and date. Nothing is submitted by the agent.
- **Desk**: `/demo/eca`. Master and detail from 1280px, stacked below with Back to queue. Office filter chips (the real offices answer their own lines; the presenter can answer for any so the demo finishes), segmented Approve, With condition, Reject, remark chips, "Room given" (free rooms only, never one the same application already uses), "Number approved", "Approve N that pass the checks", one Send, Undo. Unanswered lines stay Pending ("Waiting for PAMO"). Partial sends and later revisions merge (`applyDecisionBatch`). Only the saved decisions are written to `compass:eca-decisions:v1`; the invented answers for the other clubs (`SEEDED_DECISIONS`) sit underneath and are never copied in.
- **Tests**: `tests/events.test.ts` (parser, drafts, checks, decisions, sanitisers, slip, storage, Gemini tool), `tests-e2e/events.spec.ts` (agent to form to submit, clash caught, library request unchanged, desk to Compass to slip download to Undo, 320px).
- **Not done / ideas**: the desk keeps unsent answers in page memory only (a refresh drops them). No calendar entries for collect and return days yet (reuse `applyUpdates` add_calendar_event). Real per office desks, email to the adviser, and amending a submitted application are not built. The agent does not read decisions in Gemini mode (it only prepares).

### 6.3 Storage keys and who writes them (one writer per key)

| Key | Written by | Cleared by |
| --- | --- | --- |
| `xmum-compass:v1` (settings, study sessions, reminders, calendar entries, library bookings, AskA tickets, club event applications) | Compass window (`lib/state.tsx`, single `persistedOf` helper so no save path forgets a field) | Compass "Reset demo" |
| `compass:scenario-events:v1`, `compass:custom-mail:v1`, `compass:aska-updates:v1`, `compass:eca-decisions:v1` | Console window | Console "Reset scenario" and Compass "Reset demo" |
| `compass:connections:v1`, `compass:sync:v1`, `compass:acknowledged:v1`, `compass:aska-seen:v1`, `compass:eca-seen:v1`, `compass:onboarding:v1` (`done` or `skipped`, written by the first-run sheet) | Compass window | Compass "Reset demo" |

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
- **Club events (25 Nov 2026):** `tests/events.test.ts` (34 tests) and `tests-e2e/events.spec.ts` (5 tests) pass; the whole unit suite was 188 pass and 1 skipped, with lint, `tsc` and build clean. The e2e ran in Playwright's headless Chromium only. On a full run the dev server stalled and several unrelated specs timed out; they all passed when re-run alone on a quiet server (run e2e with nothing else using the folder). Also viewed by hand at 1440 and 1024 px in the in-app browser, and the PDF slip was rendered and read. Not checked in Safari or Firefox, on a real phone, with a screen reader, or in light theme on the student pages.
- **Unverified:** live Gemini (including `prepare_event_application`, `extract_notice`, `find_library_rooms`, `prepare_aska_ticket` with a real model), Safari and real devices, screen readers, dark mode of the hub content panel (it looks washed out; this predates this branch).

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

0. **Club events follow-ups** (see 6.4): keep unsent desk answers across a refresh; add the collect and return days to the student's calendar through `applyUpdates`; separate desks for PAMO, IT and the venue office; let a student amend a submitted application; tell the adviser. The user also supplied real booking slips (kept outside the repo, they hold personal data) so check any new office or status wording against the real slips before inventing it.

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
9. Club event: in the assistant say "Book 3 classrooms, 30 plastic chairs, 10 banquet tables and 2 megaphones for our Robotics Demo Night on 10 December from 4pm to 10pm, 80 people. The Robotics & AI Society is organising it." Review each step, add an adviser, submit. In the console open Event Applications (the queue holds other clubs' invented applications, one waiting 5 days), open the application, Approve what passes the checks, reject the megaphones with a reason, swap a room, Send one decision. Compass shows the banner, each line's answer and the room swap, and downloads the booking slip. The line for the pitch: one application and one decision message replace a pile of emails, so weeks become days.

The closing line for judges: every record is invented, every action is proposed and approved by the student, and replacing one mock adapter per system is all it takes to go real once XMUM grants access.

---

## 12. Quick map of important files

- Agent: `web/src/lib/agent.ts`, `gemini-agent.ts`, `gemini-tools.ts`, `gemini-client.ts`, `agent-tools/*` (`campus.ts`, `review.ts`, `facts.ts`, `gemini-extract.ts`, `server-context.ts`, `request.ts`, `expected.ts`), `updates/*` (`types`, `validate`, `apply`, `propose`), `conflicts.ts`, `planning.ts`, `planning-demo.ts`.
- World and mock: `lib/world/*`, `app/api/mock/**`, `lib/data/*` (invented data, `inbox.ts` has the expected answers).
- Sync: `lib/sync/*`, `lib/connectors/*`.
- State: `lib/state.tsx`.
- Library and AskA: `lib/library/*`, `lib/aska.ts`, `components/library/*`, `components/helpdesk/*`, `components/agent/{AskaCard,RoomsCard,UpdatesCard,Cards,AgentPanel}.tsx`.
- Portal: `components/portal/*`, `app/demo/**`.
- Club events: `lib/events/` (`types`, `catalogue`, `checks`, `decisions`, `application`, `request`, `seed`, `slip`, `storage`, `summary`), `components/events/` (`EventsView`, `EventApplicationSheet`, `useEventData`, `shared`), `components/agent/EventCard.tsx`, `components/portal/EcaDeskPage.tsx`, `app/demo/eca/page.tsx`. Tests: `tests/events.test.ts`, `tests-e2e/events.spec.ts`.
- Docs: `docs/CAMPUS_CONNECTORS_DEMO.md` (how it works and a stage script), the spec in `docs/superpowers/specs/`, `docs/ux/*` (copy and UX rules), this file.

---

## 13. Replacement classes and the GE planner (added 26 Nov 2026)

Decisions are in `docs/ux/DECISIONS.md` (UX-ADR-005 and UX-ADR-006). Light theme screenshots: `docs/ux/evidence/2026-11-replacement-and-ge/`.

### 13.1 Replacement classes

- **Lecturer desk**: `/demo/lecturer` (console nav "Teaching", "Replacement Classes"). Pick the lost CST1101 class and the reason, see a heatmap of how many of the 36 invented students are free for each start time (counts only, never names), pick a room, then either set the time at once or shortlist two or three times and ask the students. Publish and Ask both confirm in a modal; Undo restores the previous requests.
- **Rules** (`lib/replacement/availability.ts`, demo policy): Tue to Fri of the current week, 08:00 to 20:00, 24 hours' notice, not on a public holiday, the lecturer's leave day or their other teaching, a room with enough seats. `checkOption` re-checks before anything is written.
- **Student side**: `ReplacementPanel` at the top of Timetable (answer Works or Can't per time, prefilled from the timetable; or the set time with Show in timetable, Find room, Add to calendar, and private overlap warnings). `UpdatesBanner` tells the student once. `CampusProvider` overlays the result on `data.classes` and notices (`lib/replacement/overlay.ts`), so the calendar’s next class, Class changes, ICS export, the study planner and the assistant all see it.
- **Storage**: the desk writes `compass:replacements:v1`; Compass writes `compass:replacement-answers:v1` and `compass:replacement-seen:v1`. An answer counts only for the request `stamp` it was given for.

### 13.2 GE planner

- Hub section `electives` ("GE planner"); Courses shows a summary card. `lib/electives/`: `parse.ts` reads the AC's time text (week ranges, dates, am and pm, several parts; anything unclear is unreadable, never free), `plan.ts` (clashes by shared weeks, stream rule, `suggestSets`, `checkShortlist`), `catalogue.ts` (19 invented courses with planted cases: TBA, full, core clashes, a weeks 8 to 14 clash, two Wednesday evening courses that share two dates), `request.ts` (plain words to credits and interests).
- Saving the shortlist goes through `saveElectives` in `lib/state.tsx`, which re-checks it. Nothing is registered; the copy says so.
- **Agent**: scripted intent `ge` (checked before the room and layout intents) and card `ge-plan`; Gemini tool `suggest_general_electives` uses the same engine.

### 13.3 Verification (26 Nov 2026)

- `npm run check:copy`, 215 unit tests (214 pass, 1 skipped live Gemini), lint, `tsc` and `npm run build` pass.
- New e2e specs `tests-e2e/replacement.spec.ts` (4) and `tests-e2e/electives.spec.ts` (6) pass in Playwright's headless Chromium, including 320 px at normal and 200% text size.
- Full e2e suite on the final tree: 55 of 58 pass. The 2 known failures (section 3) remain. The third, `events.spec.ts` "the agent turns plain words into one application", is a race in that test: `getByText("DEMO-EVT-0001")` also matches the "Application DEMO-EVT-0001 saved" toast while the toast is still up. It passes when run alone (5 of 5). Adding `{ exact: true }` to that locator would fix it.
- Writing the e2e found a real bug on the desk (the selected time panel's exit animation kept the old time's buttons clickable); fixed.
- Checked by hand in the in-app browser at 1440 px (light and dark) and 320 px. Not checked on a real phone, in Safari or Firefox, with a screen reader, or with a live Gemini model.

### 13.4 Known limits and ideas

- The stream is fixed to the demo student (Science); the planner's stream switch is a demo view and disables saving.
- Replacements stay inside the current teaching week. Next week would need the student timetable to show more than one week.
- Fixed on 26 Nov: the updates banner no longer covers the GE planner's sticky summary (see 14.4).
- The 200% text reflow failure on `/courses` (section 3) comes from the existing course list tags, not the new GE card.


## 14. Event fit check, deadline and exam heads-up (added 26 Nov 2026)

Decision: `docs/ux/DECISIONS.md` UX-ADR-007. Light theme screenshots: `docs/ux/evidence/2026-11-events-and-alerts/` (17 to 23).

### 14.1 Merge with David's work

`origin/main` (voice dictation, Gemini model selection, hub reflow) is merged locally in commit `c01e26d` (not pushed). Conflicts were in `AgentPanel.tsx` (imports, the run function now passes `model`) and `gemini-client.ts` (sends `model` and the campus context). `CoursesView.tsx` keeps the GE planner summary with David's smaller phone padding.

### 14.2 "Can I go?" event check

- **Ask:** in the assistant, paste the event's text, a link, or attach or paste a poster or screenshot. On Clubs, every "Coming up" event has a "Does it fit?" button.
- **Read:** `lib/eventfit/read.ts` turns it into editable fields (title, date, start, end, place).
  - It opens no links. Only the fictional `events.compass.demo` links in `lib/data/life.ts` are known; any other link gets "Compass does not open links from other sites".
  - Without an end time it assumes 2 hours and labels the field "(assumed)".
- **Check:** `lib/eventfit/check.ts` decides the answer.
  - **Clashes:** classes, exams, study sessions, saved plans and library bookings.
  - **Notes:** something within 30 minutes, an open assignment due within 24 hours after (48 for 10% or more), an exam within 48 hours, and revision or exam weeks.
  - Normal weekly classes are projected onto other teaching weeks. This week's cancellations, room changes and replacements count for this week only.
- **Card:** `components/agent/EventFitCard.tsx` re-checks on every edit. "Add to my plans" goes through `addPersonalEvent` in `lib/state.tsx`, with Undo, and shows on Home. "Calendar file" downloads an .ics.
- **Pictures:**
  - In Demo mode, Compass says plainly it cannot read them and sends nothing.
  - In Gemini mode, `lib/eventfit/picture-client.ts` shrinks the picture to JPEG and posts it to `/api/event-picture`. That route has its own 1.5 MB limit, the same origin guards, and no tools; it uses a JSON response schema. `lib/eventfit/picture.ts` sanitises what comes back.
  - The chip says where the picture goes before sending. Pictures are never stored.
- **Gemini tools:** `check_event_fit` and `get_semester_status`, backed by the same code.

### 14.3 Heads-up for deadlines and exams

- `lib/calendar/semester.ts` holds the one demo calendar for Semester 1:
  - week 1 is Mon 21 Sep 2026, so 23 Nov is week 10, with 14 teaching weeks;
  - revision week is 28 Dec to 3 Jan, and exams run 4 to 17 Jan 2027;
  - an invented exam timetable has the MAT1101 midterm on Thu 3 Dec and finals in January. ENG1101 has no final.
- `lib/calendar/alerts.ts` sets the tiers:
  - open items due within 24 or 72 hours;
  - items worth 10% or more within 14 days;
  - overdue items that still take late work;
  - items ticked here but not submitted on Moodle;
  - exams within 14, 3 or 1 days, or on now;
  - the last two teaching weeks, revision week and exam weeks.
- `components/home/HeadsUp.tsx` renders Upcoming below the calendar when enabled. Dismissing an alert retains its assignment and stores the dismissal tier. Compass stores `id@tier` in `compass:time-alerts-seen:v1`, so it returns at the next tier. Reset demo clears it.
- **Agent:** a new `exams` intent ("when is my exam", "is it revision week"), checked before the room intent. The deadlines answer adds an exam heads-up line.
- Deadline alerts are deliberately not in the floating banner (see ADR-007).

### 14.4 Banner fix

`UpdatesBanner` publishes its height as `--banner-cover` on `<html>` while it is visible. The GE summary sticks at `calc(var(--banner-cover, 0px) + 0.75rem)`, so Save stays clickable. The e2e checks this with `elementFromPoint`, not only `toBeInViewport`.

### 14.5 Verification (26 Nov 2026)

- `npm run check:copy`, 241 unit tests (240 pass, 1 skipped live Gemini), lint, `tsc` and `npm run build` pass. New: `web/tests/timewatch.test.ts` (15).
- New e2e `web/tests-e2e/timewatch.spec.ts` (9) passes in Playwright's headless Chromium. It covers:
  - Home alerts and their tiers;
  - a demo link, editing, Add and Undo;
  - poster text carrying a fake instruction;
  - an outside link that is never requested;
  - a picture in Demo mode, which is never sent;
  - a picture in Gemini mode, against a mocked route;
  - the exams answer;
  - the banner not covering Save;
  - 320 px at 200% text.
- **Full suite, run against a production build:** 65 of 74 passed in a single run. That run took 27 minutes because lint was running at the same time, and 9 tests timed out or raced.
  - Re-run on their own, all 9 pass.
  - `events.spec.ts` "plain words into one application" was the known toast race. It is now fixed with `{ exact: true }`.
  - The old `/courses` 200% failure also passes now.
  - A clean full re-run on an idle machine has not been done since.
- **Bugs found and fixed while testing:**
  - typing a start time on an empty card did not fill in the assumed end;
  - the card's date field and Calendar file button overflowed at 320 px with 200% text.
- **Not checked:** a real phone, Safari or Firefox, a screen reader, or a live Gemini model, either for picture reading or for the new tools.

### 14.6 Known limits

- The demo clock is fixed, so exam tiers other than "14 days" and the revision and exam week states are shown only by unit tests and the fit check on December and January dates.
- The Gemini picture path is tested with a mocked route and a fake fetch, never with a live model.
- At 320 px with 200% text the assistant sheet's own header is cramped. That is existing layout; the new card itself fits.

---

## 15. Change log (newest first, add an entry for every change)

### 28 Nov 2026, Block A5 from its evacuation plans

- New web/src/lib/data/a5-upper.ts (lab floors); A5 ground uses a-block-ground.ts. A5-L1 and L2 are on Level 1, A5-L3 on Level 2 (positions assumed); Level 1 classrooms A5-101 to 106 (assumed). A5-G01 to G12 no longer exist (confirmed rooms 21 to 9).
- No A block floor is generic now: interiors.test.ts replaced the G01 to G12 test, and interior.spec.ts opens A4-G05. The generic aBlock builder in interiors.ts is now only used as a shell and could be removed.
- Type check passed. npm test: 287 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. Checked A5 plan view in the desktop app's browser. 3D view not checked.
- Browser tests: still running when written.

### 28 Nov 2026, Block A4 from its evacuation plans

- a2-ground.ts is now a-block-ground.ts, shared by A2 and A4; a-block-upper.ts also builds A4. A4 ground rooms are numbered A4-G01 to G11 (assumed) so the club event venues A4-G05 to G10 stay on classrooms; Level 1's fourth classroom is A4-105. Level 5 names the Cold water pump room. A4-G12 no longer exists.
- Tests that used A4 as a generic block now use A5. interiors.test.ts covers A4.
- Type check passed. npm test: 286 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. Checked A4 plan view labels on all floors in the desktop app's browser. 3D view not checked.
- Browser tests: still running when written. The earlier A2 run was stopped part way (39 passed, none failed at that point).

### 28 Nov 2026, Block A2 from its evacuation plans

- New web/src/lib/data/a2-ground.ts. a1-first.ts and a1-upper.ts are merged into a-block-upper.ts, which builds Levels 1 to 5 for A1 and A2 (same layout on both signs). A2-G01 to G12 no longer exist (confirmed rooms 36 to 24). Level 3's fourth classroom is A2-305 so the demo timetable rooms stay.
- A2 ground follows how A1 was simplified, plus labelled stairs (A1's ground floor has none).
- Tests that used A2 as a generic block now use A4 (interior-layout.test.ts, interior.spec.ts); interiors.test.ts covers A2.
- Type check passed. npm test: 285 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. Checked A2 plan view ground, 1 and 3 in the desktop app's browser. 3D view not checked.
- Browser tests: still running when written. The earlier run for the A1 upper floors was stopped part way (33 passed, none failed at that point).

### 28 Nov 2026, Block A1 Levels 2 to 5 from the evacuation plan

- New web/src/lib/data/a1-upper.ts. Every A1 floor now comes from the posted plan (interiors.ts also updates A1's summary and sources). No porches on these floors, at the user's request. Classrooms A1-201 to 203 and A1-210 (kept for the demo timetable), A1-301 to 304, A1-401 to 404; Level 5 has meeting rooms, stairs, lifts and a plant area. Room numbers are assumed and Level 5 names were hard to read.
- Type check passed. npm test: 284 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. Checked plan view Levels 2 to 5 in the desktop app's browser. 3D view not checked.
- Browser tests: still running when written.

### 28 Nov 2026, A1 Level 1 porches

- a1-first.ts: added a porch in the middle of each of the four sides (the sign calls them terraces) and resized the side classrooms. New porch space kind in interiors.ts, colors.ts and InteriorScene.tsx; interiors.test.ts checks four porches.
- Type check passed. npm test: 283 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. Browser tests not rerun.

### 28 Nov 2026, A1 Level 1 second staircase

- a1-first.ts: added the staircase beside the lift lobby, at the user's request.
- Type check passed. npm test: 283 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. Browser tests not rerun.

### 28 Nov 2026, A1 Level 1 stairs added, middle left open

- a1-first.ts: at the user's request, added the back right staircase and removed the Central hall block.
- Type check passed. npm test: 283 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. Browser tests not rerun.

### 28 Nov 2026, Block A1 Level 1 from its evacuation plan

- New web/src/lib/data/a1-first.ts traces the square block on Level 1 (auditorium left out at the user's request): four classrooms numbered A1-101 to A1-104 (assumed), eight offices, meeting room, toilets, lift lobby, central hall. Terraces, stairs and small service rooms are left out. A1-105 to A1-112 no longer exist.
- interiors.ts, FloorPlan2D.tsx (labelled floors show all labels) and interiors.test.ts updated.
- Type check passed. npm test: 283 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. Checked the plan view in the desktop app's browser. Browser tests and 3D view not checked.

### 28 Nov 2026, A1 sky well removed

- a1-ground.ts: removed the Sky well at the user's request. interiors.test.ts no longer expects it; interior-layout.test.ts now takes its courtyard from A2.
- Type check passed. npm test: 282 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. Browser tests not rerun.

### 28 Nov 2026, A1 porches removed, classrooms renamed

- a1-ground.ts: at the user's request, removed the entrance porches (and the porch bump in the outline), renamed the Common Rooms and Study Lounges to Classroom, and restored the sign's shapes for the three top right rooms. The small blocks removed earlier stay removed. interiors.test.ts updated.
- Type check passed. npm test: 282 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. Checked the plan view in the desktop app's browser. Browser tests not rerun.

### 28 Nov 2026, simpler A1 ground floor

- a1-ground.ts: at the user's request, rooms now sit on shared columns and rows, the auditorium wing is one Auditorium block, and stairs, small service rooms, lobbies and the wing's rooms are removed. This replaces the detail described in the entry below. interiors.test.ts updated.
- Type check passed. npm test: 282 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. Checked the plan view in the desktop app's browser. Browser tests not rerun. 3D view not checked: that browser had blocked WebGL.

### 28 Nov 2026, Block A1 ground floor from its evacuation plan

- New web/src/lib/data/a1-ground.ts traces the posted fire evacuation plan (team photo, not committed): the square block and the auditorium wing. It replaces A1's generic ground floor, so A1-G01 to A1-G12 no longer exist (interiors.test.ts updated; confirmed rooms 48 to 36). A1 upper floors stay generic.
- Floors can now have their own outline (interiors.ts, InteriorScene.tsx, FloorPlan2D.tsx), rooms can have a short label, and there is a Service room kind (colors.ts, labels.ts).
- Type check passed. npm test: 282 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. interior.spec.ts with installed Chrome: 2 passed (full browser suite not run). Checked the A1 plan view and 3D view at 1400 px; phone width not checked.
- Unverified: unreadable labels are guesses (dressing rooms, equipment room, foyer), the compass orientation, the scale (matched to the OSM block width). The outdoor 3D campus model does not show the auditorium wing.

### 28 Nov 2026, Student hub section bar and no Saturday classes

- Replaces the panel-under-the-row layout in the entry below. StudentHubView.tsx shows the tile grid until a section is chosen, then a sticky bar of all ten sections above the content (globals.css). ElectivesView.tsx offsets its sticky summary by the bar height.
- Removed Saturday classes: the make-up scenario is now Thu 26 Nov 12:00 to 14:00 (events.ts), replacement slots run Tuesday to Friday (availability.ts), the cohort has no Saturday co-curriculum and GE Design Thinking moved to Friday (cohort.ts), and the Timetable shows Monday to Friday. Updated the matching tests, DECISIONS.md and CAMPUS_CONNECTORS_DEMO.md. Saturday club and campus events are unchanged.
- Type check passed. npm test: 281 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed.
- In the desktop app's browser at 1400 px and phone width: the bar stayed at the top while scrolling, switching sections worked, no horizontal page overflow, no console errors. Physical devices are unverified.
- Browser tests with installed Chrome (temporary config, since removed): full run 105 passed, 0 failed.

### 28 Nov 2026, no weekend classes in the GE planner

- Removed the Keep Saturdays free preference (types.ts, plan.ts, icons.tsx, electives.test.ts) because the university has no weekend classes. In catalogue.ts, GEB1402 and GEA1110 moved from Saturdays to Wednesday evenings.
- Type check passed. npm test: 281 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings. Production build passed. On the built app, the GE planner showed no Saturday text and no Saturday preference.
- Not changed: the Saturday make-up class scenario, replacement class slots that include Saturday, and the Saturday co-curriculum pattern still exist.

### 28 Nov 2026, Student hub opens under the chosen tile

- StudentHubView.tsx renders the section panel inside the tile grid, directly under the chosen tile's row, and scrolls that tile to the top. globals.css makes the panel span the grid. The decision is in docs/ux/DECISIONS.md. Local branch `local-changes`, not committed or pushed.
- Type check passed. npm test: 281 passed, 1 skipped, 0 failed. Lint: 0 errors, 2 warnings in layout.tsx and HomeView.tsx. Production build passed.
- In the desktop app's browser, checked three, two and one columns: the panel sat under the chosen row with no horizontal overflow, collapse removed it, and the panel element survived switching sections.
- Browser tests with installed Chrome (temporary config, since removed): full run 104 passed, 1 failed (helpdesk.spec.ts, technician scheduling: the AskA review card did not appear). The GE planner change below was made while that run was in progress. Rerun of helpdesk and electives specs afterwards: 11 passed. The one failure did not reproduce and its cause is unknown. Physical devices are unverified.

### 27 Nov 2026, softer calendar grid lines

- CalendarGrid.tsx halves the opacity of the Week and Month grid borders. Production build passed. The E2E dev server was blocked by the running instance. No visual browser check.

### 27 Nov 2026, 575 px desktop Master calendar

- Updated globals.css to size the desktop card and scale its Week and Month grids. Content can grow naturally. Chrome measured all three views at 575 px at 1366 x 768. At 375 x 667, Week, Month and Today measured 824, 610 and 744 px. Production build passed. The full E2E suite was blocked by the active development server lock.

### 27 Nov 2026, content-sized Master calendar

- Removed the card height cap and internal scroll area in globals.css and MasterCalendar.tsx. Adjusted the Week and Month grid rows in CalendarGrid.tsx and the Today list spacing. Card height follows content.
- Checked the production assets in Chrome at 1366 x 768 and 375 x 667. Week, Month and Today measured 642/643/514 px on desktop and 824/610/744 px on mobile, with no internal vertical scrolling. The E2E suite was blocked by the dev server lock, and Chromium download failed DNS resolution.

### 27 Nov 2026, shorter Master calendar

- MasterCalendar.tsx puts the events and caption in a keyboard-focusable scrolling area below the controls. globals.css caps the calendar card at 78% of viewport height, up to 720 px.
- Production build passed. In installed Chrome with built assets, checked Today, Week and Month at 1366 x 768 and 375 x 667. The card reached 599 px on desktop and 520 px on mobile. Scrolling reached the bottom and the controls held position. The full E2E suite was blocked by the existing dev server lock, and the bundled Chromium download failed. Physical devices were unverified.

### 27 Nov 2026, Today card title highlights

- Wrapped the title text in kit.tsx and scoped the pale-blue highlight to dashboard cards in globals.css.
- Production build succeeded. Headless Chrome loaded the built dashboard assets directly and confirmed all eight highlights fit at 1440, 375 and 320 px. The full E2E suite could not start its dev server because another instance held the project lock. Chromium download also failed DNS resolution.

### 27 Nov 2026, watercolor artwork for My plans

- Added the attached transparent PNG as `web/public/brand/today-art/my-plans.png`. Registered it in `HomeView.tsx` and sized it in `globals.css` for My plans only. The inherited opacity and bottom-right alignment keep it behind the content, and the PNG retains its pale blue palette and proportions.
- Copy check and production build passed. Unit tests passed (269 passed, one skipped). Lint reported zero errors and two existing warnings. In headless Chrome 157, checked the artwork visually and measured it at 1440, 375 and 320 px, including wide and compact desktop cards, populated and empty cards, and the View all and Remove controls.
- Playwright's bundled Chromium download failed DNS resolution. The full end-to-end run used installed Chrome and stopped after five passing tests. Other browsers and physical devices were not checked.

### 27 Nov 2026, Today card packing and sizes

- Decision before implementation: equal-height rows leave gaps, and CSS-only dense placement can separate visual and keyboard order. Use measured card heights to fit cards into the earliest available space and render them in visual order. Keep the preference order for ties, the Customise list and the single-column layout.
- Compact and Standard use one track and adjust content height. Wide spans both tracks and can show more of the existing content. Use preset controls in Customise and on desktop cards while the panel is open. Preserve the calendar's saved visibility and first position when shown.
- Acceptance checks: verify packing, visual and DOM order, keyboard sizing, persistence and migration, content by preset, sidebar widths, single-column mobile and reduced motion in Chromium.
- Files changed: `HomeView.tsx`, `widgets.tsx`, `HeadsUp.tsx`, `PlansWidget.tsx`, `globals.css`, `widget-layout.ts`, `state.tsx`, `widget-layout.test.ts`, `calendar.spec.ts`, `campus.spec.ts`, `timewatch.spec.ts` and this file. The renamed Upcoming card keeps its storage ID and existing alert actions. Older layout entries use Standard when no preset is stored.
- Copy check and production build passed. Unit tests: 269 passed, one skipped. ESLint: zero errors and two existing warnings. Playwright Chromium download failed DNS resolution. All 28 targeted Playwright tests passed on the final build in installed headless Chrome 157 (calendar, timewatch and campus). Desktop and simulated mobile widths were checked with reduced motion. Visual review at normal motion, Safari, Firefox and physical devices remain unverified.

### 27 Nov 2026, Today dashboard consolidation

- HomeView, MasterCalendar, widgets and globals.css place the calendar first at full width, with equal columns below on desktop and one column on mobile. Today includes the next class, room link and daily commitments. Week remains the initial view. Agenda and its ranges are removed.
- HeadsUp.tsx now renders Needs attention. Assignment rows and exam alerts share the existing urgency tiers and date ordering. The list initially shows four items. Completion is local to Compass, and dismissing a tier leaves the assignment available. Semester status is in the footer.
- widget-layout.ts, state.tsx and agent.ts migrate and customise the consolidated cards. Calendar-only remains the fresh default. docs/ux/DECISIONS.md records the interaction decision. Updated widget-layout, calendar, campus and timewatch tests.
- Copy check and production build passed. Unit tests: 267 passed, 1 skipped. Lint: no errors, two existing warnings. The configured Chromium download failed DNS resolution and another dev server held the default lock. Tested the production build locally with installed headless Chrome 157: 94 of 95 browser tests passed on the full run, with one onboarding connection timeout. All ten calendar tests and the onboarding retry passed on the final build with one worker. Desktop and simulated mobile layouts were exercised. Safari, Firefox and physical devices were unverified.


Entry format: **date, title.** Files. What and why. Verified. Not verified or unfinished.

### 27 Nov 2026, merged origin/main (Today dashboard consolidation) with the add and edit work

- Files: conflicts resolved in `web/src/components/home/MasterCalendar.tsx`, `CalendarGrid.tsx`, `web/src/lib/state.tsx`, `docs/ux/DECISIONS.md`. Also `web/tests-e2e/plans.spec.ts` and `web/tests-e2e/calendar.spec.ts`.
- What changed in the merge: the teammate's commit `73c3d1e` replaced the calendar's Agenda view with a Today view (next class card plus the day's list), changed the grid to 28 px rows (34 px on a phone), and merged the old Up next and Today cards into the calendar. I took their `MasterCalendar.tsx` as the base and re-applied the add, edit, to-do and sheet code on top. So **the Agenda view and its 7 days, 30 days and Semester range no longer exist**, and UX-ADR-009's amendment still describes them; treat the Today, Week, Month control as current. `WeekGrid` click-to-add now divides by `rowHeight`, not a fixed 52. `REFERENCE_LAYOUT` is gone (they removed it), so my earlier mention of it is stale.
- I changed one of their assertions: in the Customise test the check that cards sit below the calendar after a resize to 375 px now waits for the cards to be packed again (`expect.poll`), because my taller calendar card (it now holds the to-do list) made the first frame after the resize stale. It passes with that change.
- Verified (after the last code change): `npm run check:copy`, `npx tsc --noEmit`, `npm run lint` (0 errors), `npm test` (282 tests, 281 pass, 1 skipped), `npm run build`. Full Playwright run against a production build, before the poll change: 3 failed, 101 passed. After it, `calendar.spec.ts` Customise test passes; `plans.spec.ts` and the rest of `calendar.spec.ts` pass. Two failures remain and are not from this merge. (1) `calendar.spec.ts` "desktop cards pack in reading order and keep keyboard-selected sizes after reload": the Resize Fees select stays "standard" after pressing Home. `HomeView.tsx`, `widgets.tsx`, `widget-layout.ts` and `globals.css` are byte-identical to origin/main in the merged tree, so I did not cause it; I did not run it on a clean checkout of origin/main. (2) `campus.spec.ts` "an unclear email becomes a question with a draft": that spec does not mock `/api/agent`, and with a Gemini key in `.env.local` the production server reaches the live model, which answered in free text instead of the "Not sure, so asking you" card. Run it with no key, or mock the route.
- Not verified: the full suite after the poll change and after the final merge commit; Safari, Firefox, a real phone.

### 27 Nov 2026, add and edit calendar entries and to-dos, by words or by hand (UX-ADR-010)

- Files: new `web/src/lib/plans/entries.ts` (types, validation, overlap check, to-do sanitising), `web/src/lib/plans/parse.ts` (`parsePlanRequest`, `readingFromArgs`), `web/src/components/plans/EntryEditor.tsx`, `web/src/components/agent/PlanEntryCard.tsx`, `web/src/components/home/TodoPanel.tsx`, `web/src/components/home/useTimeline.ts`, `web/tests/plans.test.ts`, `web/tests-e2e/plans.spec.ts`. Changed `web/src/lib/state.tsx` (new saved `todos`, actions `saveEntry`, `deleteEntry`, `setTodoDone`, caps raised to 100 events, 100 reminders, 200 to-dos, undo toast now says what was undone), `web/src/lib/calendar/timeline.ts` (to-do items, `edit` refs, `done`), `web/src/components/home/MasterCalendar.tsx`, `CalendarGrid.tsx`, `web/src/lib/agent.ts` (new `plan` intent and `plan-entry` card, two new suggestion chips), `web/src/components/agent/Cards.tsx`, `web/src/lib/gemini-agent.ts` and `gemini-tools.ts` (tool `prepare_calendar_entry`), `web/tests-e2e/calendar.spec.ts`, `docs/ux/DECISIONS.md`, this file.
- What it does: a sentence such as "I have a dentist appointment this Friday at 3pm" or "remind me to print my lab report tomorrow" becomes a card with the editor, prefilled, with an overlap warning. Nothing is saved until Add. By hand: an Add button, a click on an empty hour in the week grid, a quick add line and list for to-dos, and a tap on anything the student wrote opens the editor with Delete. Every change has an Undo. Only the student's own events, reminders and to-dos are editable; classes, deadlines, exams, fees, bookings and study sessions still open their own pages. The calendar items the student wrote are buttons (label ends with "Edit"), the rest are links.
- **For other agents:** the editor sheet is rendered through a portal into `document.body`. Mounted inside the card it sat under the page's search bar and bottom nav on a phone, because `.home-widget > *` creates a stacking context. Do the same for any sheet opened from inside a Today card. The buttons "Add to calendar or to-do" (calendar header) and "Add this to-do" (quick add) are named differently on purpose, so tests and screen readers can tell them apart. Gemini mode has not been run with a real key, only the mocked tool path.
- Verified (after the last code change): `npm run check:copy`, `npx tsc --noEmit`, `npm run lint` (0 errors, 2 warnings that are not from this work), `npm test` (280 tests, 279 pass, 1 skipped live Gemini, 16 new), `npm run build`. Full `npx playwright test` in headless Chromium against a production build on port 3458 with a temporary config: 104 passed, 0 failed, 4.7 minutes. Looked at in the built-in browser: the assistant card and the edit sheet at about 1280 px, the add sheet at 375 px.
- Not verified: Safari, Firefox, a real phone keyboard or date picker, a screen reader on the new controls, 200% text size in the sheet, dark mode (none exists), Gemini with a real key. Pressing Add twice quickly in the assistant card is guarded only by the card switching to its saved state.

### 27 Nov 2026, master calendar changed to a week grid with Month and Agenda views

- Files: new `web/src/components/home/CalendarGrid.tsx`. Changed `web/src/components/home/MasterCalendar.tsx`, `web/src/lib/calendar/timeline.ts` (grid helpers), `web/tests/timeline.test.ts`, `web/tests-e2e/calendar.spec.ts` (rewritten), `docs/ux/DECISIONS.md` (amendment under UX-ADR-009), this file.
- Why: the team wanted the master calendar in timetable form, like Google Calendar, with a choice of range, not only a list.
- What it does: a **Week** / **Month** / **Agenda** control. Week (default) is an hour grid (08:00 to 20:00, wider if something falls outside) with Mon to Sun columns, a red Now line, blocks sized by duration, and overlapping blocks in side by side lanes (`layoutDay`, same idea as `electives/WeekPreview.tsx`). Deadlines, fee dates and semester dates have no duration, so they sit in an "all day" strip with the due time written on deadlines. Overdue work also shows as a red notice above the grid. Previous, Next and Today move by a week (or a month). Month is a Monday first grid with up to three entries per day and "+N more", and choosing a day opens its week. Agenda is the earlier day grouped list with 7 days, 30 days and Semester. Every block and strip entry is a link to the page that owns it and has a full text label (kind, title, time, state, saved in this browser). On a phone (under 640 px, `useNarrow`) the week shows 3 days and the month shows dots, because 7 columns of titles do not fit at 320 px.
- Verified (after the last code change): `npm run check:copy`, `npx tsc --noEmit`, `npm run lint` (0 errors, 2 warnings that are not from this work), `npm test` (268 tests, 267 pass, 1 skipped live Gemini, 4 more new grid tests), `npm run build`. `calendar.spec.ts`: 10 of 10 pass in headless Chromium against a production build on port 3458. Looked at in the built-in browser at 1280 px (week and month) and 375 px (week). Full `npx playwright test` (headless Chromium, production build on port 3458 with a temporary config because the user's dev server on 3000 blocked the configured one, run after the last code change): 95 passed, 0 failed, 4.4 minutes.
- Not verified: Safari, Firefox, a real phone, a screen reader on the grid, 200% text size, a month with more than 3 entries on a phone (only the dot count is shown), keyboard use of the Month cells beyond Tab and Enter. The week grid shows only the one demo week of classes, because the demo timetable covers one week.

### 27 Nov 2026, master calendar as the default Today (UX-ADR-009)

- Files: new `web/src/lib/calendar/timeline.ts`, `web/src/lib/widget-layout.ts`, `web/src/components/home/MasterCalendar.tsx`, `web/tests/timeline.test.ts`, `web/tests/widget-layout.test.ts`, `web/tests-e2e/calendar.spec.ts`. Changed `web/src/lib/state.tsx` (widget types, defaults and `mergeWidgets` moved to `widget-layout.ts` and re-exported; new `calendar` entry in `WIDGET_META`; the alias "calendar" moved from My plans to the master calendar), `web/src/components/home/HomeView.tsx`, `web/src/components/home/widgets.tsx`, `web/src/app/globals.css` (one selector: the calendar spans the full row), `web/tests-e2e/support.ts`, `docs/ux/DECISIONS.md`, this file.
- What it does: Today now opens with one card, the master calendar, a day-grouped agenda of everything coming up in time order: classes this week (cancelled, moved and replacement classes say so in words), unsubmitted deadlines (overdue ones in a group on top), exams, unpaid fee dates, campus events, revision, exam and Semester 2 dates, and what this browser holds (study sessions, reminders, library bookings, calendar entries, labelled saved in this browser and read only after hydration). A red Now line sits at the demo time, earlier items today are dimmed, and a range control offers 7 days, 30 days (default) and Semester. Each row links to the page that owns it. The classes are the demo's one week and are not repeated into later weeks, and the card says so. Event applications (the ECA desk) are not on it yet.
- Defaults and migration: `DEFAULT_WIDGETS` is now the calendar visible and the other ten cards hidden. `mergeWidgets` turns a saved layout that equals the old default (never customised) into the new default, so a returning browser also sees the calendar alone. A customised layout keeps every choice and gains the calendar visible on top. A layout that already lists the calendar is respected, including switched off. The reference layout (Today overview plus five curated cards) is kept for exactly the six classic cards switched on and the calendar off (`REFERENCE_LAYOUT`). It is never mixed with the calendar, because it fills the viewport height.
- **For other agents:** specs that need the old cards must switch them on. `tests-e2e/support.ts` `showTodayCards` now writes the old explicit layout (calendar off, six classic cards, Heads-up and My plans on). Saying "calendar" to the assistant now changes the master calendar, not My plans (My plans keeps plans, reminders, bookings, study plan).
- Verified (run after the last code change unless noted): `npm run check:copy`, `npx tsc --noEmit`, `npm run lint` (0 errors, 2 warnings that are not from this work), `npm test` (264 tests, 263 pass, 1 skipped live Gemini, 16 new), `npm run build` pass. Looked at in the built-in browser from a production build (`next start`, port 3458) at about 1280 px and 375 px wide: full width card, Now line, dimmed past items, cancelled class struck through with a Cancelled label, the state label under the row on a phone. E2E (headless Chromium, run against a production build on port 3458 with a temporary config, because the user's dev server on 3000 blocked the configured one): full `npx playwright test` gave 91 passed and 1 failed. The failure was in my new `calendar.spec.ts`, not the app: the state label is rendered once per breakpoint, so a text locator matched two elements. I scoped the locator to the visible one and reran `calendar.spec.ts` and `timewatch.spec.ts`: 17 of 17 pass. The full suite was not rerun after that test-only edit.
- Not verified: dark mode (none exists in this app), Safari, Firefox, a real phone, a screen reader, 200% text size inside the card, the interaction of the card with the Ask Compass layout command in a live Gemini session. The user's dev server on port 3000 served a stale stylesheet while I worked (it had no `data-widget="calendar"` rule even after a touch), so check the layout from a fresh `npm run dev` or `next start`, not from that server.

### 27 Nov 2026, first-run connection sheet (UX-ADR-008), built

- Files: new `web/src/components/onboarding/OnboardingSheet.tsx`, `web/src/lib/onboarding.ts`, `web/tests/onboarding.test.ts`, `web/tests-e2e/onboarding.spec.ts`. Changed `web/src/components/shell/AppShell.tsx` (mounts the sheet), `web/src/lib/sync/CampusProvider.tsx` (new `connectMany`; `resetAll` calls `clearOnboarding`), `web/src/lib/connectors/connections.ts` (new `connectSystems`, one write for several systems), `web/src/components/connections/ConnectionsView.tsx` (exports `SYSTEM_ICON` so the sheet and the page use the same icons), `web/src/components/ui/Sheet.tsx` (see the focus fix below), `web/playwright.config.ts`, `docs/ux/DECISIONS.md`.
- What it does: on `/` only, once storage has loaded and nothing is connected and `compass:onboarding:v1` is unset, a sheet offers the four systems (all ticked). Allow connects the ticked ones with one write and one sync, then shows each system as Reading, Connected or Unavailable (with Try again). Primary button after that: "Plan my week with Compass", which opens the assistant with that prompt and sends it. Skip, Escape, a scrim click and a drag all save `skipped`; Done saves `done`. Reset demo clears the key so the sheet returns. It never shows on `/demo`, `/connections` or other routes. No student ID, password or course field.
- If storage is blocked, Allow shows "Could not save the connections" and stays open. A blocked write of the onboarding key is kept for the page session only.
- Design: heading `t-title`, then one `t-sub` line, then an eyebrow, then four rows, then a quiet read-only note, with one primary button and a plain Skip in a footer that stays in view. All colours are the app's tokens. No dark theme rule was found in `globals.css` or anywhere under `src` (`grep prefers-color-scheme` finds nothing), so dark mode was not checked. The read-only note says that no real XMUM system is contacted; the footer caption that said it again was removed so more rows fit at 320 px.
- **For other agents:** `playwright.config.ts` now presets `compass:onboarding:v1=done` for origin `http://127.0.0.1:3456`. If you change the e2e `baseURL` or port, change that origin too or every spec will meet the sheet. A spec that wants a first visit uses `test.use({ storageState: { cookies: [], origins: [] } })`.
- **Focus fix in the shared `Sheet`:** after Reset demo, pressing Plan my week left keyboard focus on the Reset demo button behind the assistant, because `Sheet` restores focus to the last control pressed when it finishes closing. `restoreFocus` now does nothing if another `[role="dialog"]` is open. Seen in the built-in browser before the fix (focus on Reset demo) and after (focus in the "Message Compass" box), and covered by two e2e tests.
- Verified (run after the last code change): `npm run check:copy`, `npm test` (248 tests, 247 pass, 1 skipped live Gemini, 5 new), `npm run lint` (0 errors; the 2 warnings are in `src/app/layout.tsx` and `src/components/home/HomeView.tsx`, which this work did not change), `tsc --noEmit` and `npm run build` pass. Full `npx playwright test`: **85 passed, 0 failed, 4.7 minutes**, headless Chromium, on an idle machine, started after stopping other dev servers. That includes `onboarding.spec.ts` (11 tests) and the specs that were failing on other branches (`desktop` cross-origin and `mobile` 200% text); they passed in this run, so do not assume those two still fail. Looked at in the built-in browser at about 800 px and at 320 px wide, in the ask and result states.
- Not verified: Safari, Firefox, a real phone, a screen reader, 200% text size inside the sheet, a live Gemini model for the Plan my week step.

### 27 Nov 2026, UX-ADR-008 proposed

- Files: `docs/ux/DECISIONS.md`.
- A first-run sheet over Today that connects the four invented systems, with Skip for now. No student ID, password or course field, because the connectors supply the student and an input would look like real access.
- Verified: `npm run check:copy` passes. Nothing else was run, because no code changed.

### 27 Nov 2026, icons on the demo console Announcements page

- Files: `web/src/components/portal/EventsPage.tsx`.
- Group icons on the filter chips and on a tinted tile on each event card, a system icon on "Shows in", a play icon on Trigger, a green check tile once triggered, and icons on the "Triggered so far" and "Suggested run" titles and the empty state. Icons come from `lucide-react`. Tile colours reuse the existing group tones.
- Verified: `tsc --noEmit`, `npm run check:copy` and `eslint` on the file pass. Looked at in the built-in browser at about 800 px wide, including the triggered state.
- Not verified: `npm test`, `npm run build`, e2e, narrow phone widths, other browsers. At about 800 px the tile makes card titles wrap onto more lines.

### 27 Nov 2026, handoff rule added

- Files: `HANDOFF.md` (sections 0 and 15), `AGENTS.md`.
- Every agent session must add a change log entry here after each change, as section 0 describes. `AGENTS.md` now points to it so a session sees the rule before it edits anything.
