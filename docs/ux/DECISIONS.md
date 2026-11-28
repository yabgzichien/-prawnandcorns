# XMUM Compass UX decisions

## UX-ADR-001: Natural copy and ongoing checks

**Date:** 23 November 2026
**Status:** Accepted for current feature branch, pending team review

**Problem:** Repeated decorative separators made parts of the prototype look formulaic and some automatically substituted commas were grammatically awkward.

**Options reviewed:**

- Remove separators manually once. Minimal change, but later agents or generated text can reintroduce them.
- Replace them with one punctuation mark everywhere. Fast, but produces unnatural UI labels and email headings.
- Review meaning per location and add a codebase check plus a model-output boundary. More work initially, but easier to maintain.

**Decision:** Use the third option. Preserve intentional punctuation and replace visual dividers with ordinary sentences or labels. Scan first-party code and documentation before release. Normalize untrusted model copy as a final display safeguard.

**Acceptance:** No disallowed glyphs in checked project-owned files, no changed academic identifiers or scheduling behavior, and no malformed date or email labels.

## UX-ADR-002: Adopt the UX Engineering Kit as process, not theme

**Date:** 23 November 2026
**Status:** Accepted for current feature branch, pending team review

**Problem:** The project needs clearer interaction contracts and consistent quality checks, while keeping the frontend work already contributed by teammates.

**Options reviewed:**

- Add a private Git submodule. It keeps a direct revision pin, but creates access and setup issues for contributors.
- Copy a complete external design system. It is convenient initially, but risks overriding the team's visual language.
- Keep compact, project-owned guidelines, an explicit brief, acceptance tests and a decision log. It is accessible to all contributors without new dependencies.

**Decision:** Use project-owned documentation and agent rules. Preserve the existing visual tokens, component library, motion and team ownership. Revisit an actual kit dependency only if the team has access and wants it.

**Acceptance:** A new contributor can understand the planning flow, its limitations, the allowed copy style and the test commands from the repository itself.

## UX-ADR-003: Building interiors in their own 3D viewer

**Date:** 25 November 2026
**Status:** Accepted for current feature branch, pending team review

**Problem:** Students need to find a room inside a building (which floor, which corner, which wing), not only the building itself. The campus 3D map shows the outside of the A blocks, D6 and LY3 but nothing inside.

**Options reviewed:**

- Cut the roof off inside the campus scene and draw the floors there. It keeps one continuous view, but the campus scene works at about 6.7 m per world unit, so a 55 m block is about 8 units wide and room labels become unreadable. The campus scene is also memoized, merged into few draw calls and guarded by a frame-rate probe that steps phones down to lite mode, so adding hundreds of rooms there risks the whole map.
- A separate interior viewer per building, loaded only when asked for: one floor at a time at true metre scale, a floor picker, rooms you can tap, and labels only for the floor on screen. It costs one extra step (a "View inside" button), but it keeps the campus scene untouched and keeps phones fast.
- A flat 2D floor plan per building. Lightest, but it does not show the courtyards, the library's oval atrium or stacked floors, which is what the team asked to model.

**Decision:** Use the separate viewer. The layout lives in a pure data module (`web/src/lib/data/interiors.ts`) so tests can check it and a later in-scene cutaway can reuse it. Sources: the XMUM virtual tour (vt.xmu.edu.my) scene list and descriptions, the official campus map (September 2025), and the team's note that A1, A2, A4 and A5 have ground floor classrooms 01 to 12, three in each corner. Room positions are approximate and labelled as such in the viewer. Panoramas from the tour are used as reference only and are not copied into the app.

**Acceptance:**

- A1, A2, A4 and A5 each show ground floor rooms G01 to G12, three per corner, around the open courtyard.
- The library's 43 bookable rooms appear on the level and wing given in `web/src/lib/library/rooms.ts`.
- D6 shows three levels with 4, 5 and 7 food stalls plus a convenience store; LY3 shows the unmanned mart and a 9-stall cafeteria.
- Every room lies inside its building and no two rooms on a floor overlap (unit tests).
- The viewer opens from the place panel of the campus map, works with mouse, touch and keyboard (floor picker and room list are real buttons), and says the layout is approximate.
- The campus 3D map's frame rate and lite mode are unaffected because the viewer is a separate, lazily loaded canvas.
- Opening the viewer moves keyboard focus to its Back button; Escape closes it and returns focus to the "View inside" button.

