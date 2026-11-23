"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { asMalaysiaIso, tryConfirmStudyPlan, type BusyBlock, type StudySession } from "./planning";
import { classBlocksFrom, sanitizeDemoStudySessions, tasksFrom } from "./planning-demo";
import { applyFixes } from "./updates/apply";
import { isMyIso, type Fix, type PersonalEvent, type Reminder } from "./updates/types";
import { useCampus } from "./sync/CampusProvider";
import { DEMO_NOW } from "./time";
import { persistDemoSnapshot } from "./demo-persistence";

export type WidgetId = "next" | "alerts" | "due" | "today" | "fees" | "progress" | "clubs" | "find";
export type WidgetPref = { id: WidgetId; hidden: boolean };
export type Theme = "system" | "light" | "dark";

export const WIDGET_META: Record<WidgetId, { title: string; aliases: string[] }> = {
  next: { title: "Up next", aliases: ["next class", "up next", "next"] },
  alerts: { title: "Class changes", aliases: ["alerts", "changes", "cancellation", "cancellations", "replacement", "notices", "class changes"] },
  due: { title: "Due soon", aliases: ["assignments", "assignment", "deadlines", "deadline", "due", "moodle", "homework"] },
  today: { title: "Today", aliases: ["today", "timetable", "schedule", "classes"] },
  fees: { title: "Fees", aliases: ["finance", "fees", "fee", "payment", "payments", "money", "tuition"] },
  progress: { title: "Degree progress", aliases: ["progress", "degree", "credits", "courses", "core"] },
  clubs: { title: "Clubs & events", aliases: ["clubs", "club", "eca", "events", "activities", "societies"] },
  find: { title: "Find a room", aliases: ["map", "find", "rooms", "room", "campus"] },
};

export const DEFAULT_WIDGETS: WidgetPref[] = [
  { id: "next", hidden: false },
  { id: "alerts", hidden: false },
  { id: "due", hidden: false },
  { id: "today", hidden: false },
  { id: "clubs", hidden: false },
  { id: "find", hidden: false },
  { id: "fees", hidden: true },
  { id: "progress", hidden: true },
];

type State = {
  hydrated: boolean;
  theme: Theme;
  widgets: WidgetPref[];
  joined: string[];
  submitted: string[];
  studySessions: StudySession[];
  reminders: Reminder[];
  personalEvents: PersonalEvent[];
  /** Set after an approval, until it is undone or replaced. Not saved, so a reload ends it. */
  lastApply: { id: number; before: Pick<State, "studySessions" | "reminders" | "personalEvents">; ackIds: string[]; summary: string } | null;
  agentOpen: boolean;
  agentSeed: { prompt: string; nonce: number } | null;
  toast: { id: number; text: string; undo?: () => void } | null;
};

const initial: State = {
  hydrated: false,
  theme: "system",
  widgets: DEFAULT_WIDGETS,
  joined: [],
  submitted: [],
  studySessions: [],
  reminders: [],
  personalEvents: [],
  lastApply: null,
  agentOpen: false,
  agentSeed: null,
  toast: null,
};

type Action =
  | { type: "hydrate"; saved: Partial<State> }
  | { type: "theme"; theme: Theme }
  | { type: "widgets"; widgets: WidgetPref[] }
  | { type: "toggleClub"; id: string }
  | { type: "toggleSubmitted"; id: string }
  | { type: "studySessions"; sessions: StudySession[] }
  | { type: "plan"; plan: Pick<State, "studySessions" | "reminders" | "personalEvents">; lastApply: State["lastApply"] }
  | { type: "removeReminder"; id: string }
  | { type: "removeEvent"; id: string }
  | { type: "agent"; open: boolean; seed?: string }
  | { type: "reset" }
  | { type: "toast"; toast: State["toast"] };

