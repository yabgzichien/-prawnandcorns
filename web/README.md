# XMUM Compass — fictional-data competition prototype

A student dashboard and AI-assistant prototype for current and incoming XMUM students (XMUM AI Agent Innovation Competition 2026). Next.js 16 (App Router) + Tailwind v4 + Motion. **A server-side Gemini tool-calling integration is available when configured; default fictional demo still works without an API key.**

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
npm test
```

### Gemini API setup (local)

The server uses Google Gemini `generateContent` with declared, read-only/demo-only tools. The API key **never enters the browser**. Create a Gemini Developer API key in [Google AI Studio](https://aistudio.google.com/apikey), then from the `web/` folder:

```bash
cp .env.example .env.local
# Open .env.local locally and paste your key into GEMINI_API_KEY=...
npm run dev -- -p 3456
```

Open `http://localhost:3456`, launch **Compass**, and select **Gemini API**. The app detects whether the server has a configured key. Without a key it visibly uses **Demo** mode; it must not be described as a successful live Gemini call. Restart the server after changing `.env.local`. Default model is `gemini-3.8-flash`; set `GEMINI_MODEL` to a model your account supports.

Only the fictional study-planning data, demo timetable, assignments, finance data and illustrative room lookup can be fetched by the model. Scheduling conflict checks remain deterministic and every proposed study session requires user confirmation. No university account authentication, campus system integration, actual email sending or cloud persistence is implemented. Gemini responses are not streamed token by token in this first integration.

**Important before any public Vercel deployment:** Gemini calls are restricted to localhost by default (`GEMINI_ENABLE_REMOTE=false`). Do not enable remote calls until the team adds proper user authentication, abuse protection and persistent server-side rate limiting. A client-side API-key restriction alone is not sufficient.

## What's in it

| Route | What it does |
|---|---|
| `/` Today | Customisable dashboard (drag to reorder, toggles) with an AI ask bar as the front door |
| `/timetable` | Day + week views; cancelled / room-changed / make-up classes flagged; `.ics` export |
| `/assignments` | Moodle-style deadlines, simulated "Connect Moodle" flow (no credential fields), `.ics` export |
| `/map` | Own SVG campus map built from OpenStreetMap footprints: room search, floors, today's route pins, pan/zoom with momentum |
| `/courses` | This semester, core outlook, General Education requirement groups |
| `/clubs` | ECA clubs + events, join toggles |
| `/finance` | Tuition progress, schedule, history |
| `/mail` | Pick the right office from a plain-language need, draft an email — never sends |
| ⌘K / **Ask** | Agent panel: visible plan → tool calls → answer → action cards |
| Study planner | Deterministic conflict-checked proposal → editable review → confirm or reject → browser-local Home plan |

## Agent demo script

Press **Reset demo** (sidebar / More) between runs — layout, ticked assignments, joined clubs and confirmed study sessions persist in localStorage and change the answers.

1. "What's due this week?"
2. "Is my 2pm class still on?"
3. "Where is A3-G01?" → *Show on map*
4. "Draft an email to Finance about my fee instalment" → draft + approval (nothing is sent)
5. "Add a finance widget and hide clubs" → dashboard changes, **Undo** available
6. "When is my next class?" · "Which GE courses should I take?" · "How much do I owe?"
7. "I like robotics and photography — which clubs fit?"
8. "Help me plan my week. I have a meeting on Wednesday evening." → review the assumed 18:00–21:00 block, edit study sessions, **Confirm & save**, then reload Home

**Demo mode** remains a scripted mock via `runAgent()` in `src/lib/agent.ts`. **Gemini mode**, when the server has a key, calls `src/app/api/agent/route.ts` and `src/lib/gemini-agent.ts` for a bounded tool-calling loop. Both display actions in the existing UI, but only Gemini mode uses a real model. The Gemini route calls `src/lib/gemini-tools.ts`, which allows only whitelisted fictional-data tools.

Study proposals go through pure scheduling logic in `src/lib/planning.ts` and fictional-data mapping in `src/lib/planning-demo.ts`. The demo selects two imminent deadlines plus one high-weight assignment, prefers study windows within two days of each deadline, and lists omitted tasks for review. The app checks classes, deadlines, study hours, existing sessions and manual edits. Confirming writes only to this browser, never to university systems. **Gemini understands the request and chooses tools; it does not calculate authoritative time conflicts or save automatically.**

## Data rules (competition PNC rule)

- **All student, course, lecturer, finance and timetable data is invented** and labelled "Demo data". Nothing was scraped from ac.xmu.edu.my or Moodle.
- Office email addresses are the public ones in the competition handbook.
- Room labels and what each building is used for are placeholders, not an official directory.
- Map footprints: © OpenStreetMap contributors (ODbL), derived from the geometry in the `XMUM_Orientation` repo. Attribution is shown on the map.
- The app's "now" is fixed at Mon 23 Nov 2026, 13:20 (`src/lib/time.ts`) so the demo is deterministic.

## Layout

```
src/lib/agent.ts        agent runtime (mock) + tools
src/lib/email.ts        department routing + draft templates
src/lib/state.tsx       persisted UI state (localStorage)
src/lib/data/*          invented demo data + OSM geometry
src/components/map/     SVG map: pan/zoom/inertia, pins
src/components/agent/   panel + result cards
```

## Design notes

System font, size-specific tracking, translucent chrome with `backdrop-filter`, press feedback on pointer-down, no-bounce springs by default, interruptible drag/flick on the map and sheets (velocity handoff + momentum projection), rubber-banding at map edges, reduced-motion / reduced-transparency / increased-contrast fallbacks.

## Not done yet

Real Moodle/AC integration, auth, a live LLM, push notifications, and verified room/building data.