**Evidence (25 Nov 2026):** `web/tests/interiors.test.ts` and `web/tests/interior-layout.test.ts` check the layout data. `web/tests-e2e/interior.spec.ts` opens A2-G05 from the map, checks G01 to G12, switches floor and building, checks the Book N205 link goes to the library, shows the plan and closes with Escape; a second test opens D6 straight from a link (no hydration errors) and counts the stalls; it ran in Playwright's headless Chromium with WebGL drawing the 3D view. Checked by hand in the in-app browser at 1366 x 900 (light and dark) and 375 x 812. Not checked on a real phone or in Safari or Firefox.

## UX-ADR-004: One club event application, answered line by line from one staff desk

**Date:** 25 November 2026
**Status:** Accepted for current feature branch, pending team review

**Problem:** A club committee that needs rooms, chairs, speakers and a multimedia card today files separate applications (venues in one, items in another) and each office answers its own lines on its own day. The booking slips the team supplied show the result: one event with a line for each room and item, each with its own status (Approved, Approve With Condition, Rejected), remark and update time, spread over weeks. ECA staff receive one email for each application, so a club with five requests fills their inbox five times. Rooms are sometimes swapped ("you asked for one room and were given the next"), items have a collect window and a return window per office, and some items have a maximum per request.

**Options reviewed:**

- A simple form that sends one email per line. Familiar, but it keeps the inbox problem and the weeks of waiting.
- One approval for the whole event, all or nothing. Quick for staff, but it hides what the slips show: a rejected walkie-talkie line should not hold up approved rooms.
- One application per event with line-level decisions, deterministic pre-checks shown to staff as suggestions, and one decision message back. More data to model, but it matches the slips and removes the repeat emails.

**Decision:** Use the third option. The student describes the event to the agent in plain words (or fills the multi-step form). Code reads the request, prepares a draft and checks it. The student reviews every step and submits once. The ECA desk in the console shows one card per event, the checks as "Suggested", per-line decisions with condition chips, a room swap when a room is taken, and one Send. Lines owned by other offices (PAMO, IT, the venue office) are labelled and can be answered from the same desk by the presenter, or left Pending so the student sees "Waiting for PAMO", as on the real slip. The model never writes a decision and never submits. Pre-checks are plain code (`web/src/lib/events/checks.ts`).

**Rules and data:** The lead time (14 days) and the semester window (to 31 December 2026) are demo policy, not XMUM policy. The room catalogue uses public room codes and capacities. Applicant, adviser, clubs, events and application numbers are invented (`DEMO-EVT-...`). No slip, name, number or email from the supplied documents is copied into the repository.

**Acceptance:**

- One submission creates one application with every venue, item and maintenance line. The student sees a single page with each line's status, remark and any room swap ("you asked for X, you were given Y").
- Nothing is saved before the student presses Submit on the review step. Submit says where the application is saved (this browser) and that nothing is sent to a real office.
- The desk writes only to `compass:eca-decisions:v1`. Compass writes only to `xmum-compass:v1` and `compass:eca-seen:v1`. Reset scenario and Reset demo clear the decisions.
- A line the desk has not answered stays Pending. A decision can be revised and the student sees the latest one.
- Checks cover: past or out of window dates, end before start, participants, venue capacity against participants, a room another club already holds or has asked for, item maximum per request, stock, collect and return on a Sunday, return before the event ends.
- Offline: the whole flow works with no key and no network. The Gemini tool only passes the student's own words to the same parser.
- Works at 320 CSS px and on desktop, with keyboard focus kept inside the form, problems listed in words on the step where they can be fixed (each with a label such as Fix this or Still needed, not only an icon or colour) and statuses that do not rely on colour alone. Field level `aria-describedby` links are not built.

**Evidence (25 Nov 2026):** `web/tests/events.test.ts` covers the request parser, drafts, every check, decisions, sanitisers, the PDF slip, desk storage and the Gemini tool. `web/tests-e2e/events.spec.ts` ran in Playwright's headless Chromium: agent to form to submit, a taken room caught before submit, a library request unchanged, the desk answering one application and Compass showing the banner, the room swap and a slip download, Undo on the desk, and 320 px with no sideways scroll on every step. Checked by hand in the in-app browser at 1440 x 900 (desk, two columns) and 1024 x 768 (desk stacked, form), dark theme for the student side. The booking slip was rendered to an image and read. Not checked on a real phone, in Safari or Firefox, with a screen reader, or in light theme for the student pages.

