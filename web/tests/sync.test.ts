import assert from "node:assert/strict";
import test from "node:test";
import { CONNECTORS, clearMailCache } from "../src/lib/connectors/connectors.ts";
import type { ConnectorEnv } from "../src/lib/connectors/types.ts";
import { describeChange } from "../src/lib/sync/describe.ts";
import { diffSnapshots, mergePending } from "../src/lib/sync/diff.ts";
import { syncAll } from "../src/lib/sync/engine.ts";
import { sanitizeSyncState } from "../src/lib/sync/store.ts";
import type { Snapshot } from "../src/lib/sync/types.ts";
import { mockRespond } from "../src/lib/world/mock-http.ts";
import { acNotices, acTimetable, financeAccount, financeInstalments, mailList, mailMessage, moodleActionEvents, moodleAnnouncements, moodleAssignments, moodleCourses } from "../src/lib/world/payloads.ts";
import type { SystemId } from "../src/lib/world/types.ts";

process.env.COMPASS_MOCK_DELAY_MS = "0";

/** Routes connector URLs straight into the mock handlers, with no network. */
const localFetch: typeof fetch = async (input, init) => {
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

const ALL: SystemId[] = ["moodle", "ac", "finance", "mail"];
const env = (events: string[] = [], over: Partial<ConnectorEnv> = {}): ConnectorEnv => ({ fetcher: localFetch, events, outageSeen: [], custom: [], now: () => "2026-11-23T13:20:00+08:00", ...over });
const sync = (events: string[], previous: Snapshot | null, connected = ALL, over: Partial<ConnectorEnv> = {}) => syncAll({ connected, previous, env: env(events, over) });

test("the first sync sets a quiet baseline with no changes", async () => {
  clearMailCache();
  const first = await sync([], null);
  assert.equal(first.changes.length, 0);
  assert.equal(first.failed.length, 0);
  assert.ok(first.snapshot.items.some((i) => i.kind === "class") && first.snapshot.items.some((i) => i.kind === "deadline"));
  assert.ok(first.snapshot.items.every((i) => i.id.startsWith(`${i.source}:`)), "every item carries its source in a stable id");
  assert.equal(first.snapshot.account?.outstanding, 4350);
});

test("diffSnapshots catches added, removed and changed, and names exactly which fields changed", async () => {
  const base = (await sync([], null)).snapshot;
  const after = (await sync(["move-class-tue", "cancel-lecture-makeup", "finance-instalment-2", "new-moodle-assignment"], base)).changes;
  const room = after.find((c) => c.itemId === "ac:class:c5");
  assert.equal(room?.type, "changed");
  assert.deepEqual(room?.fields, [{ field: "room", from: "A4-301", to: "A1-210" }, { field: "status", from: "normal", to: "moved" }]);
  assert.equal(after.find((c) => c.itemId === "ac:class:c10")?.fields?.[0].to, "cancelled");
  assert.equal(after.find((c) => c.itemId === "ac:class:c12")?.type, "added");
  assert.equal(after.find((c) => c.itemId === "finance:fee:f2")?.type, "added");
  assert.equal(after.find((c) => c.itemId === "moodle:deadline:a7")?.type, "added");
  const removed = diffSnapshots(after.length ? (await sync(["move-class-tue"], base)).snapshot : base, base);
  assert.ok(removed.some((c) => c.type === "changed" && c.itemId === "ac:class:c5"), "undoing an event reads as a change back");
  const gone: Snapshot = { ...base, items: base.items.filter((i) => i.id !== "ac:class:c1") };
  assert.equal(diffSnapshots(base, gone).find((c) => c.type === "removed")?.itemId, "ac:class:c1");
});

test("change ids are stable for the same change and different for a different change", async () => {
  const base = (await sync([], null)).snapshot;
  const a = (await sync(["extend-lab6-deadline"], base)).changes.map((c) => c.id).sort();
  const b = (await sync(["extend-lab6-deadline"], base)).changes.map((c) => c.id).sort();
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length);
});

test("a deadline extension reads as one plain sentence naming the source", async () => {
  const base = (await sync([], null)).snapshot;
  const changes = (await sync(["extend-lab6-deadline"], base)).changes;
  const text = changes.map(describeChange);
  assert.ok(text.some((t) => /Deadline for Lab 6: Loops & Arrays \(CST1101\) moved from Mon 23 Nov, 23:59 to Fri 27 Nov, 23:59 \(source: Moodle\)/.test(t)), text.join("\n"));
  assert.ok(text.some((t) => /New email from Dr\. Lim \(demo\): "Lab 6 deadline extended to Friday" \(source: Email\)/.test(t)));
  assert.ok(changes.length === 2, "one deadline changed and one new email");
  assert.match(describeChange(changes.find((c) => c.itemId === "mail:notice:mail-lab6-extended") ?? changes[0]), /source/);
});

