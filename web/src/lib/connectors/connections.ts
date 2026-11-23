import type { SystemId } from "../world/types.ts";
import { SYSTEM_IDS } from "../world/types.ts";

/** Fake sign-in state. No password field ever exists. The "token" is a random label that unlocks nothing real. */
export const CONNECTIONS_KEY = "compass:connections:v1";

export type Connection = { token: string; connectedAt: string };
export type Connections = Partial<Record<SystemId, Connection>>;
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): StorageLike | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

export function sanitizeConnections(raw: unknown): Connections {
  const out: Connections = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const system of SYSTEM_IDS) {
    const entry = (raw as Record<string, unknown>)[system];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.token === "string" && /^demo-[a-z0-9-]{4,60}$/.test(e.token) && typeof e.connectedAt === "string") out[system] = { token: e.token, connectedAt: e.connectedAt };
  }
  return out;
}

export function getConnections(storage: StorageLike | null = store()): Connections {
  if (!storage) return {};
  try { return sanitizeConnections(JSON.parse(storage.getItem(CONNECTIONS_KEY) ?? "{}")); } catch { return {}; }
}

function write(storage: StorageLike, next: Connections): boolean {
  try {
    if (Object.keys(next).length === 0) storage.removeItem(CONNECTIONS_KEY);
    else storage.setItem(CONNECTIONS_KEY, JSON.stringify(next));
    return true;
  } catch { return false; }
}

const makeToken = (): string => {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14);
  return `demo-${random.toLowerCase().replace(/[^a-z0-9-]/g, "0")}`;
};

/** Called after the student presses Allow on the consent screen. */
export function connectSystem(system: SystemId, now: string, storage: StorageLike | null = store()): Connections | null {
  if (!storage) return null;
  const next = { ...getConnections(storage), [system]: { token: makeToken(), connectedAt: now } };
  return write(storage, next) ? next : null;
}

export function disconnectSystem(system: SystemId, storage: StorageLike | null = store()): Connections {
  const next = { ...getConnections(storage) };
  delete next[system];
  if (storage) write(storage, next);
  return next;
}
