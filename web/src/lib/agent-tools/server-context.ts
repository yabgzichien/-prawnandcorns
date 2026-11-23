import { COURSES } from "../data/academics.ts";
import { normalizeAc, normalizeFinance, normalizeMail, normalizeMoodle } from "../connectors/normalize.ts";
import type { AccountSummary, CampusItem, NoticeItem } from "../connectors/types.ts";
import type { StudySession } from "../planning.ts";
import { diffSystem } from "../sync/diff.ts";
import type { Change } from "../sync/types.ts";
import { campusDataFrom } from "../sync/view.ts";
import { DEMO_NOW } from "../time.ts";
import { isMyIso, type PersonalEvent, type PlanState, type Reminder } from "../updates/types.ts";
import { acNotices, acTimetable, financeAccount, financeInstalments, mailList, moodleActionEvents, moodleAnnouncements, moodleAssignments, moodleCourses } from "../world/payloads.ts";
import { sanitizeCustomNotices, type CustomNotice } from "../world/storage.ts";
import { SYSTEM_IDS, SYSTEM_LABEL, type SystemId, type World } from "../world/types.ts";
import { buildWorld, cleanEventIds } from "../world/world.ts";
import type { CampusToolContext } from "./campus.ts";

/**
 * The server never trusts what the browser says the campus looks like. The browser sends only ids:
 * which scenario events each system had seen, and which changes are waiting. The server rebuilds the
 * same worlds itself and looks every change up. Anything it cannot reproduce is dropped.
 */

const courseIdByCode = new Map(COURSES.map((c) => [c.code, c.id]));

export type ChangeRef = { id: string; system: SystemId; since: string[]; now: string[] };
export type CampusRequest = {
  asOf: Partial<Record<SystemId, string[]>>;
  changes: ChangeRef[];
  failed: SystemId[];
  /** The one thing the browser may send as text: emails typed into the console. Capped, and always untrusted. */
  custom: CustomNotice[];
};

export const EMPTY_CAMPUS_REQUEST: CampusRequest = { asOf: {}, changes: [], failed: [], custom: [] };
const isSystem = (v: unknown): v is SystemId => typeof v === "string" && (SYSTEM_IDS as readonly string[]).includes(v);

export function sanitizeCampusRequest(raw: unknown): CampusRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_CAMPUS_REQUEST;
  const r = raw as Record<string, unknown>;
  const asOf: CampusRequest["asOf"] = {};
  if (r.asOf && typeof r.asOf === "object") for (const s of SYSTEM_IDS) { const v = (r.asOf as Record<string, unknown>)[s]; if (Array.isArray(v)) asOf[s] = cleanEventIds(v); }
  const changes: ChangeRef[] = [];
  if (Array.isArray(r.changes)) {
    for (const c of r.changes.slice(0, 60)) {
      if (!c || typeof c !== "object") continue;
      const e = c as Record<string, unknown>;
      if (typeof e.id !== "string" || e.id.length > 200 || !isSystem(e.system) || !Array.isArray(e.since) || !Array.isArray(e.now)) continue;
      changes.push({ id: e.id, system: e.system, since: cleanEventIds(e.since), now: cleanEventIds(e.now) });
    }
  }
  const failed = Array.isArray(r.failed) ? [...new Set(r.failed.filter(isSystem))] : [];
  return { asOf, changes, failed, custom: sanitizeCustomNotices(r.custom) };
}

export function itemsForSystem(system: SystemId, world: World): { items: CampusItem[]; account?: AccountSummary } {
  switch (system) {
    case "moodle": return { items: normalizeMoodle({ courses: moodleCourses(world), assignments: moodleAssignments(world), events: moodleActionEvents(world), news: moodleAnnouncements(world) }) };
    case "ac": return { items: normalizeAc({ timetable: acTimetable(world), notices: acNotices(world) }, courseIdByCode) };
    case "finance": return normalizeFinance({ account: financeAccount(world), instalments: financeInstalments(world) });
    case "mail": return { items: normalizeMail({ list: mailList(world), bodies: new Map(world.inbox.map((m) => [m.id, m.body])) }) };
  }
}

