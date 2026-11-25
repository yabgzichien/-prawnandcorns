# XMUM Compass agent guidance

These rules apply to this project, including the Next.js application in `web/`.
Keep the existing generated `web/AGENTS.md` Next.js instructions intact and read the relevant local framework docs before editing framework-specific code.

## Product and copy

- `XMUM Compass` is the name already present in the original frontend repository. Treat it as a working name unless the team confirms the final brand.
- Do not use decorative middle-dot separators or typographic bullet glyphs in UI text, generated answers, demo content, metadata, messages, calendar exports, or project-owned documentation. Prefer natural sentences, colons, commas, or regular Markdown hyphen lists. See `docs/ux/UX_GUIDELINES.md`.
- Never make text sound more human merely by replacing a character. Review grammar and meaning after editing.
- Keep fictional student and academic data clearly labelled. Never claim real Moodle, academic system, payment or email access.

## UX engineering

- Follow `docs/ux/PROJECT_BRIEF.md` and `docs/ux/UX_GUIDELINES.md` for user goals, design decisions, accessible status, error recovery, responsive layouts and test evidence.
- Preserve this project's colors, typography, components, tokens and visual identity. Reuse the *method* of David's UX Engineering Kit, not the look of an unrelated app.
- For significant interaction changes, compare viable alternatives, document the decision and acceptance checks before implementation.
- Ensure user confirmation before saving study plans; never allow an AI response to bypass deterministic conflict and deadline checks.
- The private UX Kit is a source of design process guidance, not a required runtime dependency. The shared team repository should still be understandable without private GitHub access.

## Verification and safety

- Run `cd web && npm run check:copy && npm test && npm run lint && npm run build` before proposing a merge.
- For UI, responsive or interaction changes, also run `cd web && npm run test:e2e` after `npx playwright install chromium` and document which browser was actually exercised.
- Report actual test results and unverified browser/device checks separately.
- Never expose or commit `.env.local` or API keys. Do not push, merge, deploy or enable remote Gemini access without explicit authorization.
- Do not change the original competition handbook just to enforce our product's copy style: it is a supplied source document.
