import { expect, test, type Page } from "@playwright/test";

/** Today starts as the master calendar alone. These specs use a fresh layout, not the older cards the other specs switch on. */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { const k = "xmum-compass:v1"; const s = JSON.parse(localStorage.getItem(k) ?? "{}"); if (!sessionStorage.getItem("cal-spec")) { delete s.widgets; localStorage.setItem(k, JSON.stringify(s)); sessionStorage.setItem("cal-spec", "1"); } } catch {}
  });
});

const calendar = (page: Page) => page.getByRole("region", { name: "Master calendar" });
const open = async (page: Page) => { await page.goto("/", { waitUntil: "networkidle" }); await expect(calendar(page)).toBeVisible(); return calendar(page); };

test("a fresh visit shows only the master calendar, as a week", async ({ page }) => {
  const cal = await open(page);
  await expect(page.locator(".home-widget")).toHaveCount(1);
  for (const name of ["Up next", "Due soon", "Class changes", "Today", "Find a room", "Clubs & events"]) await expect(page.getByRole("region", { name, exact: true })).toHaveCount(0);
  await expect(cal.getByRole("tab", { name: "Week" })).toHaveAttribute("aria-selected", "true");
  await expect(cal.getByRole("heading", { name: "Mon 23 Nov to Sun 29 Nov" })).toBeVisible();
});

test("the week grid shows the classes, a Now line, the strip, an overdue notice and the cancelled class in words", async ({ page }) => {
  const cal = await open(page);
  await expect(cal.getByRole("listitem", { name: "Now, 13:20" })).toHaveCount(1);
  await expect(cal.getByRole("link", { name: /^Class: MAT1101 Tutorial, 14:00 to 16:00, Cancelled$/ })).toBeVisible();
  await expect(cal.getByRole("link", { name: /^Class: CST1101 Lecture, 10:00 to 12:00$/ })).toBeVisible();
  await expect(cal.getByRole("link", { name: /^Deadline: Lab 6: Loops & Arrays, 23:59$/ })).toBeVisible();
  await expect(cal.getByRole("link", { name: /1 overdue: Vocabulary Quiz 4/ })).toBeVisible();
  await expect(cal.getByRole("link", { name: /^Campus event: Hack-day/ })).toBeVisible();
});

test("blocks that overlap in time sit side by side, never on top of each other", async ({ page }) => {
  await page.addInitScript(() => {
    try { const k = "xmum-compass:v1"; const s = JSON.parse(localStorage.getItem(k) ?? "{}"); s.personalEvents = [{ id: "pe-x", title: "Dentist", start: "2026-11-23T10:30:00+08:00", end: "2026-11-23T11:30:00+08:00" }]; localStorage.setItem(k, JSON.stringify(s)); } catch {}
  });
  const cal = await open(page);
  const a = await cal.getByRole("link", { name: /^Class: CST1101 Lecture, 10:00 to 12:00$/ }).boundingBox();
  const b = await cal.getByRole("link", { name: /^Calendar entry: Dentist/ }).boundingBox();
  expect(a && b).toBeTruthy();
  expect(a!.x + a!.width <= b!.x + 1 || b!.x + b!.width <= a!.x + 1, "the two blocks share the day column without covering each other").toBe(true);
});

test("Previous, Next and Today move the week, and a fee date opens Finance", async ({ page }) => {
  const cal = await open(page);
  await cal.getByRole("button", { name: "Next week" }).click();
  await expect(cal.getByRole("heading", { name: "Mon 30 Nov to Sun 6 Dec" })).toBeVisible();
  await expect(cal.getByRole("link", { name: /^Midterm: MAT1101/ })).toBeVisible();
  await cal.getByRole("button", { name: "Previous week" }).click();
  await expect(cal.getByRole("heading", { name: "Mon 23 Nov to Sun 29 Nov" })).toBeVisible();
  await cal.getByRole("button", { name: "Next week" }).click();
  await cal.getByRole("button", { name: "Today" }).click();
  await expect(cal.getByRole("heading", { name: "Mon 23 Nov to Sun 29 Nov" })).toBeVisible();
  await cal.getByRole("button", { name: "Next week" }).click();
  await cal.getByRole("link", { name: /^Fee due: Tuition instalment 2/ }).click();
  await expect(page).toHaveURL(/section=finance/);
});

