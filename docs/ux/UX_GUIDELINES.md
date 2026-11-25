# XMUM Compass UX engineering guidelines

**Applied guidance:** David's UX Engineering Kit, reviewed on 23 November 2026. This is a project-owned adaptation, not a copy of the private kit or a new universal design system.

## Copy and tone

- Write plain English appropriate for a student-facing app. Start with what happened and what the student should do next.
- Avoid decorative middle-dot separators and typographic bullet glyphs. Use natural language, accessible labels and standard Markdown hyphen lists.
- Keep real states distinct: `Suggested`, `Not saved`, `Saved in this browser`, `Failed`, and `Unavailable` must not be conflated.
- Avoid invented confidence claims such as "fully synced" when data only exists in localStorage.
- Use short summaries in the assistant, with detailed actions in the editable card. Do not repeat an entire schedule above its card.

## Experience and behavior

1. **Intent:** Let the user explain a goal in ordinary words.
2. **Planning:** Show proposed outcomes and any assumptions. The model does not write to the calendar.
3. **Review:** Allow edits and removal, validate date ranges and conflicts, and provide a clearly reachable confirmation action.
4. **Commit:** Save only when the user confirms a valid proposal.
5. **Outcome:** State where data was saved, how to view it and how to remove it. Never imply university sync.
6. **Failure:** Preserve user input where possible, show one relevant next action and never report success just because a request was sent.

## Project-specific design system

- Preserve semantic CSS variables in `web/src/app/globals.css`: `--bg`, `--surface`, `--label`, `--accent`, status colors and motion behavior.
- Reuse existing controls and spacing where practical. No automatic adoption of CCC Connect palettes or components.
- Use native buttons and inputs with accessible names, visible keyboard focus, minimum practical touch targets and sufficient contrast.
- Keep forms reachable at narrow widths and high text zoom. Prefer wrapping or scrolling to shrinking labels.
- Respect reduced-motion preferences; status must remain meaningful without animation.

## Testing and evidence

- `npm run check:copy` prevents the disallowed glyphs from re-entering owned source and documentation.
- `npm test`, `npm run lint`, and `npm run build` cover logic and static quality, but do not validate visual or screen-reader behavior.
- Manually verify the full study-plan journey in Safari/Chrome at 320 CSS px and desktop widths, including dark mode, keyboard focus, errors, confirmation and refresh.
- Mark results as **observed**, **code verified** or **unverified**. Never treat visual polish as proof that a flow is usable.

## Reference and maintenance

The team can use these local rules without private repository permissions. For source methodology, the kit's relevant modules were its agent guidance, responsive React recommendations, UX quality gates and accessible status messaging pattern (UX-STATUS-001). Review `docs/ux/DECISIONS.md` and `docs/ux/UX_AUDIT_2026-11-23.md` before changing core interactions.
