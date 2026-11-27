import { expect, test, type Page } from "@playwright/test";

/** Today starts as the master calendar alone. These specs use a fresh layout, not the older cards the other specs switch on. */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { const k = "xmum-compass:v1"; const s = JSON.parse(localStorage.getItem(k) ?? "{}"); if (!sessionStorage.getItem("cal-spec")) { delete s.widgets; localStorage.setItem(k, JSON.stringify(s)); sessionStorage.setItem("cal-spec", "1"); } } catch {}
  });
});

const calendar = (page: Page) => page.getByRole("region", { name: "Master calendar" });
const open = async (page: Page) => { await page.goto("/", { waitUntil: "networkidle" }); await expect(calendar(page)).toBeVisible(); return calendar(page); };

test("desktop cards pack in reading order and keep keyboard-selected sizes after reload", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await open(page);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await page.getByRole("button", { name: "Customise" }).click();
  const panel = page.getByRole("dialog", { name: "Customise dashboard" });
  await expect(panel.getByRole("button", { name: "Done" })).toBeFocused();
  const name = (label: string) => page.getByRole("region", { name: label, exact: true });
  for (const title of ["Upcoming", "Fees", "Degree progress"]) {
    await panel.getByRole("switch", { name: `Show ${title}` }).click();
  }
  const fees = name("Fees");
  const feeSize = fees.getByRole("combobox", { name: "Resize Fees" });
  await feeSize.focus();
  await feeSize.press("Home");
  await expect(feeSize).toHaveValue("compact");
  await expect(feeSize).toBeFocused();
  await expect(feeSize).toHaveCSS("outline-style", "solid");
  const attention = name("Upcoming");
  const progress = name("Degree progress");
  await expect.poll(async () => {
    const [a, b, c] = await Promise.all([attention.boundingBox(), fees.boundingBox(), progress.boundingBox()]);
    return !!a && !!b && !!c && a.x < b.x && a.y === b.y && b.x === c.x
      && Math.abs(c.y - b.y - b.height - 16) <= 1 && c.y < a.y + a.height;
  }).toBe(true);
  expect(await page.locator(".home-widget").evaluateAll((elements) => elements.map((el) => el.getAttribute("data-widget"))))
    .toEqual(["calendar", "attention", "fees", "progress"]);
  const attentionSize = panel.getByRole("combobox", { name: "Resize Upcoming" });
  await attentionSize.selectOption("compact");
  const items = attention.getByRole("list", { name: "Deadline and exam alerts" }).getByRole("listitem");
  await expect(items).toHaveCount(1);
  await attention.getByRole("button", { name: "View all" }).click();
  await expect.poll(() => items.count()).toBeGreaterThan(1);
  await attention.getByRole("button", { name: "Show fewer" }).click();
  await attentionSize.selectOption("wide");
  await expect.poll(() => items.count()).toBeGreaterThan(4);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(async () => {
    const [a, c] = await Promise.all([attention.boundingBox(), calendar(page).boundingBox()]);
    return a?.width === c?.width;
  }).toBe(true);
  await panel.getByRole("switch", { name: "Show Fees" }).click();
  await expect(fees).toHaveCount(0);
  await panel.getByRole("switch", { name: "Show Fees" }).click();
  await expect(feeSize).toHaveValue("compact");
  await panel.getByRole("button", { name: "Done" }).click();
  await expect(feeSize).toHaveCount(0);
  await page.reload();
  await expect(attention).toHaveAttribute("data-size", "wide");
  await expect(fees).toHaveAttribute("data-size", "compact");
  await page.getByRole("button", { name: "Customise" }).click();
  const feeHandle = panel.getByRole("img", { name: "Reorder Fees" });
  const progressHandle = panel.getByRole("img", { name: "Reorder Degree progress" });
  await progressHandle.scrollIntoViewIfNeeded();
  const [from, to] = await Promise.all([progressHandle.boundingBox(), feeHandle.boundingBox()]);
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => {
    const [a, b] = await Promise.all([progress.boundingBox(), fees.boundingBox()]);
    return !!a && !!b && a.x < b.x && a.y === b.y;
  }).toBe(true);
  await panel.getByRole("button", { name: "Done" }).click();
  await page.setViewportSize({ width: 375, height: 750 });
  await expect(attention).toHaveAttribute("data-size", "standard");
  await expect.poll(async () => {
    const [cal, a, b, c] = await Promise.all([calendar(page).boundingBox(), attention.boundingBox(), progress.boundingBox(), fees.boundingBox()]);
    return !!cal && !!a && !!b && !!c && [a, b, c].every((box) => box.width === cal.width)
      && a.y >= cal.y + cal.height && b.y >= a.y + a.height && c.y >= b.y + b.height;
  }).toBe(true);
  await page.getByRole("button", { name: "Customise" }).click();
  await expect(panel.getByRole("combobox", { name: /^Resize/ })).toHaveCount(0);
});

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
  await expect(cal.getByText("1 overdue:")).toBeVisible();
  await expect(cal.getByRole("link", { name: /^Deadline: Vocabulary Quiz 4/ })).toBeVisible();
  await expect(cal.getByRole("link", { name: /^Campus event: Hack-day/ })).toBeVisible();
});