test("Month shows the weeks, reaches the January exams, and choosing a day opens its week", async ({ page }) => {
  const cal = await open(page);
  await cal.getByRole("tab", { name: "Month" }).click();
  await expect(cal.getByRole("heading", { name: "November 2026" })).toBeVisible();
  await expect(cal.getByRole("button", { name: /^Tue 24 Nov, \d+ items?\. Open this week$/ })).toBeVisible();
  await cal.getByRole("button", { name: "Next month" }).click();
  await expect(cal.getByRole("heading", { name: "December 2026" })).toBeVisible();
  await cal.getByRole("button", { name: "Next month" }).click();
  await expect(cal.getByRole("heading", { name: "January 2027" })).toBeVisible();
  await cal.getByRole("button", { name: /^Tue 5 Jan, 1 item/ }).click();
  await expect(cal.getByRole("tab", { name: "Week" })).toHaveAttribute("aria-selected", "true");
  await expect(cal.getByRole("heading", { name: "Mon 4 Jan to Sun 10 Jan" })).toBeVisible();
  await expect(cal.getByRole("link", { name: /^Final exam: CST1101/ })).toBeVisible();
});

test("Agenda keeps the list: Overdue first, and the range reaches the January exams", async ({ page }) => {
  const cal = await open(page);
  await cal.getByRole("tab", { name: "Agenda" }).click();
  await expect(cal.getByRole("region", { name: "Overdue" })).toContainText("Vocabulary Quiz 4");
  await expect(cal.getByRole("region", { name: /^Today, Mon 23 Nov$/ })).toBeVisible();
  await expect(cal.getByRole("listitem", { name: "Now, 13:20" })).toBeVisible();
  await expect(cal.getByText(/CST1101.*final exam/)).toHaveCount(0);
  await cal.getByRole("tab", { name: "7 days" }).click();
  await expect(cal.getByText("MAT1101 Calculus I midterm")).toHaveCount(0);
  await cal.getByRole("tab", { name: "Semester" }).click();
  await expect(cal.getByText(/^CST1101.*final exam$/)).toBeVisible();
  await expect(cal.getByText("Semester 2 begins")).toBeVisible();
  await cal.getByRole("tab", { name: "30 days" }).click();
  await cal.getByRole("link", { name: /Tuition instalment 2/ }).click();
  await expect(page).toHaveURL(/section=finance/);
});

test("Customise switches the master calendar off and on, and the choice is kept", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Customise" }).click();
  const dialog = page.getByRole("dialog", { name: "Customise dashboard" });
  await expect(dialog.getByRole("switch", { name: "Show Master calendar" })).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("switch", { name: "Show Master calendar" }).click();
  await dialog.getByRole("switch", { name: "Show Due soon" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(calendar(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Due soon" })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(calendar(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Due soon" })).toBeVisible();
  await page.getByRole("button", { name: "Customise" }).click();
  await page.getByRole("dialog", { name: "Customise dashboard" }).getByRole("switch", { name: "Show Master calendar" }).click();
  await page.getByRole("dialog", { name: "Customise dashboard" }).getByRole("button", { name: "Done" }).click();
  await expect(calendar(page)).toBeVisible();
});

test("Reset to default brings back the calendar alone", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Customise" }).click();
  const dialog = page.getByRole("dialog", { name: "Customise dashboard" });
  await dialog.getByRole("switch", { name: "Show Fees" }).click();
  await dialog.getByRole("button", { name: "Reset to default" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(".home-widget")).toHaveCount(1);
  await expect(calendar(page)).toBeVisible();
});

test("a saved reminder shows up marked as saved in this browser", async ({ page }) => {
  await page.addInitScript(() => {
    try { const k = "xmum-compass:v1"; const s = JSON.parse(localStorage.getItem(k) ?? "{}"); s.reminders = [{ id: "r-cal", title: "Bring ID to the library", at: "2026-11-24T08:30:00+08:00" }]; localStorage.setItem(k, JSON.stringify(s)); } catch {}
  });
  const cal = await open(page);
  await expect(cal.getByRole("link", { name: /^Reminder: Bring ID to the library.*saved in this browser$/ })).toBeVisible();
});

test("no view scrolls sideways on a 320 px phone, and the week shows three days", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const cal = await open(page);
  const fits = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const wide = await cal.evaluate((el) => [...el.querySelectorAll("*")].filter((c) => c.getBoundingClientRect().right > el.getBoundingClientRect().right + 1).map((c) => `${c.tagName}.${String(c.className).slice(0, 40)}`));
    expect(wide).toEqual([]);
  };
  await expect(cal.getByRole("heading", { name: "Mon 23 Nov to Wed 25 Nov" })).toBeVisible();
  await fits();
  await cal.getByRole("tab", { name: "Month" }).click();
  await expect(cal.getByRole("heading", { name: "November 2026" })).toBeVisible();
  await fits();
  await cal.getByRole("tab", { name: "Agenda" }).click();
  await expect(cal.getByRole("region", { name: "Overdue" })).toBeVisible();
  await fits();
});