const tooLong = (v: unknown, max: number) => typeof v !== "string" || v.length === 0 || v.length > max;
function sanitizeReminders(raw: unknown): Reminder[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is Reminder => !!r && typeof r === "object" && !tooLong((r as Reminder).id, 150) && !tooLong((r as Reminder).title, 120) && isMyIso((r as Reminder).at)).slice(0, 30);
}
function sanitizeEvents(raw: unknown): PersonalEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is PersonalEvent => !!e && typeof e === "object" && !tooLong((e as PersonalEvent).id, 150) && !tooLong((e as PersonalEvent).title, 120) && isMyIso((e as PersonalEvent).start) && isMyIso((e as PersonalEvent).end)).slice(0, 30);
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate": return { ...s, ...a.saved, studySessions: sanitizeDemoStudySessions(a.saved.studySessions), reminders: sanitizeReminders(a.saved.reminders), personalEvents: sanitizeEvents(a.saved.personalEvents), lastApply: null, hydrated: true };
    case "theme": return { ...s, theme: a.theme };
    case "widgets": return { ...s, widgets: a.widgets };
    case "toggleClub": return { ...s, joined: s.joined.includes(a.id) ? s.joined.filter((x) => x !== a.id) : [...s.joined, a.id] };
    case "toggleSubmitted": return { ...s, submitted: s.submitted.includes(a.id) ? s.submitted.filter((x) => x !== a.id) : [...s.submitted, a.id] };
    case "studySessions": return { ...s, studySessions: a.sessions };
    case "plan": return { ...s, ...a.plan, lastApply: a.lastApply };
    case "removeReminder": return { ...s, reminders: s.reminders.filter((r) => r.id !== a.id) };
    case "removeEvent": return { ...s, personalEvents: s.personalEvents.filter((e) => e.id !== a.id) };
    case "agent": return { ...s, agentOpen: a.open, agentSeed: a.seed ? { prompt: a.seed, nonce: Date.now() } : a.open ? s.agentSeed : null };
    case "reset": return { ...initial, hydrated: true, theme: s.theme, agentOpen: s.agentOpen };
    case "toast": return { ...s, toast: a.toast };
  }
}

const KEY = "xmum-compass:v1";
type Persisted = Pick<State, "theme" | "widgets" | "joined" | "submitted" | "studySessions" | "reminders" | "personalEvents">;

