import { STUDENT } from "./data/academics.ts";

/**
 * AskA is the university's online help desk. Hostel faults such as a leaking pipe or a broken air-conditioner
 * are reported there as a ticket, not by email to the Accommodation Office. This module recognises those
 * problems and prepares the ticket text. It never submits anything: the student reviews and submits it.
 */

export type DormIssueKind = "aircon" | "leak" | "electrical" | "furniture" | "pests";

export const DORM_KIND_LABEL: Record<DormIssueKind, string> = {
  aircon: "Air-conditioner",
  leak: "Water leak or plumbing",
  electrical: "Electrical and lighting",
  furniture: "Furniture and fittings",
  pests: "Pests and cleanliness",
};
export const DORM_KINDS = Object.keys(DORM_KIND_LABEL) as DormIssueKind[];

const NOT_DORM = /\b(laptop|phone|charger|computer|printer|wi-?fi|internet|moodle|password|login|vpn|email|e-mail)\b/;
const PROBLEM = /(not working|doesn'?t work|does not work|won'?t|wont|broken|broke|faulty|damaged|stuck|jammed|loose|noisy|loud|smell|hot|not (?:very )?(?:cold|cool(?:ing)?)|blocked|clogged|dripping|leak|flood|burst|overflow|flicker|spark|dead|out of order|no power|no water|fell|missing|infest|crawling)/;

const AIRCON = /\b(air[- ]?con(?:ditioner|ditioning)?|a\/c|ac)\b/;
const LEAK = /\b(leak(?:s|ing|ed)?|drip(?:s|ping)?|flood(?:ed|ing)?|burst|overflow(?:ing)?|clogged?|blocked|no (?:hot )?water|water (?:is )?(?:coming|dripping|leaking|everywhere|on the floor))\b|\b(toilet|sink|shower|tap|pipe|drain|flush)\b/;
const ELECTRICAL = /\b(light|lights|lamp|bulb|socket|plug|switch|fan|power|electric(?:ity|al)?|fuse|tripped)\b/;
const FURNITURE = /\b(bed|mattress|wardrobe|cupboard|desk|chair|door|lock|window|curtain|shelf|drawer|key|handle)\b/;
const PESTS = /\b(cockroach(?:es)?|ants?|rats?|mice|mouse|bed ?bugs?|lizards?|mosquito(?:es)?|mould|mold|termites?)\b/;
const URGENT = /\b(flood(?:ed|ing)?|burst|gushing|spark(?:s|ing)?|smoke|burning|shock|short[- ]?circuit|no power|power (?:cut|out)|water (?:everywhere|on the floor|near (?:the )?(?:socket|plug|switch|outlet)))\b/;

export type DormIssue = { kind: DormIssueKind; urgent: boolean };

/** What kind of hostel fault a message describes, or null when it is not one. Air-conditioner wins over leak when both appear. */
export function detectDormIssue(text: string): DormIssue | null {
  const t = text.toLowerCase();
  if (NOT_DORM.test(t)) return null;
  const urgent = URGENT.test(t);
  if (PESTS.test(t)) return { kind: "pests", urgent };
  if (AIRCON.test(t) && PROBLEM.test(t)) return { kind: "aircon", urgent };
  if (LEAK.test(t) && PROBLEM.test(t)) return { kind: "leak", urgent };
  if (ELECTRICAL.test(t) && PROBLEM.test(t)) return { kind: "electrical", urgent };
  if (FURNITURE.test(t) && PROBLEM.test(t)) return { kind: "furniture", urgent };
  return null;
}

