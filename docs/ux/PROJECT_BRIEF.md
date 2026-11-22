# XMUM Compass: UX project brief

**Date:** 23 November 2026
**Status:** Working draft for team review
**Platform:** Responsive Next.js web application

## User problem

Current and incoming XMUM students may need to check several places to understand their classes, deadlines and other commitments. The prototype aims to help them answer a practical question: *What should I work on next, and when?*

The first user journey is requesting a weekly study plan, reviewing the proposed sessions and confirming them without unintended conflicts.

## Evidence and uncertainty

- **Verified in source:** The existing UI includes a dashboard, Compass assistant, assignments, timetable and a study-plan confirmation card.
- **Observed in local testing:** A real Gemini tool-call response created a study proposal; the user later confirmed a plan and saw it on the dashboard.
- **Not established:** Representative student interviews, measured time savings, real XMUM system integrations, mobile screen-reader compatibility and cross-device persistence.

## Current constraints

- All course, timetable, assignment, club and finance records are fictional demo data.
- Study plans are stored locally in the current browser. They do not sync to a university account.
- The model interprets intent and chooses approved tools; deterministic TypeScript logic decides whether sessions are valid.
- The user reviews and confirms a proposal before it can be saved.
- Existing team-owned branding, layout and tokens remain authoritative.

## Definition of success for the MVP

1. Student asks for a weekly plan and mentions an uncertain meeting time.
2. The interface makes the meeting-time assumption visible and editable session times understandable.
3. Conflicts and invalid edits block confirmation with actionable explanations.
4. Saving requires a deliberate click and shows a lasting result on the dashboard after refresh.
5. Rejection leaves saved sessions unchanged; outages do not silently save anything.

## Not in this release

Live Moodle or Academic Affairs access, account syncing, real payment operations, automatic schedule writes and public remote access to the Gemini endpoint.
