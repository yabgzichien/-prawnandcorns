import type { BusyBlock } from "../planning.ts";
import { slotWindow } from "./policy.ts";

/** The first of the student's own commitments that a slot would overlap, or null. A warning, not a rule. */
export function overlapWith(date: string, slot: number, busy: readonly BusyBlock[]): BusyBlock | null {
  const w = slotWindow(date, slot);
  const start = Date.parse(w.start);
  const end = Date.parse(w.end);
  return busy.find((b) => Date.parse(b.start) < end && start < Date.parse(b.end)) ?? null;
}
