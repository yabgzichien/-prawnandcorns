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

Open Compass at `http://localhost:3000` in one window and `http://localhost:3000/demo` in another. Both share the browser's local storage, so changes in the console reach Compass within a second. Use the same host name in both windows (`localhost`, not `127.0.0.1`): Next's dev server only hydrates pages on the host it was started for, and local storage is per host.

Without `GEMINI_API_KEY` the agent runs in offline demo mode (steps 1 to 6 of the build order). With a key, Compass uses Gemini and falls back to offline mode, with a visible label, if Gemini is down.

## Suggested stage run

1. In Compass, open Connections and press Connect on all four systems.
2. Ask Compass "Help me plan my week" and confirm the plan. This gives the deadline event something to rebuild.
3. In the console, press "Extend the Lab 6 report deadline to Friday".
4. In Compass, tap Review on the banner. The agent shows its steps, then a card: move the Lab 6 session, add a Thursday reminder, mark two updates as reviewed.
5. Press Approve selected, look at Home, then press Undo.

## The console is an e-services portal

`/demo` is laid out like a university e-services portal so it feels like a system you can pretend to be: a dark sidebar (Announcements, Library Rooms, AskA, Campus Email), a top bar, breadcrumbs and white cards. It uses no real logo, crest, name or link, and every page carries a "Demo console, fictional data" marker. It is a separate window with none of the student navigation, and it is not linked from the student app.

- **Announcements:** the scenario events, with search and a filter by who is acting, plus "Triggered so far" and a suggested run.
- **Student Portal:** three pages laid out like a university student portal: Dashboard (outstanding balance, reminder, announcement), Account Status (the ledger with Date, Doc No, Description, Debit, Credit and Balance, a PDF button on each line and a link to a printable document page) and Download File (every invoice, receipt and the statement as PDFs). They read the same fictional ledger as the assistant.
- **Library Rooms:** the library's booking page as the desk sees it (the same availability Compass reads), with buttons that fill or close rooms.
- **AskA:** tickets your student submits appear here. Mark them in progress, schedule a technician or resolve them, and Compass shows the update.
- **Campus Email:** the student's mailbox as a webmail screen: a searchable inbox (All or Unread), a reading pane, and a New message window that writes an email into the inbox as someone else. Mail from scenario events arrives live and unread, opening a message marks it read, and the arrow keys (or J and K) move through the list. On a phone the list and the reading pane take turns. Messages come from the mock mail system; typed ones stay in this browser and are labelled as such.

## The twelve scenarios

| Console button | What Compass should do |
| --- | --- |
| Move Tuesday's CST1103 lecture to A1-210 | Notes the room change from AC. Timetable shows the old room. |
| Extend the Lab 6 report deadline to Friday | Moodle change and Dr. Lim's email agree. Moves a now stale study session, adds a reminder. |
| Cancel Friday's ENG1101 lecture, add a Thursday make-up | Notes both. If a study session sits in the make-up slot, proposes moving it. |
| Post tuition instalment 2, due 30 Nov | Adds a reminder tied to the fee. Finance page and the Fees widget show the instalment. |
| Add a new Moodle assignment due in three days | Notes it. Does not plan study time unasked. |
| Robotics club announces an info session by email | Reads the email, proposes a calendar entry with the room. |
| Send two noise emails | Both marked "No action needed". The planted instruction in the spam is never followed. |
| Send an unclear email: the quiz is moved to next week | Low confidence, so it asks instead of guessing, and offers a draft to the lecturer. Never sent. |
| Take Moodle down for one sync | Banner says Moodle is unavailable and keeps its last data. Retry recovers. Other systems are unaffected. |
| Fill every group discussion room tomorrow afternoon | Group rooms show Reserved from 13:00 to 19:00 tomorrow. A request for a group room offers the closest alternatives. |
| Close silent study room N205 for maintenance | N205 shows an Under maintenance note. If your student booked it, My bookings flags it and offers Find another room. |
| Library evening rush: nearly everything booked tomorrow | Nothing is free from 17:00 tomorrow. "A study room at 5pm" gets the closest free rooms and says it is not an exact match. |

"Write your own email" on the console adds a custom notice. Offline mode cannot read it (it has no stored answer) and says so. With Gemini it is read like any outside email.

## Invoices and receipts

Ask Compass "Find my tuition invoice and download it" (or "the receipt for my September payment", "my unpaid invoice", "my account statement"). Needs the Finance Office connected, since that is where the statement comes from.

