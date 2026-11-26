import { SCENARIO_CHANGED } from "../world/storage.ts";
import { DECISIONS_KEY } from "./types.ts";
import type { Decisions } from "./types.ts";
import { parseDecisions } from "./decisions.ts";
import { SEEDED_DECISIONS } from "./seed.ts";

/** What the desk has said, with the invented answers to the other clubs' older applications underneath. */
export const withSeeded = (stored: Decisions): Decisions => ({ ...SEEDED_DECISIONS, ...stored });

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const store = (): StorageLike | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };

export function readStoredDecisions(storage: StorageLike | null = store()): Decisions {
  if (!storage) return {};
  try { return parseDecisions(storage.getItem(DECISIONS_KEY) ?? "{}"); } catch { return {}; }
}

/** Only the console window calls this. Returns false when the browser would not save it. */
export function writeStoredDecisions(next: Decisions, storage: StorageLike | null = store()): boolean {
  if (!storage) return false;
  try { storage.setItem(DECISIONS_KEY, JSON.stringify(next)); } catch { return false; }
  try { if (typeof window !== "undefined") window.dispatchEvent(new Event(SCENARIO_CHANGED)); } catch {}
  return true;
}
