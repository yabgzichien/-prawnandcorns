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