- The ledger is fictional and worked out from the demo fees (`src/lib/finance/ledger.ts`). Document numbers start with DEMO so none can pass for a real one. When the console posts tuition instalment 2, a new unpaid invoice appears and the balance owed rises.
- Code reads the request (`src/lib/finance/search.ts`): invoice or receipt, tuition, hostel or registration, instalment 1 or 2, a month, latest, unpaid, or the whole statement. A paid invoice comes with the receipt that paid it. If nothing matches exactly the card says "Closest documents".
- Each Download button makes a PDF on the device (`src/lib/finance/pdf.ts`, a small dependency-free writer). Nothing is emailed or uploaded, and every file says it is a fictional demo document.
- The same documents are on the Finance page (Invoices and receipts, once Finance is connected) and in the Student Portal pages in the console.
- "Draft an email to Finance about my invoice" still goes to the email flow.
- The page layouts follow public structure only (the ledger columns, the Print and Download File links, the AskA form fields). No real data from any saved page was copied.

## Library rooms

Student hub, Library rooms (or `/library`). The 43 rooms, their wings, levels and capacities follow the public library layout (silent study rooms N201 to N214, study rooms S221 to S234, group discussion rooms E231 to E236 and W241 to W246, three student success rooms on Level 3). Who has booked what is invented: a fixed pattern fills about half the slots, and the console can fill or close more.

- Two-hour slots from 09:00 to 21:00. Book up to 3 days ahead, counting today. One slot per person per day. Cancel until 15 minutes after the start. A slot that has already started cannot be booked. These rules are plain code (`src/lib/library/policy.ts`).
- Picking a slot pulls out a panel with the campus map gliding to block A3 and a schematic floor plan with the room, its wing and its level lit up. The floor plan is labelled "not to scale" because the real layout may differ.
- A booking that overlaps a class, study session or calendar entry shows a warning, not an error.
- Bookings are saved in this browser only, with an Undo, and show on Home. Nothing is sent to a real library.
- Ask Compass "Book a study room for 2 tomorrow at 3pm". Code reads the day, time and group size, checks availability and the rules, and offers rooms with a Book button. The assistant never books on its own.

## AskA help desk

Hostel faults such as a water leak or a broken air-conditioner are reported to the AskA help desk, not by email to the Accommodation Office. So Compass routes them there:

- Ask Compass "The air-con in D3-512 is leaking". It prepares a ticket (department and category, block and room, urgency, title, question). The field names follow the real AskA form: Department, Category, Block and Room No, Question. Hostel repairs go to the Operation and Maintenance Office; room changes have their own Room Change Request form on AskA and you review it. The mail assistant shows the same pointer when you describe a hostel fault, and keeps the email draft for room changes.
- Help desk (Student hub, or `/helpdesk`) lists your tickets. The console's AskA page can mark a ticket in progress, schedule a technician, or resolve it. Compass shows the update in its banner, and a scheduled visit can be added to your calendar in one tap.
- Submitting saves the ticket in this browser. The form says clearly that nothing goes to a real help desk. Words like flooding, sparks or no power mark a ticket urgent, with a note to tell the hostel office in person.

## Decisions taken where the spec left a choice

- Sync runs on open, on Sync now, on Retry and on console events, not on a timer (open question 1, suggested answer).
- `extract_notice` makes a separate Gemini call with a strict JSON format (open question 2, suggested answer).
- The moved class goes to room A1-210, not C2-201. The campus map has no block C2, and the spec requires rooms to exist on the map.
- "Extend a deadline" is implemented as a stale-session conflict (a session planned for the old date) rather than a literal clash, which matches the spec's walkthrough text.
- The existing Gemini tool names (`get_demo_assignments` and so on) are kept, and now read the connected data.
- The Gemini loop allows 7 turns and 14 tool calls (was 4 and 8) and `/api/agent` accepts 40 KB bodies (was 16 KB). A full review is about five sequential steps, which did not fit the old limits.
- A study session can only be moved or removed when the conflict check found a problem with it. Text in an email can never talk the agent into clearing the plan.
- The console now looks like an e-services portal. The spec (section 10) had asked for it not to resemble any real university site. It keeps that spirit by using no real logo, crest, name or link and by saying "fictional" on every page, but follows the layout of a real portal because that is what you asked for.
- Library and AskA are features of Compass with their own small mock API and storage, not connectors yet. Making them connectors (so a new booking or ticket status flows through sync and the review banner) is a natural next step.
- Reset: Compass's Reset demo clears bookings, tickets and every console key. The console's Reset scenario clears the events, custom emails and ticket updates it owns, and leaves what the student saved.

## Not built yet

- The interior of the A blocks in 3D. The room table in `src/lib/library/rooms.ts` and the plan in `plan.ts` are written so that work can reuse them.
- Real library, AskA, Moodle or Academic Centre connections (needs university permission, per competition rule 7).

## Checks

```bash
cd web
npm test          # unit tests, including world, mock APIs, sync, conflicts, safety and Gemini tool tests
npm run lint
npm run build
npm run test:e2e  # needs Playwright browsers: npx playwright install
```
