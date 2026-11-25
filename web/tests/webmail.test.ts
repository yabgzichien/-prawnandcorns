import assert from "node:assert/strict";
import test from "node:test";
import { avatarTone, filterMail, fullWhen, initials, isUnread, stepSelection, toItems, whenLabel } from "../src/lib/mail/webmail.ts";
import { fetchMailBody, fetchMailList } from "../src/lib/mail/client.ts";
import { getMailRead, markMailRead, resetScenario } from "../src/lib/world/storage.ts";
import { mailList, mailMessage } from "../src/lib/world/payloads.ts";
import { mockRespond } from "../src/lib/world/mock-http.ts";
import { buildWorld } from "../src/lib/world/world.ts";

process.env.COMPASS_MOCK_DELAY_MS = "0";
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

const api: typeof fetch = async (input, init) => {
  const url = new URL(String(input), "http://x");
  const request = new Request(url, { headers: init?.headers });
  if (url.pathname.endsWith("/messages")) return mockRespond(request, "mail", mailList);
  const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  return mockRespond(request, "mail", (w) => mailMessage(w, id));
};

test("the list merges the mail system and typed emails, newest first, and keeps typed ones marked", async () => {
  const messages = await fetchMailList(["extend-lab6-deadline", "noise-emails"], undefined, api);
  const items = toItems(messages, [{ id: "custom-1-a", from: "Dr. Lim (demo)", subject: "Hello", body: "The  tutorial\nmoves.", date: "2026-11-23T13:45:00+08:00" }]);
  assert.equal(items.length, messages.length + 1);
  assert.deepEqual(items.map((m) => Date.parse(m.date)), [...items.map((m) => Date.parse(m.date))].sort((a, b) => b - a));
  const typed = items.find((m) => m.custom)!;
  assert.equal(typed.id, "mail:custom-1-a");
  assert.equal(typed.preview, "The tutorial moves.");
  assert.ok(items.some((m) => m.id === "mail-lab6-extended"));
});

test("an opened email's text comes from the mail system, and a missing one is a clear error", async () => {
  assert.match(await fetchMailBody("mail-lab6-extended", ["extend-lab6-deadline"], undefined, api), /deadline is now Fri 27 Nov/);
  await assert.rejects(() => fetchMailBody("mail-nope", [], undefined, api), /no longer in the inbox/);
  const junk: typeof fetch = async () => Response.json({ messages: "no" });
  await assert.rejects(() => fetchMailList([], undefined, junk), /unreadable/);
  assert.equal(buildWorld([]).inbox.length, 2);
});

test("older emails begin as read, new ones as unread, and opening marks one read", () => {
  const read = new Set<string>();
  assert.equal(isUnread("mail-b1", read), false);
  assert.equal(isUnread("mail-lab6-extended", read), true);
  assert.equal(isUnread("mail-lab6-extended", new Set(["mail-lab6-extended"])), false);
  const storage = memory();
  assert.deepEqual(getMailRead(storage), []);
  assert.ok(markMailRead("mail-lab6-extended", storage));
  assert.ok(markMailRead("mail-lab6-extended", storage));
  assert.deepEqual(getMailRead(storage), ["mail-lab6-extended"]);
  assert.equal(markMailRead("x".repeat(500), storage), false);
  assert.equal(markMailRead("a", null), false);
  storage.setItem("compass:mail-read:v1", "{bad");
  assert.deepEqual(getMailRead(storage), []);
  markMailRead("a", storage);
  resetScenario(storage);
  assert.deepEqual(getMailRead(storage), [], "Reset scenario makes everything unread again");
});

test("search and the unread filter", async () => {
  const items = toItems(await fetchMailList(["noise-emails", "club-info-session"], undefined, api), []);
  assert.deepEqual(filterMail(items, "voucher", false, new Set()).map((m) => m.id), ["mail-prize-spam"]);
  assert.ok(filterMail(items, "ROBOTICS", false, new Set()).some((m) => m.id === "mail-robotics-info"));
  assert.ok(filterMail(items, "", true, new Set()).every((m) => !m.id.startsWith("mail-b")));
  assert.equal(filterMail(items, "", true, new Set(items.map((m) => m.id))).length, 0);
  assert.equal(filterMail(items, "zzzz", false, new Set()).length, 0);
});

test("arrow keys step through the list without wrapping", () => {
  const ids = ["a", "b", "c"];
  assert.equal(stepSelection(ids, null, 1), "a");
  assert.equal(stepSelection(ids, null, -1), "c");
  assert.equal(stepSelection(ids, "a", 1), "b");
  assert.equal(stepSelection(ids, "c", 1), "c");
  assert.equal(stepSelection(ids, "a", -1), "a");
  assert.equal(stepSelection(ids, "gone", 1), "a");
  assert.equal(stepSelection([], "a", 1), null);
});

test("avatars and dates are stable and readable", () => {
  assert.equal(initials("Dr. Lim (demo)"), "DL");
  assert.equal(initials("Robotics & AI Society (demo)"), "RS");
  assert.equal(initials("Prize Desk (demo)"), "PD");
  assert.equal(initials("  "), "?");
  assert.equal(avatarTone("Dr. Lim (demo)"), avatarTone("Dr. Lim (demo)"));
  assert.ok([0, 1, 2, 3, 4, 5].includes(avatarTone("Anyone")));
  assert.equal(whenLabel("2026-11-23T13:25:00+08:00"), "13:25");
  assert.equal(whenLabel("2026-11-20T09:05:00+08:00"), "Fri 20 Nov");
  assert.equal(whenLabel("nonsense"), "");
  assert.equal(fullWhen("2026-11-23T13:25:00+08:00"), "Mon 23 Nov, 13:25");
});
