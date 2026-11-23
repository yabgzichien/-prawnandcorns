import { cleanEventIds } from "./world.ts";

/**
 * Browser-side scenario storage. The triggered event list is the only thing the demo world
 * keeps. The console window and the Compass window share it through local storage.
 * The `storage` event only fires in OTHER tabs, so every write also dispatches a
 * same-window event. Both are wrapped by `subscribeScenario`.
 */

export const SCENARIO_KEY = "compass:scenario-events:v1";
export const CUSTOM_MAIL_KEY = "compass:custom-mail:v1";
export const SCENARIO_CHANGED = "compass:scenario-changed";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): StorageLike | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

function readList(storage: StorageLike | null, key: string): unknown[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function announce() {
  try { if (typeof window !== "undefined") window.dispatchEvent(new Event(SCENARIO_CHANGED)); } catch {}
}

export function getTriggeredEvents(storage: StorageLike | null = store()): string[] {
  return cleanEventIds(readList(storage, SCENARIO_KEY));
}

/** Adds an event once. Returns false when storage is unavailable. */
export function triggerEvent(id: string, storage: StorageLike | null = store()): boolean {
  if (!storage) return false;
  const current = getTriggeredEvents(storage);
  const next = cleanEventIds([...current, id]);
  if (next.length === current.length) return true; // unknown or already triggered
  try { storage.setItem(SCENARIO_KEY, JSON.stringify(next)); } catch { return false; }
  announce();
  return true;
}

export function resetScenario(storage: StorageLike | null = store()): void {
  if (!storage) return;
  try { storage.removeItem(SCENARIO_KEY); storage.removeItem(CUSTOM_MAIL_KEY); } catch {}
  announce();
}

/** A custom email typed into the console. Stored only in this browser, always untrusted. */
export type CustomNotice = { id: string; from: string; subject: string; body: string; date: string };
export const CUSTOM_LIMITS = { from: 80, subject: 120, body: 1500, count: 5 } as const;

export function sanitizeCustomNotices(raw: unknown): CustomNotice[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomNotice[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== "string" || !/^custom-[a-z0-9-]{1,40}$/.test(e.id) || seen.has(e.id)) continue;
    if (typeof e.from !== "string" || typeof e.subject !== "string" || typeof e.body !== "string" || typeof e.date !== "string") continue;
    if (!Number.isFinite(Date.parse(e.date))) continue;
    seen.add(e.id);
    out.push({
      id: e.id,
      from: e.from.slice(0, CUSTOM_LIMITS.from),
      subject: e.subject.slice(0, CUSTOM_LIMITS.subject),
      body: e.body.slice(0, CUSTOM_LIMITS.body),
      date: e.date,
    });
    if (out.length >= CUSTOM_LIMITS.count) break;
  }
  return out;
}

export function getCustomNotices(storage: StorageLike | null = store()): CustomNotice[] {
  return sanitizeCustomNotices(readList(storage, CUSTOM_MAIL_KEY));
}

export function addCustomNotice(input: { from: string; subject: string; body: string }, storage: StorageLike | null = store()): CustomNotice | null {
  if (!storage) return null;
  const from = input.from.trim().slice(0, CUSTOM_LIMITS.from) || "Custom sender";
  const subject = input.subject.trim().slice(0, CUSTOM_LIMITS.subject) || "(no subject)";
  const body = input.body.trim().slice(0, CUSTOM_LIMITS.body);
  if (!body) return null;
  const existing = getCustomNotices(storage);
  const notice: CustomNotice = { id: `custom-${existing.length + 1}-${Date.now().toString(36)}`, from, subject, body, date: "2026-11-23T13:45:00+08:00" };
  const next = [...existing, notice].slice(-CUSTOM_LIMITS.count);
  try { storage.setItem(CUSTOM_MAIL_KEY, JSON.stringify(next)); } catch { return null; }
  announce();
  return notice;
}

/** Calls `fn` when either this window or another window changes the scenario. */
export function subscribeScenario(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === SCENARIO_KEY || e.key === CUSTOM_MAIL_KEY) fn(); };
  window.addEventListener(SCENARIO_CHANGED, fn);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(SCENARIO_CHANGED, fn); window.removeEventListener("storage", onStorage); };
}
