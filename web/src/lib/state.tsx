"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { asMalaysiaIso, tryConfirmStudyPlan, type BusyBlock, type StudySession } from "./planning";
import { classBlocksFrom, sanitizeDemoStudySessions, tasksFrom } from "./planning-demo";
import { applyFixes } from "./updates/apply";
import { isMyIso, type Fix, type PersonalEvent, type Reminder } from "./updates/types";
import { checkBooking, checkCancel, bookingId, sanitizeBookings, SLOTS, type LibraryBooking } from "./library/policy";
import { LIBRARY_ROOM_BY_ID } from "./library/rooms";
import { nextTicketId, sanitizeTickets, type AskaDraft, type AskaTicket } from "./aska";
import { applicationFrom, nextApplicationId, sanitizeApplications, MAX_SAVED_APPLICATIONS } from "./events/application";
import { checkApplication, problemsOf } from "./events/checks";
import { hasAnyDecision, parseDecisions } from "./events/decisions";
import { SEEDED_APPLICATIONS, SEEDED_DECISIONS } from "./events/seed";
import { DECISIONS_KEY, type EventApplication, type EventDraft } from "./events/types";
import { useCampus } from "./sync/CampusProvider";
import { DEMO_NOW } from "./time";
import { persistDemoSnapshot } from "./demo-persistence";
import { checkShortlist, sanitizeShortlist } from "./electives/plan";
import { STUDENT_STREAM } from "./electives/catalogue";
import type { ElectiveShortlist } from "./electives/types";

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
  /** Library rooms the student has booked. Saved in this browser only. */
  bookings: LibraryBooking[];
  /** Help desk tickets the student has submitted. Saved in this browser only. */
  tickets: AskaTicket[];
  /** Club event applications the student has submitted. Saved in this browser only. */
  eventApplications: EventApplication[];
  /** The general electives the student shortlisted for next semester. Saved in this browser only; not a registration. */
  electives: ElectiveShortlist | null;
  /** Set after an approval, until it is undone or replaced. Not saved, so a reload ends it. */
  lastApply: { id: number; before: Pick<State, "studySessions" | "reminders" | "personalEvents">; ackIds: string[]; summary: string } | null;
  /** A prepared help desk ticket waiting for the student to review and submit. Opened from the agent, the help desk or the mail assistant. */
  askaDraft: AskaDraft | null;
  /** A prepared club event application waiting for the student to go through it and submit. Not saved. */
  eventDraft: EventDraft | null;
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
  bookings: [],
  tickets: [],
  eventApplications: [],
  electives: null,
  askaDraft: null,
  eventDraft: null,
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
  | { type: "bookings"; bookings: LibraryBooking[] }
  | { type: "tickets"; tickets: AskaTicket[] }
  | { type: "askaDraft"; draft: AskaDraft | null }
  | { type: "eventApplications"; applications: EventApplication[] }
  | { type: "electives"; shortlist: ElectiveShortlist | null }
  | { type: "eventDraft"; draft: EventDraft | null }
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
    case "hydrate": return { ...s, ...a.saved, studySessions: sanitizeDemoStudySessions(a.saved.studySessions), reminders: sanitizeReminders(a.saved.reminders), personalEvents: sanitizeEvents(a.saved.personalEvents), bookings: sanitizeBookings(a.saved.bookings), tickets: sanitizeTickets(a.saved.tickets), eventApplications: sanitizeApplications(a.saved.eventApplications), electives: sanitizeShortlist(a.saved.electives), lastApply: null, hydrated: true };
    case "theme": return { ...s, theme: a.theme };
    case "widgets": return { ...s, widgets: a.widgets };
    case "toggleClub": return { ...s, joined: s.joined.includes(a.id) ? s.joined.filter((x) => x !== a.id) : [...s.joined, a.id] };
    case "toggleSubmitted": return { ...s, submitted: s.submitted.includes(a.id) ? s.submitted.filter((x) => x !== a.id) : [...s.submitted, a.id] };
    case "studySessions": return { ...s, studySessions: a.sessions };
    case "plan": return { ...s, ...a.plan, lastApply: a.lastApply };
    case "bookings": return { ...s, bookings: a.bookings };
    case "tickets": return { ...s, tickets: a.tickets };
    // one sheet at a time: opening the ticket form puts the assistant away, and its messages are still there afterwards
    case "eventApplications": return { ...s, eventApplications: a.applications };
    case "electives": return { ...s, electives: a.shortlist };
    case "eventDraft": return { ...s, eventDraft: a.draft, agentOpen: a.draft ? false : s.agentOpen };
    case "askaDraft": return { ...s, askaDraft: a.draft, agentOpen: a.draft ? false : s.agentOpen };
    case "removeReminder": return { ...s, reminders: s.reminders.filter((r) => r.id !== a.id) };
    case "removeEvent": return { ...s, personalEvents: s.personalEvents.filter((e) => e.id !== a.id) };
    case "agent": return { ...s, agentOpen: a.open, agentSeed: a.seed ? { prompt: a.seed, nonce: Date.now() } : a.open ? s.agentSeed : null };
    case "reset": return { ...initial, hydrated: true, theme: s.theme, agentOpen: s.agentOpen };
    case "toast": return { ...s, toast: a.toast };
  }
}

