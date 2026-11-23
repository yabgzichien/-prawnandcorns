# Campus connectors: how it works and how to demo it

Design: `docs/superpowers/specs/2026-11-24-campus-connectors-agent-design.md`. Everything here is invented. No real XMUM system, record or email is used, in line with competition rule 7.

## The loop in one minute

1. The `/demo` console triggers a scenario event. The list of triggered event ids is the only state of the invented campus, so the same ids always give the same world.
2. Each mock system (`/api/mock/moodle`, `ac`, `finance`, `mail`) rebuilds that world from a request header and answers in its own format.
3. A connector per system translates the answer into the common Compass format. The student connects each one from the Connections page through a mock consent screen. No password field exists.
4. The sync engine diffs the new snapshot against the last one and shows "N updates from Moodle and AC. Review with Compass?".
5. Review opens the agent. It reads the changes, reads and checks emails, looks for clashes and proposes fixes to the student's own plan. Nothing is saved until the student approves. Undo restores the plan.

## Run it

```bash
cd web
npm run dev
```

Open Compass at `http://localhost:3000` in one window and `http://localhost:3000/demo` in another. Both share the browser's local storage, so changes in the console reach Compass within a second.

Without `GEMINI_API_KEY` the agent runs in offline demo mode (steps 1 to 6 of the build order). With a key, Compass uses Gemini and falls back to offline mode, with a visible label, if Gemini is down.

## Suggested stage run

1. In Compass, open Connections and press Connect on all four systems.
2. Ask Compass "Help me plan my week" and confirm the plan. This gives the deadline event something to rebuild.
3. In the console, press "Extend the Lab 6 report deadline to Friday".
4. In Compass, tap Review on the banner. The agent shows its steps, then a card: move the Lab 6 session, add a Thursday reminder, mark two updates as reviewed.
5. Press Approve selected, look at Home, then press Undo.

## The nine scenarios

| Console button | What Compass should do |
| --- | --- |
| Move Tuesday's CST1103 lecture to A1-210 | Notes the room change from AC. Timetable shows the old room. |
| Extend the Lab 6 report deadline to Friday | Moodle change and Dr. Lim's email agree. Moves a now stale study session, adds a reminder. |
| Cancel Friday's ENG1101 lecture, add a Saturday make-up | Notes both. If a study session sits in the make-up slot, proposes moving it. The timetable gains a Saturday. |
| Post tuition instalment 2, due 30 Nov | Adds a reminder tied to the fee. Finance page and the Fees widget show the instalment. |
| Add a new Moodle assignment due in three days | Notes it. Does not plan study time unasked. |
| Robotics club announces an info session by email | Reads the email, proposes a calendar entry with the room. |
| Send two noise emails | Both marked "No action needed". The planted instruction in the spam is never followed. |
| Send an unclear email: the quiz is moved to next week | Low confidence, so it asks instead of guessing, and offers a draft to the lecturer. Never sent. |
| Take Moodle down for one sync | Banner says Moodle is unavailable and keeps its last data. Retry recovers. Other systems are unaffected. |

"Write your own email" on the console adds a custom notice. Offline mode cannot read it (it has no stored answer) and says so. With Gemini it is read like any outside email.

## Decisions taken where the spec left a choice

- Sync runs on open, on Sync now, on Retry and on console events, not on a timer (open question 1, suggested answer).
- `extract_notice` makes a separate Gemini call with a strict JSON format (open question 2, suggested answer).
- The moved class goes to room A1-210, not C2-201. The campus map has no block C2, and the spec requires rooms to exist on the map.
- "Extend a deadline" is implemented as a stale-session conflict (a session planned for the old date) rather than a literal clash, which matches the spec's walkthrough text.
- The existing Gemini tool names (`get_demo_assignments` and so on) are kept, and now read the connected data.
- The Gemini loop allows 7 turns and 14 tool calls (was 4 and 8) and `/api/agent` accepts 40 KB bodies (was 16 KB). A full review is about five sequential steps, which did not fit the old limits.
- A study session can only be moved or removed when the conflict check found a problem with it. Text in an email can never talk the agent into clearing the plan.

## Checks

```bash
cd web
npm test          # unit tests, including world, mock APIs, sync, conflicts, safety and Gemini tool tests
npm run lint
npm run build
npm run test:e2e  # needs Playwright browsers: npx playwright install
```