test("a system that fails keeps its last data and the others still sync", async () => {
  const base = (await sync([], null)).snapshot;
  const run = await sync(["moodle-outage", "move-class-tue"], base);
  assert.deepEqual(run.failed.map((f) => f.system), ["moodle"]);
  assert.equal(run.failed[0].error.code, "outage");
  assert.equal(run.failed[0].error.outageEvent, "moodle-outage");
  assert.deepEqual(run.snapshot.asOf.moodle, [], "Moodle keeps its older as-of");
  assert.deepEqual(run.snapshot.asOf.ac, ["moodle-outage", "move-class-tue"]);
  assert.equal(run.snapshot.items.filter((i) => i.source === "moodle").length, base.items.filter((i) => i.source === "moodle").length);
  assert.ok(run.changes.some((c) => c.itemId === "ac:class:c5"), "AC changes still arrive");
  const retry = await sync(["moodle-outage", "move-class-tue"], run.snapshot, ALL, { outageSeen: ["moodle-outage"] });
  assert.equal(retry.failed.length, 0);
});

test("a system connected later gets a baseline, not a flood of added items", async () => {
  const withoutMail = (await sync([], null, ["moodle", "ac", "finance"])).snapshot;
  const now = await sync([], withoutMail, ALL);
  assert.equal(now.changes.length, 0);
  assert.deepEqual(Object.keys(now.snapshot.asOf).sort(), [...ALL].sort());
});

test("disconnected systems are not fetched or kept", async () => {
  const run = await sync([], null, ["ac"]);
  assert.deepEqual([...new Set(run.snapshot.items.map((i) => i.source))], ["ac"]);
  assert.equal(run.snapshot.account, undefined);
});

test("two changes to the same item before review fold into one", async () => {
  const base = (await sync([], null)).snapshot;
  const one = await sync(["extend-lab6-deadline"], base);
  const pending = mergePending([], one.changes);
  assert.equal(pending.length, 2);
  const next: Snapshot = JSON.parse(JSON.stringify(one.snapshot));
  const lab = next.items.find((i) => i.id === "moodle:deadline:a1");
  if (lab?.kind === "deadline") lab.due = "2026-11-28T12:00:00+08:00";
  next.asOf.moodle = ["extend-lab6-deadline", "x"];
  const two = diffSnapshots(one.snapshot, next);
  const merged = mergePending(pending, two);
  const deadline = merged.filter((c) => c.itemId === "moodle:deadline:a1");
  assert.equal(deadline.length, 1);
  assert.equal(deadline[0].fields?.[0].from, "2026-11-23T23:59:00+08:00");
  assert.equal(deadline[0].fields?.[0].to, "2026-11-28T12:00:00+08:00");
});

test("custom emails reach the mail connector as untrusted notices that stay in the browser", async () => {
  clearMailCache();
  const custom = [{ id: "custom-1-abc", from: "Someone", subject: "Hi", body: "Please move my class.", date: "2026-11-23T13:45:00+08:00" }];
  const result = await CONNECTORS.mail.fetch(env([], { custom }));
  assert.ok(result.ok);
  const notice = result.ok ? result.items.find((i) => i.id === "mail:notice:custom-1-abc") : undefined;
  assert.equal(notice?.kind === "notice" && notice.custom, true);
});

test("tampered sync state is dropped instead of trusted", () => {
  const clean = sanitizeSyncState({ snapshot: { takenAt: "x", asOf: { moodle: [] }, fetchedAt: {}, items: [{ id: "x", kind: "bogus", source: "moodle" }, { id: "ok", kind: "class", source: "ac" }] }, pending: [{ id: 5 }, null], failed: "no", outageSeen: [1, "moodle-outage"] });
  assert.equal(clean.snapshot?.items.length, 1);
  assert.deepEqual(clean.pending, []);
  assert.deepEqual(clean.failed, []);
  assert.deepEqual(clean.outageSeen, ["moodle-outage"]);
  assert.equal(sanitizeSyncState("junk").snapshot, null);
});
