import { SCENARIO_CHANGED } from "../world/storage.ts";
import { MAX_OPTIONS, NOTE_MAX, REASONS, REPLACEMENTS_KEY, REPLACEMENT_ANSWERS_KEY, REPLACEMENT_SEEN_KEY, type ReplacementAnswers, type ReplacementRequest, type SlotOption } from "./types.ts";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const store = (): StorageLike | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };
const announce = () => { try { if (typeof window !== "undefined") window.dispatchEvent(new Event(SCENARIO_CHANGED)); } catch {} };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number, re?: RegExp): v is string => typeof v === "string" && v.length > 0 && v.length <= max && (!re || re.test(v));

export function sanitizeOption(raw: unknown): SlotOption | null {
  if (!isObj(raw)) return null;
  const { id, day, start, end, room } = raw;
  if (!Number.isInteger(day) || (day as number) < 0 || (day as number) > 6) return null;
  if (!str(start, 5, HHMM) || !str(end, 5, HHMM) || start >= end) return null;
  if (!str(room, 12, /^[A-Z0-9-]+$/) || !str(id, 40)) return null;
  return { id, day: day as number, start, end, room };
}

export function sanitizeRequests(raw: unknown): ReplacementRequest[] {
  if (!Array.isArray(raw)) return [];
  const out: ReplacementRequest[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!isObj(r)) continue;
    if (!str(r.id, 20, /^DEMO-RPL-\d{4}$/) || seen.has(r.id)) continue;
    if (!str(r.stamp, 40) || !str(r.courseId, 20, /^[a-z0-9]+$/) || !str(r.sessionId, 20, /^[a-z0-9-]+$/)) continue;
    if (!REASONS.includes(r.reason as never) || (r.status !== "asking" && r.status !== "scheduled")) continue;
    if (typeof r.updatedAt !== "string" || !Number.isFinite(Date.parse(r.updatedAt))) continue;
    const options = Array.isArray(r.options) ? r.options.map(sanitizeOption).filter((o): o is SlotOption => !!o).slice(0, MAX_OPTIONS) : [];
    const chosen = sanitizeOption(r.chosen) ?? undefined;
    if (r.status === "scheduled" && !chosen) continue;
    if (r.status === "asking" && options.length === 0) continue;
    seen.add(r.id);
    out.push({
      id: r.id, stamp: r.stamp, courseId: r.courseId, sessionId: r.sessionId, reason: r.reason as ReplacementRequest["reason"],
      note: typeof r.note === "string" ? r.note.slice(0, NOTE_MAX) : "", status: r.status, options, ...(chosen ? { chosen } : {}), updatedAt: r.updatedAt,
    });
    if (out.length >= 10) break;
  }
  return out;
}

export function sanitizeAnswers(raw: unknown): ReplacementAnswers {
  if (!isObj(raw)) return {};
  const out: ReplacementAnswers = {};
  for (const [id, a] of Object.entries(raw).slice(0, 10)) {
    if (!/^DEMO-RPL-\d{4}$/.test(id) || !isObj(a) || !str(a.stamp, 40) || !isObj(a.works) || typeof a.at !== "string") continue;
    const works: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(a.works).slice(0, MAX_OPTIONS)) if (k.length <= 40 && typeof v === "boolean") works[k] = v;
    out[id] = { stamp: a.stamp, works, at: a.at };
  }
  return out;
}

export const parseRequests = (text: string): ReplacementRequest[] => { try { return sanitizeRequests(JSON.parse(text)); } catch { return []; } };
export const parseAnswers = (text: string): ReplacementAnswers => { try { return sanitizeAnswers(JSON.parse(text)); } catch { return {}; } };

export function readRequests(storage: StorageLike | null = store()): ReplacementRequest[] {
  if (!storage) return [];
  try { return parseRequests(storage.getItem(REPLACEMENTS_KEY) ?? "[]"); } catch { return []; }
}

/** Only the console window (the lecturer desk) calls this. Returns false when the browser would not save it. */
export function writeRequests(next: ReplacementRequest[], storage: StorageLike | null = store()): boolean {
  if (!storage) return false;
  try { storage.setItem(REPLACEMENTS_KEY, JSON.stringify(sanitizeRequests(next))); } catch { return false; }
  announce();
  return true;
}

/** Only Compass calls this: the student's answer for one round of asking. */
export function writeAnswer(request: ReplacementRequest, works: Record<string, boolean>, at: string, storage: StorageLike | null = store()): boolean {
  if (!storage) return false;
  let current: ReplacementAnswers = {};
  try { current = parseAnswers(storage.getItem(REPLACEMENT_ANSWERS_KEY) ?? "{}"); } catch {}
  const next = sanitizeAnswers({ ...current, [request.id]: { stamp: request.stamp, works, at } });
  try { storage.setItem(REPLACEMENT_ANSWERS_KEY, JSON.stringify(next)); } catch { return false; }
  announce();
  return true;
}

/** "Told once" marks, one per request and stamp. Compass writes them. */
export const seenStamp = (r: ReplacementRequest) => `${r.status}:${r.stamp}`;
export function parseSeen(text: string): Record<string, string> {
  try {
    const v: unknown = JSON.parse(text);
    if (!isObj(v)) return {};
    return Object.fromEntries(Object.entries(v).filter(([k, s]) => /^DEMO-RPL-\d{4}$/.test(k) && typeof s === "string" && s.length <= 60).slice(0, 20)) as Record<string, string>;
  } catch { return {}; }
}
export function markSeen(requests: readonly ReplacementRequest[], storage: StorageLike | null = store()): void {
  if (!storage) return;
  try {
    const next = { ...parseSeen(storage.getItem(REPLACEMENT_SEEN_KEY) ?? "{}") };
    for (const r of requests) next[r.id] = seenStamp(r);
    storage.setItem(REPLACEMENT_SEEN_KEY, JSON.stringify(next));
  } catch { return; }
  announce();
}

/** The next readable id, never reusing one that is saved. */
export function nextRequestId(existing: readonly ReplacementRequest[]): string {
  const max = existing.reduce((m, r) => Math.max(m, Number(r.id.slice(-4))), 0);
  return `DEMO-RPL-${String(max + 1).padStart(4, "0")}`;
}