const KEY = "xmum-compass:v1";
type Persisted = Pick<State, "theme" | "widgets" | "joined" | "submitted" | "studySessions" | "reminders" | "personalEvents" | "bookings" | "tickets" | "eventApplications" | "electives">;

/** One place decides what is saved, so a new kind of saved data cannot be forgotten by one of the save paths. */
const persistedOf = (s: State, over: Partial<Persisted> = {}): Persisted => ({
  theme: s.theme, widgets: s.widgets, joined: s.joined, submitted: s.submitted,
  studySessions: s.studySessions, reminders: s.reminders, personalEvents: s.personalEvents, bookings: s.bookings, tickets: s.tickets, eventApplications: s.eventApplications, electives: s.electives, ...over,
});

type Ctx = State & {
  setTheme: (t: Theme) => void;
  setWidgets: (w: WidgetPref[]) => void;
  toggleClub: (id: string) => void;
  toggleSubmitted: (id: string) => void;
  confirmStudyPlan: (sessions: StudySession[], blocked: BusyBlock[]) => { ok: boolean; error?: string };
  removeStudySession: (id: string) => void;
  /** Books a library room for the student, if the rules allow. Saved in this browser only, with an Undo. */
  bookLibraryRoom: (roomId: string, date: string, slot: number) => { ok: true; booking: LibraryBooking } | { ok: false; error: string };
  /** Cancels a booking, if it is not more than 15 minutes into its slot. */
  cancelLibraryBooking: (id: string) => { ok: true } | { ok: false; error: string };
  /** Saves a help desk ticket the student has reviewed and submitted. Nothing is sent to a real help desk. */
  openAskaTicket: (draft: AskaDraft) => void;
  closeAskaTicket: () => void;
  submitAskaTicket: (draft: AskaDraft) => { ok: true; ticket: AskaTicket } | { ok: false; error: string };
  /** Opens the club event application with a prepared draft, or an empty one. Saves nothing. */
  openEventApplication: (draft: EventDraft) => void;
  closeEventApplication: () => void;
  /** Saves a reviewed club event application. Blocked while a check finds a problem. Nothing is sent to a real office. */
  submitEventApplication: (draft: EventDraft) => { ok: true; application: EventApplication } | { ok: false; error: string };
  /** Takes back an application no office has answered yet. */
  withdrawEventApplication: (id: string) => { ok: true } | { ok: false; error: string };
  /** Saves the elective shortlist after checking it again. Blocked by a clash, a full course or an unreadable time. Not a registration. */
  saveElectives: (codes: string[], target: number) => { ok: true } | { ok: false; error: string };
  clearElectives: () => void;
  removeReminder: (id: string) => void;
  removeEvent: (id: string) => void;
  /** Saves approved fixes to the student's own plan, with one undo step for the whole batch. */
  applyUpdates: (fixes: Fix[]) => { ok: true; summary: string; applyId: number } | { ok: false; error: string };
  undoLastApply: () => boolean;
  /** Saves an event the student chose to go to. Only called from a button press, with Undo in the toast. */
  addPersonalEvent: (ev: PersonalEvent) => { ok: true } | { ok: false; error: string };
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
    persistDemoSnapshot(() => localStorage, KEY, persistedOf(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated, state.theme, state.widgets, state.joined, state.submitted, state.studySessions, state.reminders, state.personalEvents, state.bookings, state.tickets, state.eventApplications, state.electives]);

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
    const snapshot = persistedOf(s, last.before);
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
        const snapshot = persistedOf(state, { studySessions: result.sessions });
        if (!persistDemoSnapshot(() => localStorage, KEY, snapshot)) {
          return { ok: false, error: "Unable to save in this browser. Check that site storage is enabled and space is available, then try again." };
        }
        dispatch({ type: "studySessions", sessions: result.sessions });
      }
      return result;
    },
    removeStudySession: (id) => dispatch({ type: "studySessions", sessions: state.studySessions.filter((item) => item.id !== id) }),
    bookLibraryRoom: (roomId, date, slot) => {
      if (!state.hydrated) return { ok: false, error: "Demo is still loading. Please try again." };
      const check = checkBooking({ roomId, date, slot }, state.bookings, DEMO_NOW);
      if (!check.ok) return check;
      const booking: LibraryBooking = { id: bookingId(roomId, date, slot), roomId, date, slot };
      const next = [...state.bookings, booking];
      if (!persistDemoSnapshot(() => localStorage, KEY, persistedOf(state, { bookings: next }))) {
        return { ok: false, error: "Unable to save in this browser. Check that site storage is enabled and space is available, then try again." };
      }
      dispatch({ type: "bookings", bookings: next });
      const room = LIBRARY_ROOM_BY_ID[roomId];
      showToast(`Booked ${room.name}, ${SLOTS[slot].start} to ${SLOTS[slot].end}. Saved in this browser.`, () => {
        const now = latest.current.state.bookings.filter((b) => b.id !== booking.id);
        persistDemoSnapshot(() => localStorage, KEY, persistedOf(latest.current.state, { bookings: now }));
        dispatch({ type: "bookings", bookings: now });
        showToast("Booking removed.");
      });
      return { ok: true, booking };
    },
    cancelLibraryBooking: (id) => {
      const booking = state.bookings.find((b) => b.id === id);
      if (!booking) return { ok: false, error: "That booking is no longer saved." };
      const check = checkCancel(booking, DEMO_NOW);
      if (!check.ok) return check;
      const next = state.bookings.filter((b) => b.id !== id);
      if (!persistDemoSnapshot(() => localStorage, KEY, persistedOf(state, { bookings: next }))) {
        return { ok: false, error: "Unable to save in this browser. Check that site storage is enabled and space is available, then try again." };
      }
      dispatch({ type: "bookings", bookings: next });
      showToast(`Cancelled ${LIBRARY_ROOM_BY_ID[booking.roomId].name}. The slot is free for others.`);
      return { ok: true };
    },
    openAskaTicket: (draft) => dispatch({ type: "askaDraft", draft }),
    closeAskaTicket: () => dispatch({ type: "askaDraft", draft: null }),
    submitAskaTicket: (draft) => {
      if (!state.hydrated) return { ok: false, error: "Demo is still loading. Please try again." };
      if (state.tickets.length >= 10) return { ok: false, error: "You already have 10 tickets saved. Reset the demo to start again." };
      if (!draft.title.trim() || !draft.description.trim()) return { ok: false, error: "A ticket needs a title and a description." };
      if (!draft.block || !draft.room.trim()) return { ok: false, error: "Add your block and room number so a technician knows where to go." };
      const ticket: AskaTicket = { ...draft, title: draft.title.trim().slice(0, 100), description: draft.description.trim().slice(0, 900), room: draft.room.trim().toUpperCase().slice(0, 6), id: nextTicketId(state.tickets), submittedAt: asMalaysiaIso(DEMO_NOW.getTime()) };
      const next = [...state.tickets, ticket];
      if (!persistDemoSnapshot(() => localStorage, KEY, persistedOf(state, { tickets: next }))) {
        return { ok: false, error: "Unable to save in this browser. Check that site storage is enabled and space is available, then try again." };
      }
      dispatch({ type: "tickets", tickets: next });
      showToast(`Ticket ${ticket.id} saved in this browser. This demo sends nothing to a real help desk.`);
      return { ok: true, ticket };
    },
    openEventApplication: (draft) => dispatch({ type: "eventDraft", draft }),
    closeEventApplication: () => dispatch({ type: "eventDraft", draft: null }),
    submitEventApplication: (draft) => {
      if (!state.hydrated) return { ok: false, error: "Demo is still loading. Please try again." };
      if (state.eventApplications.length >= MAX_SAVED_APPLICATIONS) return { ok: false, error: `You already have ${MAX_SAVED_APPLICATIONS} applications saved. Withdraw one or reset the demo to start again.` };
      let decisions = SEEDED_DECISIONS;
      try { decisions = { ...SEEDED_DECISIONS, ...parseDecisions(localStorage.getItem(DECISIONS_KEY) ?? "{}") }; } catch {}
      // checked again here, whatever the form showed, so a draft that skipped a step cannot be saved with a problem in it
      const problems = problemsOf(checkApplication(draft, [...SEEDED_APPLICATIONS, ...state.eventApplications], decisions, DEMO_NOW));
      if (problems.length > 0) return { ok: false, error: problems[0].message };
      const application = applicationFrom(draft, nextApplicationId([...state.eventApplications], decisions), asMalaysiaIso(DEMO_NOW.getTime()));
      const next = [...state.eventApplications, application];
      if (!persistDemoSnapshot(() => localStorage, KEY, persistedOf(state, { eventApplications: next }))) {
        return { ok: false, error: "Unable to save in this browser. Check that site storage is enabled and space is available, then try again." };
      }
      dispatch({ type: "eventApplications", applications: next });
      showToast(`Application ${application.id} saved in this browser. This demo sends nothing to a real office.`);
      return { ok: true, application };
    },
    withdrawEventApplication: (id) => {
      const app = state.eventApplications.find((a) => a.id === id);
      if (!app) return { ok: false, error: "That application is no longer saved." };
      let decisions = {};
      try { decisions = parseDecisions(localStorage.getItem(DECISIONS_KEY) ?? "{}"); } catch {}
      if (hasAnyDecision(app, decisions)) return { ok: false, error: "An office has already answered part of this application, so it can no longer be withdrawn here." };
      const next = state.eventApplications.filter((a) => a.id !== id);
      if (!persistDemoSnapshot(() => localStorage, KEY, persistedOf(state, { eventApplications: next }))) {
        return { ok: false, error: "Unable to save in this browser. Check that site storage is enabled and space is available, then try again." };
      }
      dispatch({ type: "eventApplications", applications: next });
      showToast(`Application ${id} withdrawn.`, () => {
        const back = [...latest.current.state.eventApplications, app].sort((x, y) => x.id.localeCompare(y.id));
        persistDemoSnapshot(() => localStorage, KEY, persistedOf(latest.current.state, { eventApplications: back }));
        dispatch({ type: "eventApplications", applications: back });
        showToast(`Application ${id} is back.`);
      });
      return { ok: true };
    },
    saveElectives: (codes, target) => {
      if (!state.hydrated) return { ok: false, error: "Demo is still loading. Please try again." };
      const check = checkShortlist(codes, STUDENT_STREAM, target);
      if (!check.ok) return { ok: false, error: check.problems[0] };
      const before = state.electives;
      const shortlist: ElectiveShortlist = { codes: [...codes], target, savedAt: asMalaysiaIso(DEMO_NOW.getTime()) };
      if (!persistDemoSnapshot(() => localStorage, KEY, persistedOf(state, { electives: shortlist }))) {
        return { ok: false, error: "Unable to save in this browser. Check that site storage is enabled and space is available, then try again." };
      }
      dispatch({ type: "electives", shortlist });
      showToast(`Shortlist saved in this browser: ${codes.join(", ")}. You still need to register in the AC system.`, () => {
        persistDemoSnapshot(() => localStorage, KEY, persistedOf(latest.current.state, { electives: before }));
        dispatch({ type: "electives", shortlist: before });
        showToast(before ? "Previous shortlist restored." : "Shortlist removed.");
      });
      return { ok: true };
    },
    clearElectives: () => {
      persistDemoSnapshot(() => localStorage, KEY, persistedOf(state, { electives: null }));
      dispatch({ type: "electives", shortlist: null });
    },
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
      const snapshot = persistedOf(state, result.plan);
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
    addPersonalEvent: (ev) => {
      if (!state.hydrated) return { ok: false, error: "Demo is still loading. Please try again." };
      if (!isMyIso(ev.start) || !isMyIso(ev.end) || ev.end <= ev.start || !ev.title.trim()) return { ok: false, error: "Add a title, a date and a time first." };
      if (state.personalEvents.some((p) => p.id === ev.id)) return { ok: false, error: "This event is already in your plans." };
      if (state.personalEvents.length >= 30) return { ok: false, error: "Your plans are full. Remove one from Home first." };
      const before = { studySessions: state.studySessions, reminders: state.reminders, personalEvents: state.personalEvents };
      const plan = { ...before, personalEvents: [...state.personalEvents, { ...ev, title: ev.title.trim().slice(0, 120), place: ev.place?.slice(0, 60) }] };
      if (!persistDemoSnapshot(() => localStorage, KEY, persistedOf(state, plan))) return { ok: false, error: "Unable to save in this browser. Check that site storage is enabled, then try again." };
      const applyId = ++applySeq.current;
      const summary = `Added ${ev.title.trim()} to your plans`;
      dispatch({ type: "plan", plan, lastApply: { id: applyId, before, ackIds: [], summary } });
      showToast(summary, () => { undoApply(applyId); });
      return { ok: true };
    },
    openAgent: (seed) => dispatch({ type: "agent", open: true, seed }),
    closeAgent: () => dispatch({ type: "agent", open: false }),
    showToast,
    resetDemo: () => {
      try { localStorage.removeItem(KEY); localStorage.removeItem("compass:time-alerts-seen:v1"); window.dispatchEvent(new Event("compass:time-alerts-seen")); } catch {}
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
