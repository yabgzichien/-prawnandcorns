import { ASSIGNMENTS, CLASSES, COURSES, NOTICES } from "../data/academics.ts";
import { BASE_FEES, FEE_CURRENCY, FEE_TOTAL } from "../data/finance.ts";
import { BASE_INBOX } from "../data/inbox.ts";
import { EVENT_BY_ID } from "./events.ts";
import type { Effect, ScenarioEvent, World, WorldNotice } from "./types.ts";

/** Notices n1 and n2 are course announcements (Moodle). n3 comes from the Academic Centre. */
const BASE_ANNOUNCEMENTS: WorldNotice[] = NOTICES.map((notice) => ({ ...notice, system: notice.id === "n3" ? "ac" : "moodle" }));

export function baseWorld(): World {
  return structuredClone<World>({
    courses: COURSES,
    classes: CLASSES,
    assignments: ASSIGNMENTS,
    currency: FEE_CURRENCY,
    feeTotal: FEE_TOTAL,
    fees: BASE_FEES,
    announcements: BASE_ANNOUNCEMENTS,
    inbox: BASE_INBOX,
    library: { blocks: [] },
    outage: {},
    applied: [],
  });
}

function applyEffect(world: World, effect: Effect, eventId: string): void {
  switch (effect.op) {
    case "moveClass": {
      const item = world.classes.find((c) => c.id === effect.classId);
      if (item && item.room !== effect.room) {
        item.originalRoom = item.originalRoom ?? item.room;
        item.room = effect.room;
        item.status = "room-changed";
      }
      return;
    }
    case "cancelClass": {
      const item = world.classes.find((c) => c.id === effect.classId);
      if (item) item.status = "cancelled";
      return;
    }
    case "addClass": {
      if (!world.classes.some((c) => c.id === effect.session.id)) world.classes.push(structuredClone(effect.session));
      return;
    }
    case "setDue": {
      const item = world.assignments.find((a) => a.id === effect.assignmentId);
      if (item) item.due = effect.due;
      return;
    }
    case "addAssignment": {
      if (!world.assignments.some((a) => a.id === effect.assignment.id)) world.assignments.push(structuredClone(effect.assignment));
      return;
    }
    case "postFee": {
      const fee = world.fees.find((f) => f.id === effect.feeId);
      if (fee) fee.posted = true;
      return;
    }
    case "addAnnouncement": {
      if (!world.announcements.some((n) => n.id === effect.notice.id)) world.announcements.push(structuredClone(effect.notice));
      return;
    }
    case "addEmail": {
      if (!world.inbox.some((m) => m.id === effect.message.id)) world.inbox.push(structuredClone(effect.message));
      return;
    }
    case "outage": {
      world.outage[effect.system] = eventId;
      return;
    }
    case "libraryBlock": {
      world.library.blocks.push(structuredClone(effect.block));
      return;
    }
  }
}

/** Returns a new world. The world passed in is never edited. */
export function applyEvent(world: World, event: ScenarioEvent): World {
  const next = structuredClone<World>(world);
  for (const effect of event.effects) applyEffect(next, effect, event.id);
  next.applied.push(event.id);
  return next;
}

/** Hard cap so a hostile header cannot make the server do unbounded work. */
export const MAX_EVENTS = 24;

/** Drops unknown ids and repeats, keeping the order events were triggered in. */
export function cleanEventIds(ids: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || seen.has(id) || !Object.hasOwn(EVENT_BY_ID, id)) continue;
    seen.add(id);
    clean.push(id);
    if (clean.length >= MAX_EVENTS) break;
  }
  return clean;
}

/** The same ids always give the same world. Unknown ids are ignored, never trusted. */
export function buildWorld(eventIds: readonly unknown[] = []): World {
  let world = baseWorld();
  for (const id of cleanEventIds(eventIds)) world = applyEvent(world, EVENT_BY_ID[id]);
  return world;
}