## UX-ADR-005: Replacement classes planned from the students' timetables

**Date:** 25 November 2026
**Status:** Accepted for current work, pending team review

**Problem:** When a class is lost to a public holiday or the lecturer's leave, the lecturer has to find a replacement time. A course often mixes students from several programmes with different timetables, so today the lecturer asks each student or posts a poll in a group chat and waits. Students then hear about the new time in a chat message that never reaches their timetable.

**Options reviewed:**

- A poll only (lecturer offers times, students vote). Familiar, but the lecturer still guesses which times to offer, and silent students look like a yes.
- Computed availability only (the timetables say who is free). Instant, but timetables miss part-time work, travel and other commitments.
- Computed availability first, then an optional poll on a shortlist of at most three times, then one published decision. Slightly more to build, but the lecturer offers only times that already suit most students, and the poll covers what a timetable cannot know.

**Decision:** Use the third option, as a lecturer desk in the presenter console (`/demo/lecturer`), next to the other staff desks. The desk shows a week heatmap where every cell is a button that names its time and how many students are free, in words as well as colour. Selecting a time explains who cannot come by course ("4 students have CST1103 Lab"), checks the lecturer's own classes and leave day, the notice period and a free room with enough seats, and lists the best three times. The lecturer can set the time at once or ask students first. Publishing needs a confirmation and is checked again by code.

**Privacy:** The lecturer sees counts and the course that causes each clash, never a named list, and never a student's personal study sessions, bookings or calendar. A student's poll answer shares only "works" or "does not work" for each time. Compass tells the student about a clash with their own study session or library booking privately.

**Rules and data:** Demo policy, not XMUM policy: at least 24 hours' notice, Tuesday to Friday of the current teaching week, 08:00 to 20:00, no weekends. The week limit keeps every replacement inside the week the student timetable shows. The cohort of 36 students, their programmes and sections, the lecturer's other teaching and room occupancy are invented and generated deterministically. Alex Tan's own timetable is the demo timetable, including scenario changes.

**Acceptance:**

- The desk writes only `compass:replacements:v1`. Compass writes only `compass:replacement-answers:v1` and `compass:replacement-seen:v1`. Reset scenario clears the desk's key and Reset demo clears all three.
- A published replacement cancels the original session and adds the new one in the student's timetable (day and week views), Up next, Class changes, the calendar export, the study planner's busy times and the assistant's class answers.
- The student sees a banner when a lecturer asks or publishes, answers a poll in Compass, and is warned about an overlap with their own study session or library booking.
- A time that breaks a rule cannot be published, whatever the desk shows.
- Works at 320 CSS px and on desktop, keyboard reachable, with no status shown by colour alone.

