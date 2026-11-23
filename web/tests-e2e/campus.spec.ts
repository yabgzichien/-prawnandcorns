import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false });

async function connectAll(page: Page) {
  await page.goto("/connections", { waitUntil: "networkidle" });
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Connect", exact: true }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Allow" }).click();
    await expect(page.getByText("Connected", { exact: true })).toHaveCount(i + 1);
  }
  await expect(page.getByText(/Last read at/).first()).toBeVisible();
}

async function planAndConfirm(page: Page) {
  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await dialog.getByRole("button", { name: "Demo", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Message Compass" }).fill("Help me plan my week");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Proposed study plan" })).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm & save" }).click();
  await expect(dialog.getByText(/Study sessions confirmed and saved/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
}

async function trigger(consolePage: Page, title: RegExp) {
  await consolePage.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "Trigger" }).click();
}

test("console event reaches Compass, the offline agent proposes fixes, approval saves them, Undo restores the plan", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await connectAll(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await planAndConfirm(page);
  await expect(page.getByRole("heading", { name: "Your study plan" })).toBeVisible();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("xmum-compass:v1") ?? "{}").studySessions.map((s: { start: string }) => s.start));
  expect(before).toHaveLength(3);

  const consolePage = await context.newPage();
  await consolePage.goto("/demo", { waitUntil: "networkidle" });
  await expect(consolePage.getByRole("heading", { name: /Demo console/ })).toBeVisible();
  await expect(consolePage.getByRole("navigation")).toHaveCount(0); // no student chrome in the presenter window
  await trigger(consolePage, /Extend the Lab 6 report deadline/);

  await expect(page.getByRole("status").filter({ hasText: /2 updates from Moodle and Email/ })).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await expect(dialog.getByRole("heading", { name: "Proposed updates" })).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByText(/You have 2 new updates/)).toBeVisible();
  await expect(dialog.getByText(/Moodle moved the Lab 6|Deadline for Lab 6/).first()).toBeVisible();
  await expect(dialog.getByText("Not saved").first()).toBeVisible();

  await dialog.getByRole("button", { name: /Approve selected/ }).click();
  await expect(dialog.getByText(/Saved in this browser: moved a study session, added a reminder/)).toBeVisible();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("xmum-compass:v1") ?? "{}"));
  expect(after.studySessions.map((s: { start: string }) => s.start)).not.toEqual(before);
  expect(after.reminders).toHaveLength(1);
  // Reviewed updates stop showing as new. Check the stored state, and the banner once the panel is closed
  // (the banner hides itself while the assistant is open, so it would pass for the wrong reason).
  const ack = await page.evaluate(() => JSON.parse(localStorage.getItem("compass:acknowledged:v1") ?? "[]"));
  expect(ack).toHaveLength(2);

  await dialog.getByRole("button", { name: "Undo" }).first().click();
  await expect(dialog.getByRole("button", { name: /Approve selected/ })).toBeVisible();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("xmum-compass:v1") ?? "{}"));
  expect(restored.studySessions.map((s: { start: string }) => s.start)).toEqual(before);
  expect(restored.reminders).toHaveLength(0);
  const ackAfterUndo = await page.evaluate(() => JSON.parse(localStorage.getItem("compass:acknowledged:v1") ?? "[]"));
  expect(ackAfterUndo).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: /2 updates from Moodle and Email/ })).toBeVisible(); // back, because Undo un-reviews them
  expect(errors).toEqual([]);
});

test("noise emails and a planted instruction produce no change to the plan", async ({ page, context }) => {
  await connectAll(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await planAndConfirm(page);
  const before = await page.evaluate(() => localStorage.getItem("xmum-compass:v1"));
  const consolePage = await context.newPage();
  await consolePage.goto("/demo", { waitUntil: "networkidle" });
  await trigger(consolePage, /two noise emails/);
  await expect(page.getByRole("status").filter({ hasText: /2 updates from Email/ })).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await expect(dialog.getByRole("heading", { name: "Proposed updates" })).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByText(/No action needed/).first()).toBeVisible();
  await expect(dialog.getByText(/Move study session|Remove study session/)).toHaveCount(0);
  await dialog.getByRole("button", { name: /Approve selected/ }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("xmum-compass:v1") ?? "{}"));
  expect(after.studySessions).toHaveLength(3);
  expect(JSON.stringify(after.studySessions)).toBe(JSON.stringify(JSON.parse(before ?? "{}").studySessions));
});

test("an unclear email becomes a question with a draft, never a change", async ({ page, context }) => {
  await connectAll(page);
  const consolePage = await context.newPage();
  await consolePage.goto("/demo", { waitUntil: "networkidle" });
  await trigger(consolePage, /unclear email/);
  await expect(page.getByRole("status").filter({ hasText: /1 update from Email/ })).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await expect(dialog.getByText("Not sure, so asking you")).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByText(/gives no exact date/i).first()).toBeVisible();
  await dialog.getByRole("button", { name: /Ask Dr\. Ooi/ }).click();
  await expect(dialog.getByText("Draft only, not sent")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Open in mail app" })).toHaveAttribute("href", /^mailto:dr\.ooi@demo\.invalid/);
});

test("Moodle going down is reported once and Retry recovers", async ({ page, context }) => {
  await connectAll(page);
  const consolePage = await context.newPage();
  await consolePage.goto("/demo", { waitUntil: "networkidle" });
  await trigger(consolePage, /Take Moodle down/);
  const banner = page.getByRole("status").filter({ hasText: /unavailable/ });
  await expect(banner).toBeVisible({ timeout: 8000 });
  await expect(banner).toContainText(/Moodle is unavailable/);
  await banner.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("status").filter({ hasText: /unavailable/ })).toHaveCount(0, { timeout: 8000 });
  await expect(page.getByText("Unavailable", { exact: true })).toHaveCount(0);
});

test("the console is not linked from the student navigation and works without any student chrome", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator('a[href="/demo"]')).toHaveCount(0);
  await page.goto("/demo", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /Ask Compass/ })).toHaveCount(0);
});

test.describe("narrow screens", () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  test("Connections and the console fit 320px without horizontal scrolling", async ({ page }) => {
    for (const path of ["/connections", "/demo"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width, `${path} should not scroll horizontally`).toBeLessThanOrEqual(320);
    }
  });
});
