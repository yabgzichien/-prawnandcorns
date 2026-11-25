import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false });

test("new mail arrives unread, opens in the reading pane, and the unread count follows", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo/mail", { waitUntil: "networkidle" });
  const list = page.getByRole("listbox", { name: "Messages" });
  await expect(list.getByRole("option")).toHaveCount(2);
  await expect(page.getByText("All read")).toBeVisible();
  await expect(page.getByText("Select a message to read it")).toBeVisible();

  const consolePage = await context.newPage();
  await consolePage.goto("/demo", { waitUntil: "networkidle" });
  await consolePage.getByRole("listitem").filter({ hasText: /Extend the Lab 6 report deadline/ }).getByRole("button", { name: "Trigger" }).click();

  const lab6 = list.getByRole("option", { name: /Lab 6 deadline extended to Friday/ });
  await expect(lab6).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("1 unread")).toBeVisible();
  await expect(lab6.getByLabel("Unread")).toBeVisible();
  await expect(list.getByRole("option").first()).toContainText("Dr. Lim (demo)"); // newest first

  await lab6.click();
  const pane = page.getByRole("region", { name: "Message" });
  await expect(pane.getByRole("heading", { name: "Lab 6 deadline extended to Friday" })).toBeVisible();
  await expect(pane.getByText(/The deadline is now Fri 27 Nov, 23:59/)).toBeVisible();
  await expect(pane.getByText(/untrusted outside content/)).toBeVisible();
  await expect(page.getByText("All read")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("compass:mail-read:v1") ?? "[]"))).toEqual(["mail-lab6-extended"]);
  expect(errors).toEqual([]);
});

test("search, the unread filter and the arrow keys", async ({ page, context }) => {
  const consolePage = await context.newPage();
  await consolePage.goto("/demo", { waitUntil: "networkidle" });
  await consolePage.getByRole("listitem").filter({ hasText: /two noise emails/ }).getByRole("button", { name: "Trigger" }).click();
  await page.goto("/demo/mail", { waitUntil: "networkidle" });
  const list = page.getByRole("listbox", { name: "Messages" });
  await expect(list.getByRole("option")).toHaveCount(4);

  await page.getByRole("searchbox", { name: "Search mail" }).or(page.getByLabel("Search mail")).first().fill("voucher");
  await expect(list.getByRole("option")).toHaveCount(1);
  await page.getByLabel("Search mail").fill("");
  await page.getByRole("button", { name: "Unread", exact: true }).click();
  await expect(list.getByRole("option")).toHaveCount(2);
  await page.getByRole("button", { name: "All", exact: true }).click();

  await list.focus();
  await page.keyboard.press("ArrowDown");
  await expect(list.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(list.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("k");
  await expect(list.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByText("Select a message to read it")).toBeVisible();
});

test("a message written in New message lands in the inbox, opens, and Compass can see it", async ({ page }) => {
  await page.goto("/demo/mail", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New message" }).click();
  const dialog = page.getByRole("dialog", { name: "New message" });
  await expect(dialog.getByRole("button", { name: "Send to inbox" })).toBeDisabled();
  await dialog.getByLabel("From").fill("Dr. Ooi (demo)");
  await dialog.getByLabel("Subject").fill("Quiz moved");
  await dialog.getByLabel("Message").fill("The quiz is now on Friday 27 Nov at 10:00 in A4-301.");
  await dialog.getByRole("button", { name: "Send to inbox" }).click();
  await expect(dialog).toBeHidden();
  const pane = page.getByRole("region", { name: "Message" });
  await expect(pane.getByRole("heading", { name: "Quiz moved" })).toBeVisible();
  await expect(pane.getByText(/quiz is now on Friday 27 Nov/)).toBeVisible();
  await expect(pane.getByText(/Typed in the console, kept in this browser/)).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("compass:custom-mail:v1") ?? "[]"));
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ from: "Dr. Ooi (demo)", subject: "Quiz moved" });
  await expect(page.getByRole("listbox", { name: "Messages" }).getByRole("option", { name: /Quiz moved/ })).toBeVisible();
});

test("Reset scenario puts the mailbox back and makes new mail unread again", async ({ page, context }) => {
  const consolePage = await context.newPage();
  await consolePage.goto("/demo", { waitUntil: "networkidle" });
  await consolePage.getByRole("listitem").filter({ hasText: /Robotics club announces/ }).getByRole("button", { name: "Trigger" }).click();
  await page.goto("/demo/mail", { waitUntil: "networkidle" });
  const list = page.getByRole("listbox", { name: "Messages" });
  await list.getByRole("option", { name: /Info session this Wednesday/ }).click();
  await expect(page.getByText("All read")).toBeVisible();
  await page.getByRole("button", { name: "Reset scenario" }).click();
  await expect(list.getByRole("option")).toHaveCount(2);
  expect(await page.evaluate(() => localStorage.getItem("compass:mail-read:v1"))).toBeNull();
});

test.describe("narrow screens", () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  test("the list and the reading pane take turns and fit 320px", async ({ page }) => {
    await page.goto("/demo/mail", { waitUntil: "networkidle" });
    const list = page.getByRole("listbox", { name: "Messages" });
    await expect(list).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await list.getByRole("option").first().click();
    const pane = page.getByRole("region", { name: "Message" });
    await expect(pane).toBeVisible();
    await expect(list).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await pane.getByRole("button", { name: "Inbox" }).click();
    await expect(list).toBeVisible();
  });
});
