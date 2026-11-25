"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";

export type WidgetId = "next" | "alerts" | "due" | "today" | "fees" | "progress" | "clubs" | "find";
export type WidgetPref = { id: WidgetId; hidden: boolean };

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
  widgets: WidgetPref[];
  joined: string[];
  submitted: string[];
  moodle: "disconnected" | "connected";
  agentOpen: boolean;
  agentSeed: { prompt: string; nonce: number } | null;
  toast: { id: number; text: string; undo?: () => void } | null;
};

const initial: State = {
  hydrated: false,
  widgets: DEFAULT_WIDGETS,
  joined: [],
  submitted: [],
  moodle: "disconnected",
  agentOpen: false,
  agentSeed: null,
  toast: null,
};

type Action =
  | { type: "hydrate"; saved: Partial<State> }
  | { type: "widgets"; widgets: WidgetPref[] }
  | { type: "toggleClub"; id: string }
  | { type: "toggleSubmitted"; id: string }
  | { type: "moodle"; value: State["moodle"] }
  | { type: "agent"; open: boolean; seed?: string }
  | { type: "reset" }
  | { type: "toast"; toast: State["toast"] };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate": return { ...s, ...a.saved, hydrated: true };
    case "widgets": return { ...s, widgets: a.widgets };
    case "toggleClub": return { ...s, joined: s.joined.includes(a.id) ? s.joined.filter((x) => x !== a.id) : [...s.joined, a.id] };
    case "toggleSubmitted": return { ...s, submitted: s.submitted.includes(a.id) ? s.submitted.filter((x) => x !== a.id) : [...s.submitted, a.id] };
    case "moodle": return { ...s, moodle: a.value };
    case "agent": return { ...s, agentOpen: a.open, agentSeed: a.seed ? { prompt: a.seed, nonce: Date.now() } : a.open ? s.agentSeed : null };
    case "reset": return { ...initial, hydrated: true, agentOpen: s.agentOpen };
    case "toast": return { ...s, toast: a.toast };
  }
}

const KEY = "xmum-compass:v1";
type Persisted = Pick<State, "widgets" | "joined" | "submitted" | "moodle">;

type Ctx = State & {
  setWidgets: (w: WidgetPref[]) => void;
  toggleClub: (id: string) => void;
  toggleSubmitted: (id: string) => void;
  setMoodle: (v: State["moodle"]) => void;
  openAgent: (seed?: string) => void;
  closeAgent: () => void;
  showToast: (text: string, undo?: () => void) => void;
  resetDemo: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const toastId = useRef(0);

  // hydrate from localStorage once (always wrapped: storage can be blocked or throw)
  useEffect(() => {
    let saved: Partial<Persisted> = {};
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) saved = JSON.parse(raw) as Partial<Persisted>;
    } catch {}
    dispatch({ type: "hydrate", saved });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const p: Persisted = { widgets: state.widgets, joined: state.joined, submitted: state.submitted, moodle: state.moodle };
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
  }, [state.hydrated, state.widgets, state.joined, state.submitted, state.moodle]);

  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: "toast", toast: null }), 5200);
    return () => clearTimeout(t);
  }, [state.toast]);

  const showToast = useCallback((text: string, undo?: () => void) => {
    dispatch({ type: "toast", toast: { id: ++toastId.current, text, undo } });
  }, []);

  const value = useMemo<Ctx>(() => ({
    ...state,
    setWidgets: (widgets) => dispatch({ type: "widgets", widgets }),
    toggleClub: (id) => dispatch({ type: "toggleClub", id }),
    toggleSubmitted: (id) => dispatch({ type: "toggleSubmitted", id }),
    setMoodle: (value) => dispatch({ type: "moodle", value }),
    openAgent: (seed) => dispatch({ type: "agent", open: true, seed }),
    closeAgent: () => dispatch({ type: "agent", open: false }),
    showToast,
    resetDemo: () => {
      try { localStorage.removeItem(KEY); } catch {}
      dispatch({ type: "reset" });
      showToast("Demo reset to its starting state");
    },
  }), [state, showToast]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
