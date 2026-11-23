import { SYSTEM_IDS, type SystemId } from "../world/types.ts";
import type { CampusItem } from "../connectors/types.ts";
import { EMPTY_SYNC, type Change, type Snapshot, type SyncFailure, type SyncState } from "./types.ts";

export const SYNC_KEY = "compass:sync:v1";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KINDS = new Set(["class", "deadline", "fee", "notice", "event"]);
const isSystem = (v: unknown): v is SystemId => typeof v === "string" && (SYSTEM_IDS as readonly string[]).includes(v);
const isItem = (v: unknown): v is CampusItem => !!v && typeof v === "object" && typeof (v as CampusItem).id === "string" && KINDS.has((v as CampusItem).kind) && isSystem((v as CampusItem).source);
const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 40) : [];

function sanitizeChange(v: unknown): Change | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Change;
  if (typeof c.id !== "string" || !isSystem(c.system) || !isItem(c.item) || !["added", "removed", "changed"].includes(c.type)) return null;
  return { ...c, since: strings(c.since), now: strings(c.now) };
}

/** Local storage can be edited by anyone, so anything malformed is dropped instead of trusted. */
export function sanitizeSyncState(raw: unknown): SyncState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_SYNC;
  const r = raw as Record<string, unknown>;
  let snapshot: Snapshot | null = null;
  const s = r.snapshot as Snapshot | null | undefined;
  if (s && typeof s === "object" && Array.isArray(s.items) && s.asOf && typeof s.asOf === "object") {
    const asOf: Snapshot["asOf"] = {};
    for (const system of SYSTEM_IDS) if (Array.isArray(s.asOf[system])) asOf[system] = strings(s.asOf[system]);
    snapshot = { takenAt: typeof s.takenAt === "string" ? s.takenAt : "", asOf, fetchedAt: typeof s.fetchedAt === "object" && s.fetchedAt ? s.fetchedAt : {}, items: s.items.filter(isItem).slice(0, 500), account: s.account };
  }
  const pending = Array.isArray(r.pending) ? r.pending.map(sanitizeChange).filter((c): c is Change => c !== null).slice(0, 100) : [];
  const failed = Array.isArray(r.failed) ? (r.failed as SyncFailure[]).filter((f) => f && isSystem(f.system) && f.error && typeof f.error.message === "string").slice(0, 4) : [];
  return { snapshot, pending, failed, lastSyncAt: typeof r.lastSyncAt === "string" ? r.lastSyncAt : undefined, outageSeen: strings(r.outageSeen) };
}

function store(): StorageLike | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

export function loadSyncState(storage: StorageLike | null = store()): SyncState {
  if (!storage) return EMPTY_SYNC;
  try { return sanitizeSyncState(JSON.parse(storage.getItem(SYNC_KEY) ?? "null")); } catch { return EMPTY_SYNC; }
}

export function saveSyncState(state: SyncState, storage: StorageLike | null = store()): boolean {
  if (!storage) return false;
  try { storage.setItem(SYNC_KEY, JSON.stringify(state)); return true; } catch { return false; }
}

export function clearSyncState(storage: StorageLike | null = store()): void {
  try { storage?.removeItem(SYNC_KEY); } catch {}
}