type Ctx = State & {
  setTheme: (t: Theme) => void;
  setWidgets: (w: WidgetPref[]) => void;
  toggleClub: (id: string) => void;
  toggleSubmitted: (id: string) => void;
  confirmStudyPlan: (sessions: StudySession[], blocked: BusyBlock[]) => { ok: boolean; error?: string };
  removeStudySession: (id: string) => void;
  removeReminder: (id: string) => void;
  removeEvent: (id: string) => void;
  /** Saves approved fixes to the student's own plan, with one undo step for the whole batch. */
  applyUpdates: (fixes: Fix[]) => { ok: true; summary: string; applyId: number } | { ok: false; error: string };
  undoLastApply: () => boolean;
  openAgent: (seed?: string) => void;
  closeAgent: () => void;
  showToast: (text: string, undo?: () => void) => void;
  resetDemo: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const toastId = useRef(0);
  const applySeq = useRef(0);
  const campus = useCampus();
  const latest = useRef({ state, campus });
  useEffect(() => { latest.current = { state, campus }; });

  // hydrate from localStorage once (always wrapped: storage can be blocked or throw)
  useEffect(() => {
    let saved: Partial<Persisted> = {};
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed as Partial<Persisted>;
      }
    } catch {}
    dispatch({ type: "hydrate", saved });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const p: Persisted = { theme: state.theme, widgets: state.widgets, joined: state.joined, submitted: state.submitted, studySessions: state.studySessions, reminders: state.reminders, personalEvents: state.personalEvents };
    persistDemoSnapshot(() => localStorage, KEY, p);
  }, [state.hydrated, state.theme, state.widgets, state.joined, state.submitted, state.studySessions, state.reminders, state.personalEvents]);

  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", state.theme);
  }, [state.theme]);

  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: "toast", toast: null }), 5200);
    return () => clearTimeout(t);
  }, [state.toast]);

  const showToast = useCallback((text: string, undo?: () => void) => {
    dispatch({ type: "toast", toast: { id: ++toastId.current, text, undo } });
  }, []);

  /** Puts the plan back as it was before an approval. Works from the latest state, so a toast button never goes stale. */
  const undoApply = useCallback((applyId?: number): boolean => {
    const { state: s, campus: c } = latest.current;
    const last = s.lastApply;
    if (!last || (applyId !== undefined && last.id !== applyId)) return false;
    const snapshot: Persisted = { theme: s.theme, widgets: s.widgets, joined: s.joined, submitted: s.submitted, ...last.before };
    if (!persistDemoSnapshot(() => localStorage, KEY, snapshot)) return false;
    dispatch({ type: "plan", plan: last.before, lastApply: null });
    c.unacknowledge(last.ackIds);
    showToast("Plan restored to how it was before the approval.");
    return true;
  }, [showToast]);

  const value = useMemo<Ctx>(() => ({
    ...state,
    setTheme: (theme) => dispatch({ type: "theme", theme }),
    setWidgets: (widgets) => dispatch({ type: "widgets", widgets }),
    toggleClub: (id) => dispatch({ type: "toggleClub", id }),
    toggleSubmitted: (id) => dispatch({ type: "toggleSubmitted", id }),
    confirmStudyPlan: (sessions, blocked) => {
      if (!state.hydrated) return { ok: false, error: "Demo is still loading. Please try again." };
      const result = tryConfirmStudyPlan(sessions, state.studySessions, tasksFrom(campus.data.assignments, state.submitted), classBlocksFrom(campus.data.classes), blocked, asMalaysiaIso(DEMO_NOW.getTime()));
      if (result.ok) {
        const snapshot: Persisted = {
          theme: state.theme, widgets: state.widgets, joined: state.joined, submitted: state.submitted,
          studySessions: result.sessions, reminders: state.reminders, personalEvents: state.personalEvents,
        };
        if (!persistDemoSnapshot(() => localStorage, KEY, snapshot)) {
          return { ok: false, error: "Unable to save in this browser. Check that site storage is enabled and space is available, then try again." };
        }
        dispatch({ type: "studySessions", sessions: result.sessions });
      }
      return result;
    },
    removeStudySession: (id) => dispatch({ type: "studySessions", sessions: state.studySessions.filter((item) => item.id !== id) }),
    removeReminder: (id) => dispatch({ type: "removeReminder", id }),
    removeEvent: (id) => dispatch({ type: "removeEvent", id }),
    applyUpdates: (fixes) => {
      if (!state.hydrated) return { ok: false, error: "Demo is still loading. Please try again." };
      const before = { studySessions: state.studySessions, reminders: state.reminders, personalEvents: state.personalEvents };
      const result = applyFixes(before, fixes, {
        now: asMalaysiaIso(DEMO_NOW.getTime()),
        tasks: tasksFrom(campus.data.assignments, state.submitted),
        classBlocks: classBlocksFrom(campus.data.classes),
        changeIds: new Set(campus.changes.map((c) => c.id)),
      });
      if (!result.ok) return result;
      const snapshot: Persisted = { theme: state.theme, widgets: state.widgets, joined: state.joined, submitted: state.submitted, ...result.plan };
      if (!persistDemoSnapshot(() => localStorage, KEY, snapshot)) {
        return { ok: false, error: "Unable to save in this browser. Check that site storage is enabled and space is available, then try again." };
      }
      const applyId = ++applySeq.current;
      dispatch({ type: "plan", plan: result.plan, lastApply: { id: applyId, before, ackIds: result.ackIds, summary: result.summary } });
      campus.acknowledge(result.ackIds);
      showToast(result.summary, () => { undoApply(applyId); });
      return { ok: true, summary: result.summary, applyId };
    },
    undoLastApply: () => undoApply(),
    openAgent: (seed) => dispatch({ type: "agent", open: true, seed }),
    closeAgent: () => dispatch({ type: "agent", open: false }),
    showToast,
    resetDemo: () => {
      try { localStorage.removeItem(KEY); } catch {}
      campus.resetAll();
      dispatch({ type: "reset" });
      showToast("Demo reset to its starting state");
    },
  }), [state, showToast, campus, undoApply]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
