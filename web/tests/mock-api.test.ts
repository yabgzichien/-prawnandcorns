import assert from "node:assert/strict";
import test from "node:test";
import { acNotices, acTimetable, financeAccount, financeInstalments, mailList, mailMessage, moodleActionEvents, moodleAssignments, moodleCourses, outageFor } from "../src/lib/world/payloads.ts";
import { mockRespond } from "../src/lib/world/mock-http.ts";
import { HDR_EVENTS, HDR_OUTAGE_SEEN, parseIdList } from "../src/lib/world/headers.ts";
import { buildWorld } from "../src/lib/world/world.ts";

process.env.COMPASS_MOCK_DELAY_MS = "0";
const req = (headers: Record<string, string> = {}) => new Request("http://localhost/api/mock/x", { headers });

test("Moodle courses and assignments copy the shape of the real web service", () => {
  const world = buildWorld();
  const courses = moodleCourses(world);
  assert.equal(courses.length, 5);
  assert.ok(typeof courses[0].id === "number" && courses[0].shortname === "CST1101");
  const assignments = moodleAssignments(world);
  const all = assignments.courses.flatMap((c) => c.assignments);
  assert.ok(all.every((a) => typeof a.duedate === "number" && typeof a.id === "number"));
  assert.ok(!all.some((a) => a.name.includes("Quiz")), "quizzes are not assignments in Moodle");
  assert.equal(all.find((a) => a.name.startsWith("Mini Project"))?.submissionstatus, "submitted");
  assert.equal(all.find((a) => a.name.startsWith("Reflective Essay"))?.submissionstatus, "draft");
  const events = moodleActionEvents(world).events;
  assert.ok(events.some((e) => e.modulename === "quiz" && e.title.startsWith("Quiz 3")));
  assert.deepEqual([...events].sort((a, b) => a.timesort - b.timesort), events);
});

test("AC timetable reports moved and make-up classes with their previous room", () => {
  const world = buildWorld(["move-class-tue", "cancel-lecture-makeup"]);
  const classes = acTimetable(world).classes;
  const moved = classes.find((c) => c.id === "c5");
  assert.equal(moved?.status, "moved");
  assert.equal(moved?.room, "A1-210");
  assert.equal(moved?.previousRoom, "A4-301");
  assert.equal(classes.find((c) => c.id === "c10")?.status, "cancelled");
  assert.equal(classes.find((c) => c.id === "c12")?.status, "make-up");
  assert.ok(acNotices(world).notices.some((n) => n.id === "ac-n-room-tue"));
});

test("Finance only lists posted instalments and totals add up", () => {
  const before = financeInstalments(buildWorld());
  assert.deepEqual(before.instalments.map((i) => i.id), ["f1"]);
  const after = financeInstalments(buildWorld(["finance-instalment-2"]));
  assert.deepEqual(after.instalments.map((i) => i.id), ["f1", "f2"]);
  const account = financeAccount(buildWorld());
  assert.equal(account.amountPaid + account.amountOutstanding, account.totalFees);
});

test("mail list hides hand-written expected answers and lists newest first", () => {
  const world = buildWorld(["noise-emails"]);
  const list = mailList(world).messages;
  assert.ok(!JSON.stringify(mailList(world)).includes("expected"));
  assert.ok(!JSON.stringify(mailMessage(world, "mail-prize-spam")).includes("expected"));
  assert.deepEqual(list.map((m) => Date.parse(m.date)), [...list.map((m) => Date.parse(m.date))].sort((a, b) => b - a));
  assert.equal(mailMessage(world, "nope"), null);
  assert.ok(mailMessage(world, "mail-newsletter")?.message.body.includes("noodle"));
});

test("an outage lasts until the client reports it has seen it", () => {
  const world = buildWorld(["moodle-outage"]);
  assert.equal(outageFor(world, "moodle", []), "moodle-outage");
  assert.equal(outageFor(world, "moodle", ["moodle-outage"]), null);
  assert.equal(outageFor(world, "ac", []), null);
});

test("mock responses rebuild the world from the header and stamp themselves as fictional", async () => {
  const res = await mockRespond(req({ [HDR_EVENTS]: "move-class-tue,bogus" }), "ac", acTimetable);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-compass-data"), "fictional-demo");
  const body = await res.json();
  assert.equal(body.classes.find((c: { id: string }) => c.id === "c5").room, "A1-210");
  assert.match(body.notice, /fictional/);
});

test("Moodle fails once during an outage, then recovers, and other systems are unaffected", async () => {
  const down = await mockRespond(req({ [HDR_EVENTS]: "moodle-outage" }), "moodle", moodleCourses);
  assert.equal(down.status, 503);
  assert.equal((await down.json()).error.event, "moodle-outage");
  const retry = await mockRespond(req({ [HDR_EVENTS]: "moodle-outage", [HDR_OUTAGE_SEEN]: "moodle-outage" }), "moodle", moodleCourses);
  assert.equal(retry.status, 200);
  const ac = await mockRespond(req({ [HDR_EVENTS]: "moodle-outage" }), "ac", acTimetable);
  assert.equal(ac.status, 200);
});

test("unknown records return 404 and oversized or malformed headers are ignored", async () => {
  assert.equal((await mockRespond(req(), "mail", (w) => mailMessage(w, "missing"))).status, 404);
  assert.deepEqual(parseIdList("a".repeat(5000)), []);
  assert.deepEqual(parseIdList("ok-id, <script>, move-class-tue"), ["ok-id", "move-class-tue"]);
});