test("blocks that overlap in time sit side by side, never on top of each other", async ({ page }) => {
  await page.addInitScript(() => {
    try { const k = "xmum-compass:v1"; const s = JSON.parse(localStorage.getItem(k) ?? "{}"); s.personalEvents = [{ id: "pe-x", title: "Dentist", start: "2026-11-23T10:30:00+08:00", end: "2026-11-23T11:30:00+08:00" }]; localStorage.setItem(k, JSON.stringify(s)); } catch {}
  });
  const cal = await open(page);
  const a = await cal.getByRole("link", { name: /^Class: CST1101 Lecture, 10:00 to 12:00$/ }).boundingBox();
  const b = await cal.getByRole("button", { name: /^Calendar entry: Dentist/ }).boundingBox();
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

test("Today shows the daily schedule, next class and its room", async ({ page }) => {
  const cal = await open(page);
  await cal.getByRole("tab", { name: "Today" }).click();
  await expect(cal.getByRole("tab")).toHaveCount(3);
  await expect(cal.getByRole("link", { name: /^Find / })).toBeVisible();
  await expect(cal.getByRole("region", { name: /^Today,/ })).toContainText("Cancelled");
  await expect(cal.getByRole("listitem", { name: "Now, 13:20" })).toBeVisible();
});

test("Customise switches the master calendar off and on, and the choice is kept", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Customise" }).click();
  const dialog = page.getByRole("dialog", { name: "Customise dashboard" });
  await expect(dialog.getByRole("switch", { name: "Show Master calendar" })).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("switch", { name: "Show Master calendar" }).click();
  await dialog.getByRole("switch", { name: "Show Upcoming" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(calendar(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Upcoming" })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(calendar(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Upcoming" })).toBeVisible();
  await page.getByRole("button", { name: "Customise" }).click();
  await page.getByRole("dialog", { name: "Customise dashboard" }).getByRole("switch", { name: "Show Master calendar" }).click();
  await page.getByRole("dialog", { name: "Customise dashboard" }).getByRole("button", { name: "Done" }).click();
  await expect(calendar(page)).toBeVisible();
  await page.getByRole("button", { name: "Customise" }).click();
  await dialog.getByRole("switch", { name: "Show Fees" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  const boxes = async () => Promise.all(["Master calendar", "Upcoming", "Fees"].map((name) =>
    page.getByRole("region", { name, exact: true }).boundingBox()));
  const [cal, left, right] = await boxes();
  expect(cal!.width).toBeGreaterThan(left!.width * 2);
  expect(Math.abs(left!.width - right!.width)).toBeLessThan(1);
  expect(left!.y).toBe(right!.y);
  expect(left!.y).toBeGreaterThanOrEqual(cal!.y + cal!.height);
  await page.setViewportSize({ width: 375, height: 750 });
  // the cards are packed again after a resize, so wait for that instead of reading the first frame
  await expect.poll(async () => {
    const [mobile, first, second] = await boxes();
    return first!.y >= mobile!.y + mobile!.height && second!.y >= first!.y + first!.height;
  }).toBe(true);
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
  await expect(cal.getByRole("button", { name: /^Reminder: Bring ID to the library.*saved in this browser\. Edit$/ })).toBeVisible();
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
  await cal.getByRole("tab", { name: "Today" }).click();
  await expect(cal.getByRole("region", { name: /^Today,/ })).toBeVisible();
  await fits();
});
