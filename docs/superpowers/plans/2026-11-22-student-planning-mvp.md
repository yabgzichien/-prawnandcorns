# Confirmed Study Plan MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one demo-data study plan workflow, from a student request to an editable, conflict-checked and persisted schedule.

**Architecture:** Pure scheduling logic produces a proposal and validates conflicts independently of the assistant. The mock agent displays an action card; explicit user confirmation updates browser-local demo state, which is surfaced on Home.

**Tech Stack:** Next.js 16, React 19, TypeScript, built-in Node test runner with type stripping, localStorage demo persistence.

**Spec:** `docs/superpowers/specs/2026-11-22-student-planning-mvp-design.md`

## Global Constraints

- Only fictional data and fixed demo date; no personal, non-public or confidential student information.
- Maintain existing UI layout and isolate from Jinquan's interface development.
- Do not add a provider secret or claim a live AI integration.
- A student must explicitly confirm before any scheduling side effect.

## Review Focus

- A cancelled lesson must not block a feasible study slot (test in Task 1).
- A time boundary touching another session must be allowed, but any real overlap rejected (Task 1).
- A deadline or proposed start before the demo clock must not be scheduled (Task 1).
- A manually edited session cannot be confirmed if it conflicts with a class or another saved session (Task 2).
- Invalid persisted sessions must not crash the app (Task 2).

---

### Task 1: Pure time planner

**Files:** Create `web/src/lib/planning.ts`; create `web/tests/planning.test.ts`.

**Interfaces:** `proposeStudyPlan({ existing, prompt })`, `validateStudySessions(sessions, existing, blocked)`, `type StudySession`, `type StudyProposal`.

- [x] Write tests for weekday study windows, deadlines, cancelled classes, overlapping edits, and a Wednesday-evening assumption.
- [x] Run tests red, verifying missing scheduler functions cause a test failure.
- [x] Implement bounded slot selection over the existing fictional assignments and classes.
- [x] Run tests green with `node --experimental-strip-types --test tests/planning.test.ts` from `web/`.

### Task 2: Review and save confirmation

**Files:** Modify `web/src/lib/state.tsx`, `web/src/lib/agent.ts`, `web/src/components/agent/{AgentPanel,Cards}.tsx`; create `web/tests/planning-persistence.test.ts` if persistence helpers are pure.

**Interfaces:** Agent adds a `study-plan` card; `useApp().confirmStudyPlan(sessions, blocked)` checks and saves or reports a validation error.

- [x] Add a failing persistence/validation test for stale or malformed sessions.
- [x] Add guarded persisted session state, reset and duplicate protection.
- [x] Add rule-based planning intent and clearly marked simulated planning card.
- [x] Add editable date-time controls and Confirm / Reject; confirm checks again before writing.
- [x] Run focused tests.

### Task 3: Dashboard and handoff QA

**Files:** Modify `web/src/components/home/HomeView.tsx`, `web/README.md`; create `docs/COMPETITION_TECHNICAL_STATUS.md`.

- [x] Show confirmed study blocks from persisted state in Home with demo label.
- [x] Document architecture, explicit limitations, manual test steps and responsibilities.
- [x] Run tests, lint, TypeScript check and production build; inspect Git diff and leave unrelated user changes alone.

**Automated verification:** 10/10 planning tests, TypeScript, ESLint, production build, and HTTP smoke tests for `/`, `/assignments`, and `/map` passed on 22 November 2026. Desktop/mobile interactive UI validation and real LLM integration are still outstanding.