/** "D3-512", "LY2 1203", "block D3 room 512". */
export function parseLocation(text: string): { block: string; room: string } | null {
  const a = text.match(/\b(D[1-5]|LY[1-9])\b\s*[-,]?\s*(?:room\s*|rm\.?\s*|#)?(\d{2,4}[A-Za-z]?)\b/i);
  if (a) return { block: a[1].toUpperCase(), room: a[2].toUpperCase() };
  const b = text.match(/\b(?:block|residence)\s*(D[1-5]|LY[1-9])\b[\s\S]{0,24}?\b(?:room|rm)\.?\s*(?:is|number|no\.?)?\s*#?(\d{2,4}[A-Za-z]?)\b/i);
  return b ? { block: b[1].toUpperCase(), room: b[2].toUpperCase() } : null;
}

export type AskaDraft = {
  kind: DormIssueKind;
  /** Category path on the help desk, for example "Accommodation > Maintenance > Air-conditioner". */
  path: string;
  urgent: boolean;
  block: string;
  room: string;
  title: string;
  description: string;
};

const sentence = (s: string) => { const t = s.trim().replace(/[.\s]+$/, ""); return t ? t.charAt(0).toUpperCase() + t.slice(1) + "." : ""; };

export function draftTicket(problem: string, override: Partial<Pick<AskaDraft, "kind" | "urgent" | "block" | "room">> = {}): AskaDraft | null {
  const issue = detectDormIssue(problem);
  const kind = override.kind ?? issue?.kind;
  if (!kind) return null;
  const loc = parseLocation(problem);
  const block = override.block ?? loc?.block ?? "";
  const room = override.room ?? loc?.room ?? "";
  const urgent = override.urgent ?? issue?.urgent ?? false;
  const where = block && room ? `${block}-${room}` : "[block and room number]";
  const label = DORM_KIND_LABEL[kind];
  const summary = problem.trim().replace(/\s+/g, " ").slice(0, 80).replace(/[.!?\s]+$/, "");
  return {
    kind, urgent, block, room,
    path: `Accommodation > Maintenance > ${label}`,
    title: `${label}: ${summary.charAt(0).toLowerCase() + summary.slice(1)}`.slice(0, 100),
    description: [
      `Hello, I am ${STUDENT.name} (${STUDENT.id}), staying in ${where}.`,
      sentence(problem),
      urgent ? "This is urgent because it may be unsafe." : "",
      "Could a technician please look at it? I can let them in during the day, and I am happy to share my class timetable so the visit does not clash.",
      "Thank you.",
    ].filter(Boolean).join(" "),
  };
}

export type AskaStatus = "Submitted" | "In progress" | "Technician scheduled" | "Resolved";
export const ASKA_STATUSES: readonly AskaStatus[] = ["Submitted", "In progress", "Technician scheduled", "Resolved"];

/** A ticket the student has submitted. Kept in this browser only. */
export type AskaTicket = AskaDraft & { id: string; submittedAt: string };

/** What the help desk has done with a ticket. Only the console window writes these. */
export type AskaUpdate = { status: AskaStatus; note?: string; visit?: { start: string; end: string } };
export type AskaUpdates = Record<string, AskaUpdate>;

export const ASKA_UPDATES_KEY = "compass:aska-updates:v1";
/** Which ticket statuses the student has already been told about. Compass writes it. */
export const ASKA_SEEN_KEY = "compass:aska-seen:v1";

const MY_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/;
const str = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max;

export function sanitizeTickets(raw: unknown): AskaTicket[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AskaTicket[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const t = e as Partial<AskaTicket>;
    if (!str(t.id, 16) || !/^T-\d{4,6}$/.test(t.id as string) || seen.has(t.id as string)) continue;
    if (!DORM_KINDS.includes(t.kind as DormIssueKind) || !str(t.title, 100) || !str(t.description, 900) || !str(t.path, 120)) continue;
    if (typeof t.submittedAt !== "string" || !MY_ISO.test(t.submittedAt)) continue;
    seen.add(t.id as string);
    out.push({
      id: t.id as string, kind: t.kind as DormIssueKind, urgent: t.urgent === true, path: t.path as string, title: t.title as string, description: t.description as string,
      block: typeof t.block === "string" ? t.block.slice(0, 4) : "", room: typeof t.room === "string" ? t.room.slice(0, 6) : "", submittedAt: t.submittedAt,
    });
  }
  return out.slice(0, 10);
}

export function sanitizeUpdates(raw: unknown): AskaUpdates {
  const out: AskaUpdates = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>).slice(0, 10)) {
    if (!/^T-\d{4,6}$/.test(id) || !v || typeof v !== "object") continue;
    const u = v as Partial<AskaUpdate>;
    if (!ASKA_STATUSES.includes(u.status as AskaStatus)) continue;
    const visit = u.visit && MY_ISO.test(u.visit.start) && MY_ISO.test(u.visit.end) ? { start: u.visit.start, end: u.visit.end } : undefined;
    out[id] = { status: u.status as AskaStatus, ...(typeof u.note === "string" && u.note.length <= 200 ? { note: u.note } : {}), ...(visit ? { visit } : {}) };
  }
  return out;
}

/** The next ticket number, from how many are already saved. */
export const nextTicketId = (existing: readonly AskaTicket[]) => `T-${1041 + existing.length}`;