**Evidence (26 Nov 2026):** `web/tests/replacement.test.ts` (12 tests) covers the invented cohort, every rule (notice, week, hours, holidays, the lecturer's own teaching), free counts, rooms, suggestions, the re-check before publishing, the timetable overlay, polls that ignore answers to an earlier request, and storage. `web/tests-e2e/replacement.spec.ts` ran in Playwright's headless Chromium: publish from the desk, the Compass banner, the timetable card, the calendar file, Undo; asking about two times, the student's answer reaching the desk, and setting the time from it; a new request ignoring the old answer; and 320 px, also at 200% text size, for the desk and the student card. Writing these tests found a real bug: the selected time panel kept the previous time's buttons on screen during its exit animation, so a fast click could shortlist the wrong time. The panel now has no exit phase. Light theme screenshots at 1440 px and 390 px are in `docs/ux/evidence/2026-11-replacement-and-ge/` (01 to 08, 14, 15). Checked by hand in the in-app browser at 1440 px (light and dark) and 320 px. Not checked on a real phone, in Safari or Firefox, or with a screen reader.

## UX-ADR-006: A general elective planner that reads the AC's time text

**Date:** 25 November 2026
**Status:** Accepted for current work, pending team review

**Problem:** The Academic Centre lists each general elective's schedule as text ("Tue 2:00 PM to 4:00 PM, Weeks 1 to 7"). Nothing checks that text against the student's core classes or against other electives, so clashes are found after registration. Students also have to work out which electives they may take (a science student may take only business and arts electives, a business student only arts and science, an arts student only science and business) and how many credits they need that semester, which varies.

**Options reviewed:**

- Annotate the existing list with clash warnings. Small change, but the student still assembles a set by trial and error.
- A suggestion engine only. Fast, but a student who wants a specific course loses control.
- A planner with both: the catalogue with every course's parsed times and an explanation of why it fits or not, a week preview, and suggested sets that meet the credit target, which the student can apply and then edit.

**Decision:** Use the third option in a new hub section (`/hub?section=electives`). Code parses the time text into weekly meetings with week ranges and specific dates, so two courses at the same time in different weeks do not clash. Text the parser cannot read is shown as "Time not readable" with "Compass could not read this time. Check it on the AC." and is never treated as free. Courses outside the student's allowed streams stay visible but disabled, with the rule in words. The suggester enumerates sets that meet the credit target, avoid clashes and full sections, and ranks them by the student's interests and time preferences, with reasons. Saving a shortlist is a deliberate action, saved in this browser only, and says that the student must still register in the AC system. This replaces the earlier four-group GE model (Language and Culture, and so on), which did not match the stream rule.

**Rules and data:** The catalogue, the Semester 2 core timetable (built from the existing programme outlook), seats and dates are invented. Week 1 of Semester 2 starts on Monday 1 March 2027 (demo date). The stream rule is the one the team described. The default credit target and the 20 credit semester limit are demo values the student can change.

**Acceptance:**

- Every course shows the original AC text next to the parsed times.
- A clash names both sides ("Clashes with CST1204 Lecture, Tue 14:00").
- Suggested sets meet the target exactly when that is possible and say so when it is not.
- The saved shortlist is checked again by code: a clash, a full course, an unreadable time or a course outside the student's streams blocks saving.
- The assistant answers elective questions from the same engine and links to the planner. Nothing is registered anywhere.
- Works at 320 CSS px and on desktop, keyboard reachable, with no status shown by colour alone.

**Evidence (26 Nov 2026):** `web/tests/electives.test.ts` (14 tests) covers number words for credits, the Gemini tool, the AC text shapes (am and pm, "&", week ranges, dates, TBA, a room on its own, two times in one part), unreadable text never counted as free, week-aware clashes, the stream rule, suggested sets for 1 to 8 credits, re-checks before saving, the saved shortlist, and plain-word questions with a list of phrases that must keep their old routes. `web/tests-e2e/electives.spec.ts` ran in Playwright's headless Chromium: use a suggested set, save, reload, see it on Courses; a weeks 8 to 14 clash blocking Save; a core clash that cannot be added; the stream rule and the demo stream switch; credits and interests from a link; the assistant's answer and link; 320 px at normal and 200% text size. The summary bar is sticky from 640 px up and scrolls with the page on phones, where it would otherwise cover the cards. Light theme screenshots are in `docs/ux/evidence/2026-11-replacement-and-ge/` (09 to 13, 16). Not checked on a real phone, in Safari or Firefox, with a screen reader. Gemini mode has a `suggest_general_electives` tool backed by the same engine; it is tested with the demo executor only, not with a live model.

## UX-ADR-007: "Can I go?" checks for events, and heads-up for deadlines and exams

**Date:** 26 November 2026
**Status:** Accepted for current work, pending team review

**Problem:** A student sees an event as a link or a poster and has to work out by hand whether it clashes with a class, a study session or a room booking, and whether a big deadline or an exam is the next morning. Deadlines and exams are scattered across course pages, and nothing tells the student that revision or exam weeks are coming.

**Options reviewed:**

- Let the assistant read the event and answer "yes, you are free". Quick, but the model would decide the answer and a poster could carry instructions.
- Open every pasted link on the server and read the page. It would read real sites (SSRF risk, untrusted text, privacy), which this prototype must not do.
- Read the event into a few fields (title, date, start, end, place) that the student sees and can edit, then let plain code decide. Links are matched only against the fictional demo events list. Pictures are read by Gemini only when the student chose Gemini mode, and in Demo mode Compass says plainly that it cannot read pictures and asks for the date and time.

For alerts:

- Put deadline alerts in the floating updates banner. It is loud, and it already covers page content, so a constant deadline line would cover it all day.
- A heads-up card on Home with the semester status, deadlines and exams, and assistant answers from the same rules. Quiet, always there, and each line can be dismissed for its current tier.

**Decision:** Use the third event option and the Home heads-up card.

- One shared demo calendar for Semester 1 (`web/src/lib/calendar/semester.ts`): week 1 starts Monday 21 September 2026, so 23 November is week 10. There are 14 teaching weeks, revision week is 28 December to 3 January, and the exam weeks are 4 to 15 January 2027. Semester 2 starts on 1 March 2027, as the GE planner already says.
- An invented exam timetable that follows each course's assessment: the Calculus I midterm on Thursday 3 December and finals in January. Academic English has no final.
- The event check (`web/src/lib/eventfit/`) projects the normal weekly classes onto any teaching week. This week's cancellations, room changes and replacement classes count only for this week. Revision and exam weeks have no classes but do have exams.
- The check reports:
  - **clashes:** classes, exams, saved study sessions, saved plans and library bookings;
  - **warnings:** something right before or after, an open assignment due within 24 hours after the event, a major one within 48 hours, an exam within 48 hours, and revision or exam weeks.
- Without an end time it assumes 2 hours and says so.
- "Add to my plans" saves the event only when pressed, with Undo.
- Alerts are rules:
  - any open item due within 24 or 72 hours;
  - a major item (10% or more) within 14 days;
  - an overdue item that still takes late work;
  - an item marked done here but still not submitted on Moodle;
  - an exam within 14 days, 3 days or 1 day;
  - the last teaching week, revision week and exam weeks.
- Dismissing hides a line until its next tier.

**Safety:** Text on a poster or page is data. A pasted instruction changes nothing, because the model only fills the fields and the check is code. Screenshots are shrunk in the browser, sent only in Gemini mode through a separate bounded route with no tools, and never stored. Compass says so before anything is sent. Nothing here is real, and Compass never claims real Moodle or exam-office access.

**Acceptance:**

- The organiser example still opens the event application, while "can I go to this", a link or a picture opens the fit check.
- A clash names both sides and the time. Editing the date or time re-checks at once.
- Unknown links are not opened, and the student is asked for the text or a screenshot.
- Demo mode never pretends to read a picture.
- Home shows the semester week and the alerts in order of urgency. Dismissed lines come back at the next tier.
- Works at 320 CSS px and on desktop, keyboard reachable, with no status shown by colour alone.

**Evidence (26 Nov 2026):**

- `web/tests/timewatch.test.ts` (15 tests) covers:
  - the calendar and phases;
  - the exam timetable;
  - alert tiers, including "ticked here but not submitted";
  - projecting classes onto other weeks;
  - clashes, near warnings, deadlines, exams and revision week;
  - pasted text, demo and outside links;
  - sanitising model fields, including an injected "it fits" line;
  - routing that keeps the organiser example apart;
  - the Gemini tools;
  - the picture reader with a fake fetch.
- `web/tests-e2e/timewatch.spec.ts` (9) ran in Playwright's headless Chromium. It also checks that the banner never covers the GE planner's Save button, using `elementFromPoint`.
- Light theme screenshots are in `docs/ux/evidence/2026-11-events-and-alerts/` (17 to 23).
- Not checked on a real phone, in Safari or Firefox, with a screen reader, or with a live Gemini model.

## UX-ADR-008: First-run connection step as a sheet over Today

**Date:** 27 November 2026
**Status:** Implemented 27 November 2026 on the working branch, pending team review. Checked in headless Chromium and the built-in browser only.

**Problem:** The demo script starts with "connect all four systems", but today that happens on the Connections page, which a first-time viewer may never open. Without connected systems, Compass shows only its built-in sample data, so the headline feature (noticing changes in the campus systems) cannot be seen. The first minute of a run also does not state that every system is invented and read only.

**What the step must not do:**

- Ask for a student ID, password, course list or any typed credential. The invented connectors supply the student and the courses. Fake credential fields would look like real access, which `AGENTS.md` forbids.
- Claim access to Moodle, the academic system, payments or email.
- Block the app. A student who skips must still reach every screen.

**Options reviewed:**

- A full-screen route such as `/welcome`, with a redirect on first visit. Clear and spacious, but it breaks deep links and the presenter's shortcuts, and needs redirect handling in tests.
- A sheet over Today on first run, reusing the existing `Sheet` and `connect` logic. Keeps URLs working, small change, matches the existing consent pattern.
- A banner on Today that links to Connections. Least intrusive, but easy to miss, which is the problem we already have.

**Decision:** Use the sheet. It opens only on Today (`/`), when the app has hydrated, no system is connected and the student has not already finished or skipped it. Other routes never show it, so deep links keep working. It is mounted in `AppShell` after the `/demo` early return, so the presenter console never shows it.

**Content, in one sheet with two states:**

1. Ask: a heading ("Connect your campus systems"), the line "Signed in as {STUDENT.name} (demo student)", then one row per system with its icon, name and a one-line summary of what it reads. All four are selected by default and each can be switched off. A paragraph states that the systems are invented, read only, stored in this browser and can be disconnected. Buttons: **Allow and connect** and **Skip for now**.
2. Result: for each selected system, "Connected" or the reason it failed, with a **Try again** for failures. Primary action **Plan my week with Compass**, which opens the assistant and sends that request, secondary **Done**.

**State:**

- One localStorage key, for example `compass.onboarding.v1`, holding `done` or `skipped`. Reads and writes are wrapped in try and catch, and the sheet still works for the session if storage is blocked.
- `resetDemo` and `resetAll` clear the key so Reset scenario brings the step back for the next run.
- Connecting uses a new `connectMany` in `CampusProvider`: one storage write and one sync for all selected systems, instead of four `connect` calls that each start a sync.

**Accessibility and layout:**

- Focus moves into the dialog and returns on close. Escape behaves like **Skip for now** on the first state and like **Done** on the result.
- Connection progress and results use `role="status"` so they are announced without moving focus.
- Touch targets are at least 44px. The sheet works at 320 CSS px and at large text sizes, scrolling instead of shrinking labels.
- Motion follows the existing reduced-motion handling in `Sheet`.

**Acceptance checks:**

- First visit with empty storage shows the sheet. A visit after **Skip for now** or after connecting does not, including after reload.
- **Allow and connect** connects the selected systems and the Connections page then lists them as connected. Switching a row off leaves that system disconnected.
- A forced storage failure shows a message and keeps the sheet open with **Try again**. It never reports success.
- **Reset scenario** in the app shows the step again. `/demo` never shows it.
- No text field, password field or student ID input exists in the sheet.
- Existing end-to-end tests still pass. `playwright.config.ts` presets the onboarding key for every spec, so the sheet does not cover the screens they test. Result on 27 November 2026: all 85 specs pass in headless Chromium, including 11 new ones for this sheet.
- After Plan my week, keyboard focus is in the assistant, not on a control behind it.
- `check:copy`, tests, lint and build pass. Keyboard use, 320 px and dark theme are reported as observed or unverified, separately from code checks.

**Left for later:**

- A quiet reminder on Today for students who skipped.
- A persona or course picker in this sheet, if the team adds more than one invented student.
- Plain-language triggers in the presenter console, which is a separate decision.

## UX-ADR-009: A master calendar as the default Today

**Date:** 27 November 2026
**Status:** Implemented 27 November 2026 on the working branch, pending team review. Checked in headless Chromium and the built-in browser only.

**Problem:** Today is a grid of separate cards (Up next, Class changes, Due soon, Clubs, Find a room). To answer "what is coming up for me?" a student has to read five cards and merge them in their head: a quiz, a fee instalment, a club event and a midterm all live in different places. Several of those things are time-based and belong on one line of time.

**Options reviewed:**

- A month grid. Familiar, but at phone width the cells are too small to read a title, and it hides the order of a busy day.
- A week grid like the Timetable page. Good for classes, but it cannot hold a fee date or an exam in January without paging.
- A day-grouped agenda (a vertical timeline) with a "Now" marker. Reads in order, works at 320 px, scrolls naturally, and each row can link to the page that owns it.

**Decision:** Add a `calendar` widget, the master calendar, as a day-grouped agenda. It is the only card shown by default. Every older card stays available and is switched on from Customise. The calendar can be switched off like any other card.

**What it merges (all from existing data, no new source):**

- Classes this week, including cancelled, room changed and replacement classes. The demo timetable covers one week, so classes are not repeated into later weeks, and the card says so.
- Assignment deadlines that are not submitted (overdue ones sit in their own group at the top), fee instalments that are not paid, campus events, exams and the revision and exam weeks.
- What the student saved in this browser: confirmed study sessions, reminders, library bookings and calendar entries. These are labelled "Saved in this browser".

**Behaviour:**

- Groups by day with "Today" and "Tomorrow" labels, a "Now" line at the demo time, and earlier items today dimmed.
- A range control: Next 7 days, Next 30 days (default), Whole semester.
- Every row names its kind in text as well as by colour and icon, and links to the page that owns it.
- Reduced motion turns off the entrance slide. Nothing is gesture driven, so there is no drag or momentum.

**State and migration:**

- Saved layouts that were never changed (exactly the old default) move to the new default, so a returning browser also sees only the calendar. A layout the student did customise keeps its choices and gains the calendar at the top.
- The reference layout (the Today overview and the five curated cards) is kept for when exactly the old six cards are switched on, with or without the calendar.
- The assistant understands "master calendar" and "timeline". The word "calendar" alone now means the master calendar, not My plans.

**Acceptance checks:**

- A fresh visit shows the master calendar and none of the other cards.
- Customise lists the master calendar first. Switching it off removes it and nothing else changes.
- Unconfirmed items never appear. Submitted assignments and paid fees do not appear.
- Cancelled classes are labelled as cancelled in text.
- No horizontal scroll at 320 px.
- Existing end-to-end tests that need the old cards still pass because they switch those cards on explicitly.

### UX-ADR-009 amendment: the master calendar opens as a week grid, like Google Calendar

**Date:** 27 November 2026. The first version (a day-grouped agenda only) was rejected on review: the team wants the master calendar in timetable form, with a choice of range, like Google Calendar.

**Decision:** The calendar has three views in one control: **Week** (default), **Month** and **Agenda**.

- **Week:** hours down the side (08:00 to 20:00, growing to fit anything later), days across, a red Now line on today. Classes, exams, events, study sessions and library bookings are blocks sized by their duration. Overlapping blocks sit side by side, never underneath. Deadlines, fee dates and semester dates have no duration, so they sit in an "all day" strip above the grid, with the due time written on deadlines. Previous, Next and Today buttons move the window. On a phone the grid shows 3 days, because 7 columns cannot hold a readable title at 320 px.
- **Month:** a Monday-first month grid. Each day shows up to three entries and "+N more". Choosing a day opens the week that contains it. On a phone the cells show coloured dots and a count, because titles cannot fit.
- **Agenda:** the earlier list grouped by day, with 7 days, 30 days and Semester. It stays as the reading-order view and the one that suits a screen reader best.

**Options reviewed:** a month grid only (hides the hours of a busy day), a week grid only (cannot show a fee date or a January exam without paging), a horizontal scroll of 7 columns on a phone (hides most of the week), or the three-view control above, which keeps each view honest about what it is good at.

**Acceptance checks:** Week opens on the demo week with the Now line at 13:20; the cancelled tutorial is struck through and says Cancelled; two overlapping blocks do not cover each other; Next and Previous change the label; Month shows January exams after moving forward; choosing a month day opens its week; Agenda still lists Overdue first; no horizontal scroll at 320 px in any view; every block is a link to the page that owns it.

## UX-ADR-010: Adding and editing calendar entries and to-dos, by words or by hand

**Date:** 27 November 2026
**Status:** Implemented 27 November 2026 on the working branch, pending team review. Checked in headless Chromium and the built-in browser only.

**Problem:** The master calendar could show what the student had saved, but the student could not write into it. Saying "I have a dentist appointment this Friday at 3pm" produced no entry, and there was no to-do list at all. A calendar the student cannot edit is a poster.

**Rules that do not move:** nothing is saved until the student presses a button (AGENTS.md: confirm before saving plans). The assistant proposes, code validates, the student decides. Everything is saved in this browser only, and the interface says so. A failed storage write is reported and never shown as saved. Every add, edit and delete has an Undo.

**Options reviewed:**

- Assistant only. Smooth for a sentence, but a student cannot fix a typo or add a to-do without retyping.
- Forms only. Reliable, but slow, and it wastes the agent.
- One shared editor reached three ways. Chosen: the assistant fills the same form the student uses by hand, so what the assistant read is always visible and editable before saving.

**Decision:**

- **By words:** a sentence such as "I have a dentist appointment this Friday at 3pm", "add team meeting on 4 Dec from 2 to 4pm in B1 Hall" or "remind me to print my lab report tomorrow" is read by plain code (`lib/plans/parse.ts`) into a title, a date, a time range and a place. Questions ("Do I have a class on Friday?") and every older request type keep their old routes. With a Gemini key, a new tool `prepare_calendar_entry` returns the same card from the model's fields, which code checks and falls back to the student's words for anything malformed. A missing date or time is asked for, never invented. An unspecified end becomes one hour and says so. A date that has passed this year moves to next year and says so. The reply is a card with the editor; **Add to calendar** or **Add to-do** saves, **Cancel** discards.
- **By hand:** an **Add** button (event or to-do, one segmented control), a click on an empty hour in the week grid (prefilled with that day and time, rounded down to 30 minutes), a quick add line in the to-do list (Enter adds an undated to-do), and a tap on anything the student wrote opens the same editor with Delete.
- **What is editable:** the student's own events, reminders and to-dos. Classes, deadlines, exams, fees, library bookings and study sessions are not, because another page owns them. They keep opening that page.
- **To-dos:** a title, an optional due date, and an optional time that needs a date. They sit in the all-day strip of their day with a tick, in the agenda, and in a list under the calendar with Completed collapsed. Overdue to-dos turn red and join the overdue line.
- **Feedback:** an event that overlaps a class, exam or saved item shows which one before saving, as a warning that does not block. Cancelled classes do not count. Errors are one plain sentence in a role alert, and the typed values stay. Ticks respond on press. Toasts say what changed and offer Undo.
- **Sheet:** the editor is a bottom sheet on a phone and a side panel on a desktop, rendered in a portal so no card can cover it, with its buttons pinned in view. Inputs are 16 px so a phone does not zoom, and targets are at least 44 px.

**Limits:** 100 events, 100 reminders and 200 to-dos in this browser. Reset demo clears all of them.

**Acceptance checks:** a sentence becomes a card with the right fields and saves only on Add; a question does not become an entry; a missing title or an end before the start is refused in words and saves nothing; edit, delete and Undo work; a to-do ticks, moves to Completed and survives a reload; a click on an empty hour opens the sheet at that day and time; at 320 px the sheet, the grid and the list do not scroll sideways and the buttons stay reachable.
### Today dashboard consolidation, 27 November 2026

A daily list inside the full-width calendar keeps classes and saved commitments together. Separate daily cards repeated the same classes. Keep Week as the initial view and retain its date navigation. Show enabled cards below in two equal columns, stacking on mobile. Check for one row per assignment, four initial attention items, independent completion and dismissal, and migration of existing visibility settings.

### Student hub: open a section beside its tile, 28 November 2026

**Problem:** the open section sat after all ten tiles, so choosing Timetable put its content far down the page and the link between tile and content was lost.

**Alternatives compared:**

- Keep the panel after the grid and scroll to it. Small change, but the chosen tile leaves the screen.
- Move the panel above the grid. Content is always at the top, but choosing a lower tile makes the page jump away from it.
- Open the panel full width directly under the row of the chosen tile. Chosen: it reads as a dropdown, and keyboard order still follows the screen order.

**Limit:** tiles in later rows sit below the open panel until it is collapsed.

**Acceptance checks:** at three, two and one columns the panel starts directly under the chosen tile's row; the chosen tile is on screen after selecting it or following a section link; selecting it again collapses the panel; switching sections keeps what was typed in a section that stays mounted.

**Revision, 28 November 2026:** opening the panel under its row pushed the other tiles below it, so switching sections meant a long scroll. Once a section is open, the tiles now become a navigation bar above the content that stays at the top while scrolling: five columns on desktop, one sideways-scrolling row below 900 px. The full tile grid still shows when nothing is open. This replaces the choice and the first and third acceptance checks above. New checks: the bar stays at the top while scrolling; choosing another section from it starts that section from the top; choosing the current one returns to the grid.
