import { clearMailCache } from "../src/lib/connectors/connectors.ts";
import type { ConnectorEnv } from "../src/lib/connectors/types.ts";
import type { CampusToolContext } from "../src/lib/agent-tools/campus.ts";
import { demoStudyProposal } from "../src/lib/planning-demo.ts";
import { DEMO_NOW } from "../src/lib/time.ts";
import { mergePending } from "../src/lib/sync/diff.ts";
import { syncAll } from "../src/lib/sync/engine.ts";
import type { Snapshot } from "../src/lib/sync/types.ts";
import { baseCampusData, campusDataFrom } from "../src/lib/sync/view.ts";
import { EMPTY_PLAN, type PlanState } from "../src/lib/updates/types.ts";
import { mockRespond } from "../src/lib/world/mock-http.ts";
import { acNotices, acTimetable, financeAccount, financeInstalments, mailList, mailMessage, moodleActionEvents, moodleAnnouncements, moodleAssignments, moodleCourses } from "../src/lib/world/payloads.ts";
import type { SystemId } from "../src/lib/world/types.ts";

process.env.COMPASS_MOCK_DELAY_MS = "0";

/** Routes connector URLs straight into the mock handlers, with no network. */
export const localFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input), "http://localhost");
  const request = new Request(url, { headers: init?.headers });
  const p = url.pathname;
  if (p === "/api/mock/moodle") {
    const fn = url.searchParams.get("wsfunction");
    const build = fn === "core_enrol_get_users_courses" ? moodleCourses : fn === "mod_assign_get_assignments" ? moodleAssignments : fn === "mod_forum_get_forum_discussions" ? moodleAnnouncements : moodleActionEvents;
    return mockRespond(request, "moodle", build);
  }
  if (p === "/api/mock/ac/timetable") return mockRespond(request, "ac", acTimetable);
  if (p === "/api/mock/ac/notices") return mockRespond(request, "ac", acNotices);
  if (p === "/api/mock/finance/account") return mockRespond(request, "finance", financeAccount);
  if (p === "/api/mock/finance/instalments") return mockRespond(request, "finance", financeInstalments);
  if (p === "/api/mock/mail/messages") return mockRespond(request, "mail", mailList);
  const id = decodeURIComponent(p.split("/").pop() ?? "");
  return mockRespond(request, "mail", (w) => mailMessage(w, id));
};

export const ALL: SystemId[] = ["moodle", "ac", "finance", "mail"];

export const env = (events: string[] = [], over: Partial<ConnectorEnv> = {}): ConnectorEnv => ({
  fetcher: localFetch, events, outageSeen: [], custom: [], now: () => "2026-11-23T13:20:00+08:00", ...over,
});

export const sync = (events: string[], previous: Snapshot | null, connected: SystemId[] = ALL, over: Partial<ConnectorEnv> = {}) =>
  syncAll({ connected, previous, env: env(events, over) });

/** The study plan the deterministic planner would propose from the starting data, as if the student confirmed it. */
export function confirmedPlan(): PlanState {
  const base = baseCampusData();
  const proposal = demoStudyProposal("Help me plan my week", [], [], base);
  return { ...EMPTY_PLAN, studySessions: proposal.sessions };
}

/** What the agent sees after the student's baseline sync and then a second sync with `events` triggered. */
export async function contextAfter(events: string[], plan: PlanState = EMPTY_PLAN, over: Partial<ConnectorEnv> = {}): Promise<CampusToolContext> {
  clearMailCache();
  const base = (await sync([], null)).snapshot;
  const out = await sync(events, base, ALL, over);
  return {
    data: campusDataFrom(out.snapshot.items, out.snapshot.account, ALL),
    items: out.snapshot.items,
    changes: mergePending([], out.changes),
    failed: out.failed.map((f) => ({ system: f.system, message: f.error.message })),
    plan, submitted: [], now: DEMO_NOW,
  };
}
