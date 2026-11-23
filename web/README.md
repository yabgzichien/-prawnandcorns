# XMUM Compass — front-end prototype

A student "super-app" for new XMUM students (XMUM AI Agent Innovation Competition 2026). Next.js 16 (App Router) + Tailwind v4 + Motion. **Front-end only, no backend.**

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

## What's in it

| Route | What it does |
|---|---|
| `/` Today | Customisable dashboard (drag to reorder, toggles) with an AI ask bar as the front door |
| `/timetable` | Day + week views; cancelled / room-changed / make-up classes flagged; `.ics` export |
| `/assignments` | Moodle-style deadlines, simulated "Connect Moodle" flow (no credential fields), `.ics` export |
| `/map` | Campus map with a **2D / 3D** switch. 2D is our own SVG map from OpenStreetMap footprints (room search, floors, today's route pins, momentum pan/zoom). 3D is the XMUM Orientation 3D campus (see below) with fly-to, pins, time of day and names |
| `/courses` | This semester, core outlook, General Education requirement groups |
| `/clubs` | ECA clubs + events, join toggles |
| `/finance` | Tuition progress, schedule, history |
| `/mail` | Pick the right office from a plain-language need, draft an email — never sends |
| ⌘K / **Ask** | Agent panel: visible plan → tool calls → answer → action cards |

## Agent demo script

Press **Reset demo** (sidebar / More) between runs — layout, ticked assignments and joined clubs persist in localStorage and change the answers.

1. "What's due this week?"
2. "Is my 2pm class still on?"
3. "Where is A3-G01?" → *Show on map*
4. "Draft an email to Finance about my fee instalment" → draft + approval (nothing is sent)
5. "Add a finance widget and hide clubs" → dashboard changes, **Undo** available
6. "When is my next class?" · "Which GE courses should I take?" · "How much do I owe?"
7. "I like robotics and photography — which clubs fit?"

The agent is a scripted mock: everything goes through `runAgent()` in `src/lib/agent.ts`, which yields an event stream (`plan`, `step`, `tool`, `text`, `card`). Replace that one function with a streaming route that runs a real LLM tool-calling loop; the UI doesn't change. The tools in that file are the tool spec to implement.

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

## 3D map — where it comes from

`src/components/map3d/` is ported from the team's **XMUM Orientation** 3D map (`xmumorientation/XMUM_Orientation`, `src/components/map3d`): ground, A-row, B1, track and courts, lake, statue, gate, lakefront venue, atmosphere and effects. The funfair, tennis game, concert show and Supabase/staff markers were removed. That repo has no LICENSE file, so confirm with its owners before publishing this publicly. Disclose it in the competition submission as reused code.

`src/components/map3d/dorms3d.tsx` is new: Lingyun towers LY1–LY9, the central hall LY3, Block D (D1–D5) and Canteen D6, built on the OpenStreetMap outlines in `dorms.ts`.
- LY towers follow the official XMUM Accommodation Photobook and the team's aerial photo: cross-plan, about 20 storeys, five-storey brick podium, white shafts with slim windows, stepped crown, terracotta hip roofs on open red frames.
- Block D follows the photobook's exterior photo: seven storeys of white bands and red brick bays, black balcony rails, tile eaves, brick stair cores.
- **Not verified against a photo:** Canteen D6 (round footprint with a cone roof is a guess) and its exact look (LY3 is a cafeteria, from the team). Floor counts are estimates from photos.
- The white background towers in the aerial photo are Sunsuria City, off campus, and are not modelled.

Deep links for QA: `/map?view=3d&perf=0&mode=day&cam=LY3:2.4:128` (place : distance scale : turn°). `perf=0` skips the frame-rate probe, which otherwise drops to lite or back to 2D on slow or hidden panes.
