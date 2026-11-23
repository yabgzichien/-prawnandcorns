import { SYSTEM_IDS, type SystemId } from "../world/types.ts";
import type { CampusItem } from "../connectors/types.ts";
import type { Change, FieldChange, Snapshot } from "./types.ts";

/** Plain code, not AI. Detecting that a date changed does not need a model, and code never gets it wrong. */

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The fields worth telling the student about. Notices and events never change after they appear. */
export function watchedFields(item: CampusItem): Record<string, string> {
  switch (item.kind) {
    case "class": return { day: DAYS[item.day] ?? String(item.day), start: item.start, end: item.end, room: item.room, status: item.status };
    case "deadline": return { title: item.title, due: item.due, submission: item.submission };
    case "fee": return { amount: String(item.amount), due: item.due, status: item.status };
    default: return {};
  }
}

function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function changeId(type: Change["type"], itemId: string, fields: FieldChange[] = []): string {
  if (type !== "changed") return `${type}:${itemId}`;
  return `changed:${itemId}:${fnv(fields.map((f) => `${f.field}:${f.from}>${f.to}`).join("|"))}`;
}

function byId(items: readonly CampusItem[], system: SystemId): Map<string, CampusItem> {
  return new Map(items.filter((i) => i.source === system).map((i) => [i.id, i]));
}

export function diffSystem(system: SystemId, before: readonly CampusItem[], after: readonly CampusItem[], since: string[], now: string[]): Change[] {
  const prev = byId(before, system);
  const next = byId(after, system);
  const changes: Change[] = [];
  const make = (type: Change["type"], item: CampusItem, extra: Partial<Change> = {}): Change => ({
    id: changeId(type, item.id, extra.fields), type, system, itemId: item.id, itemKind: item.kind, item, since, now, ...extra,
  });
  for (const [id, item] of next) {
    const old = prev.get(id);
    if (!old) { changes.push(make("added", item)); continue; }
    const a = watchedFields(old);
    const b = watchedFields(item);
    const fields: FieldChange[] = Object.keys(b).filter((k) => a[k] !== b[k]).map((k) => ({ field: k, from: a[k] ?? "", to: b[k] }));
    if (fields.length) changes.push(make("changed", item, { before: old, fields }));
  }
  for (const [id, item] of prev) if (!next.has(id)) changes.push(make("removed", item));
  return changes;
}

/**
 * Compares the last snapshot with the new one, item by item, using stable ids.
 * A system is compared only when both snapshots hold data for it, so connecting a new
 * system later does not flood the student with "added" items.
 */
export function diffSnapshots(previous: Snapshot | null, current: Snapshot): Change[] {
  if (!previous) return [];
  const changes: Change[] = [];
  for (const system of SYSTEM_IDS) {
    const since = previous.asOf[system];
    const now = current.asOf[system];
    if (!since || !now) continue;
    changes.push(...diffSystem(system, previous.items, current.items, since, now));
  }
  return changes;
}

/**
 * Adds new changes to the ones still waiting for review.
 * When an item changes twice before the student reviews, the two are folded into one
 * (old value to newest value), so the student never sees "A to B" and "B to C".
 */
export function mergePending(pending: readonly Change[], fresh: readonly Change[]): Change[] {
  const result = [...pending];
  for (const change of fresh) {
    if (change.type === "changed") {
      const index = result.findIndex((p) => p.type === "changed" && p.itemId === change.itemId);
      if (index >= 0) {
        const older = result[index];
        const first = new Map((older.fields ?? []).map((f) => [f.field, f.from]));
        const fields: FieldChange[] = [];
        const touched = new Set<string>();
        for (const f of change.fields ?? []) {
          const from = first.get(f.field) ?? f.from;
          touched.add(f.field);
          if (from !== f.to) fields.push({ field: f.field, from, to: f.to });
        }
        for (const f of older.fields ?? []) if (!touched.has(f.field)) fields.push(f);
        result.splice(index, 1);
        if (fields.length) result.push({ ...change, before: older.before, fields, since: older.since, id: changeId("changed", change.itemId, fields) });
        continue;
      }
    }
    if (change.type === "removed") {
      const index = result.findIndex((p) => p.type === "added" && p.itemId === change.itemId);
      if (index >= 0) { result.splice(index, 1); continue; } // appeared and vanished before review
    }
    if (!result.some((p) => p.id === change.id)) result.push(change);
  }
  return result;
}