const customItem = (c: CustomNotice): NoticeItem => ({ id: `mail:notice:${c.id}`, source: "mail", kind: "notice", sender: c.from, subject: c.subject, date: c.date, text: c.body, custom: true });

/** Looks each claimed change up by rebuilding the worlds it says it came from. Unknown ids are dropped. */
export function verifyChanges(refs: readonly ChangeRef[], custom: readonly CustomNotice[]): Change[] {
  const cache = new Map<string, Change[]>();
  const out: Change[] = [];
  for (const ref of refs) {
    if (ref.system === "mail" && ref.id.startsWith("added:mail:notice:custom-")) {
      const note = custom.find((c) => `added:mail:notice:${c.id}` === ref.id);
      if (note) out.push({ id: ref.id, type: "added", system: "mail", itemId: `mail:notice:${note.id}`, itemKind: "notice", item: customItem(note), since: ref.since, now: ref.now });
      continue;
    }
    const key = `${ref.system}|${ref.since.join(",")}|${ref.now.join(",")}`;
    let list = cache.get(key);
    if (!list) {
      list = diffSystem(ref.system, itemsForSystem(ref.system, buildWorld(ref.since)).items, itemsForSystem(ref.system, buildWorld(ref.now)).items, ref.since, ref.now);
      cache.set(key, list);
    }
    const found = list.find((c) => c.id === ref.id);
    if (found && !out.some((c) => c.id === found.id)) out.push(found);
  }
  return out;
}

export type DemoAgentContext = {
  submitted: string[];
  studySessions: StudySession[];
  reminders: Reminder[];
  personalEvents: PersonalEvent[];
  campus: CampusRequest;
};

const tooLong = (v: unknown, max: number) => typeof v !== "string" || v.length === 0 || v.length > max;

export function sanitizePlanExtras(raw: Record<string, unknown>): Pick<PlanState, "reminders" | "personalEvents"> {
  const reminders = Array.isArray(raw.reminders)
    ? raw.reminders.filter((r): r is Reminder => !!r && typeof r === "object" && !tooLong((r as Reminder).id, 150) && !tooLong((r as Reminder).title, 120) && isMyIso((r as Reminder).at)).slice(0, 30) : [];
  const personalEvents = Array.isArray(raw.personalEvents)
    ? raw.personalEvents.filter((e): e is PersonalEvent => !!e && typeof e === "object" && !tooLong((e as PersonalEvent).id, 150) && !tooLong((e as PersonalEvent).title, 120) && isMyIso((e as PersonalEvent).start) && isMyIso((e as PersonalEvent).end)).slice(0, 30) : [];
  return { reminders, personalEvents };
}

export function buildCampusContext(context: DemoAgentContext): CampusToolContext {
  const { campus } = context;
  const items: CampusItem[] = [];
  let account: AccountSummary | undefined;
  const connected: SystemId[] = [];
  for (const system of SYSTEM_IDS) {
    const asOf = campus.asOf[system];
    if (!asOf) continue;
    connected.push(system);
    const part = itemsForSystem(system, buildWorld(asOf));
    items.push(...part.items);
    if (part.account) account = part.account;
  }
  if (connected.includes("mail")) items.push(...campus.custom.map(customItem));
  const changes = verifyChanges(campus.changes, campus.custom).filter((c) => connected.includes(c.system));
  return {
    data: campusDataFrom(items, account, connected),
    items, changes,
    failed: campus.failed.map((system) => ({ system, message: `${SYSTEM_LABEL[system]} was unavailable at the last sync.` })),
    plan: { studySessions: context.studySessions, reminders: context.reminders, personalEvents: context.personalEvents },
    submitted: context.submitted, now: DEMO_NOW,
  };
}

