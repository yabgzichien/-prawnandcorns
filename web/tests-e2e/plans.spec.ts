import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, colorScheme: "light" });

// No test here may reach a real model.
test.beforeEach(async ({ page, context }) => {
  await context.addInitScript(() => {
    try { const k = "xmum-compass:v1"; const s = JSON.parse(localStorage.getItem(k) ?? "{}"); if (!sessionStorage.getItem("plans-spec")) { delete s.widgets; delete s.personalEvents; delete s.todos; delete s.reminders; localStorage.setItem(k, JSON.stringify(s)); sessionStorage.setItem("plans-spec", "1"); } } catch {}
  });
  await page.route("**/api/agent", (route) => route.request().method() === "GET"
    ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false, data: "fictional_demo" }) })
    : route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Gemini API key not configured." }) }));
});

const calendar = (page: Page) => page.getByRole("region", { name: "Master calendar" });
const assistant = (page: Page) => page.getByRole("dialog", { name: "Compass assistant" });
const stored = (page: Page, key: string) => page.evaluate((k) => JSON.parse(localStorage.getItem("xmum-compass:v1") ?? "{}")[k] ?? [], key);

async function openCalendar(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(calendar(page)).toBeVisible();
}
async function ask(page: Page, text: string) {
  await page.keyboard.press("ControlOrMeta+k");
  await assistant(page).getByRole("button", { name: "Demo", exact: true }).click();
  await assistant(page).getByRole("textbox", { name: "Message Compass" }).fill(text);
  await assistant(page).getByRole("button", { name: "Send", exact: true }).click();
}

test("tell Compass about an event: it reads the day and time, shows what it overlaps, and saves only on Add", async ({ page }) => {
  await openCalendar(page);
  await ask(page, "I have a dentist appointment this Friday at 3pm");
  const card = assistant(page).getByLabel("New calendar entry");
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card.getByLabel("Title")).toHaveValue("Dentist appointment");
  await expect(card.getByLabel("Date")).toHaveValue("2026-11-27");
  await expect(card.getByLabel("Starts")).toHaveValue("15:00");
  await expect(card.getByLabel("Ends")).toHaveValue("16:00");
  await expect(card.getByRole("status")).toContainText("Overlaps: Club Fair");
  expect(await stored(page, "personalEvents")).toEqual([]);
  await card.getByLabel("Ends").fill("16:30");
  await card.getByRole("button", { name: "Add to calendar" }).click();
  await expect(assistant(page).getByText("Added to your calendar")).toBeVisible();
  const saved = await stored(page, "personalEvents");
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ title: "Dentist appointment", start: "2026-11-27T15:00:00+08:00", end: "2026-11-27T16:30:00+08:00" });
  await expect(calendar(page).getByRole("button", { name: /^Calendar entry: Dentist appointment, 15:00 to 16:30, saved in this browser\. Edit$/ })).toBeVisible();
});

test("tell Compass a task: it becomes a to-do with a due date, on the list and on the calendar", async ({ page }) => {
  await openCalendar(page);
  await ask(page, "Remind me to print my lab report tomorrow");
  const card = assistant(page).getByLabel("New to-do");
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card.getByLabel("Title")).toHaveValue("Print my lab report");
  await expect(card.getByLabel(/^Due date/)).toHaveValue("2026-11-24");
  await card.getByRole("button", { name: "Add to-do" }).click();
  await expect(calendar(page).getByRole("button", { name: /^Print my lab report, Tue 24 Nov\. Edit$/ })).toBeVisible();
  await expect(calendar(page).getByRole("button", { name: /^To-do: Print my lab report, Due, saved in this browser\. Edit$/ })).toBeVisible();
  expect(await stored(page, "todos")).toEqual([{ id: expect.any(String), title: "Print my lab report", done: false, due: "2026-11-24" }]);
});

test("a question is not turned into an entry", async ({ page }) => {
  await openCalendar(page);
  await ask(page, "Do I have a class on Friday?");
  await expect(assistant(page).getByLabel("New calendar entry")).toHaveCount(0);
  await expect(assistant(page).getByLabel("New to-do")).toHaveCount(0);
});

test("add by hand: Add opens a sheet, a missing title is said plainly and nothing is saved, then it appears", async ({ page }) => {
  await openCalendar(page);
  await calendar(page).getByRole("button", { name: "Add to calendar or to-do" }).click();
  const dialog = page.getByRole("dialog", { name: "Add to calendar" });
  await expect(dialog.getByLabel("Title")).toBeFocused();
  await dialog.getByLabel("Date").fill("2026-11-26");
  await dialog.getByLabel("Starts").fill("17:00");
  await expect(dialog.getByLabel("Ends")).toHaveValue("18:00");
  await dialog.getByRole("button", { name: "Add to calendar" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Give it a title.");
  expect(await stored(page, "personalEvents")).toEqual([]);
  await dialog.getByLabel("Title").fill("Study group");
  await dialog.getByLabel("Place").fill("A3-G01");
  await dialog.getByRole("button", { name: "Add to calendar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(calendar(page).getByRole("button", { name: /^Calendar entry: Study group, 17:00 to 18:00, saved in this browser\. Edit$/ })).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(calendar(page).getByRole("button", { name: /^Calendar entry: Study group/ })).toBeVisible();
});

test("click an empty hour in the week grid to add something there", async ({ page }) => {
  await openCalendar(page);
  const sat = calendar(page).getByRole("list", { name: "Sat 28 Nov, timetable" });
  const box = (await sat.boundingBox())!;
  await sat.click({ position: { x: box.width / 2, y: (17 - 8) * 52 + 6 } });
  const dialog = page.getByRole("dialog", { name: "Add to calendar" });
  await expect(dialog.getByLabel("Date")).toHaveValue("2026-11-28");
  await expect(dialog.getByLabel("Starts")).toHaveValue("17:00");
});

test("edit an event, delete it, and bring it back with Undo", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const k = "xmum-compass:v1"; const s = JSON.parse(localStorage.getItem(k) ?? "{}");
    s.personalEvents = [{ id: "pe-seed", title: "Dentist", start: "2026-11-26T15:00:00+08:00", end: "2026-11-26T16:00:00+08:00" }];
    localStorage.setItem(k, JSON.stringify(s));
  });
  await openCalendar(page);
  await calendar(page).getByRole("button", { name: /^Calendar entry: Dentist/ }).click();
  const dialog = page.getByRole("dialog", { name: "Edit entry" });
  await dialog.getByLabel("Title").fill("Dentist check-up");
  await dialog.getByLabel("Starts").fill("14:00");
  await dialog.getByLabel("Ends").fill("14:45");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(calendar(page).getByRole("button", { name: /^Calendar entry: Dentist check-up, 14:00 to 14:45/ })).toBeVisible();
  expect((await stored(page, "personalEvents"))[0]).toMatchObject({ id: "pe-seed", title: "Dentist check-up", start: "2026-11-26T14:00:00+08:00" });
  await calendar(page).getByRole("button", { name: /^Calendar entry: Dentist check-up/ }).click();
  await page.getByRole("dialog", { name: "Edit entry" }).getByRole("button", { name: "Delete" }).click();
  await expect(calendar(page).getByRole("button", { name: /Dentist check-up/ })).toHaveCount(0);
  expect(await stored(page, "personalEvents")).toEqual([]);
  await page.getByRole("button", { name: "Undo" }).last().click();
  await expect(calendar(page).getByRole("button", { name: /^Calendar entry: Dentist check-up/ })).toBeVisible();
});

test("the to-do list: quick add, tick, completed, edit a due date, and it survives a reload", async ({ page }) => {
  await openCalendar(page);
  const input = calendar(page).getByRole("textbox", { name: "New to-do" });
  await input.fill("Buy pens");
  await input.press("Enter");
  await expect(input).toHaveValue("");
  const row = calendar(page).getByRole("button", { name: /^Buy pens, No date\. Edit$/ });
  await expect(row).toBeVisible();
  await calendar(page).getByRole("checkbox", { name: "Done: Buy pens" }).click();
  await expect(calendar(page).getByRole("button", { name: /^Completed \(1\)/ })).toBeVisible();
  expect(await stored(page, "todos")).toMatchObject([{ title: "Buy pens", done: true }]);
  await page.reload({ waitUntil: "networkidle" });
  await calendar(page).getByRole("button", { name: /^Completed \(1\)/ }).click();
  await calendar(page).getByRole("checkbox", { name: "Done: Buy pens" }).click();
  await expect(calendar(page).getByRole("checkbox", { name: "Done: Buy pens" })).toHaveAttribute("aria-checked", "false");
  await row.click();
  const dialog = page.getByRole("dialog", { name: "Edit entry" });
  await dialog.getByLabel(/^Due date/).fill("2026-11-26");
  await dialog.getByLabel(/^Due time/).fill("09:30");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(calendar(page).getByRole("button", { name: /^To-do: Buy pens, 09:30, saved in this browser\. Edit$/ })).toBeVisible();
});

test("a to-do needs a due date before it can have a time, and a bad end time is refused", async ({ page }) => {
  await openCalendar(page);
  await calendar(page).getByRole("button", { name: "Add to calendar or to-do" }).click();
  const dialog = page.getByRole("dialog", { name: "Add to calendar" });
  await dialog.getByRole("tab", { name: "To-do" }).click();
  await dialog.getByLabel(/^Due date/).fill("");
  await expect(dialog.getByLabel(/^Due time/)).toBeDisabled();
  await dialog.getByLabel(/^Due date/).fill("2026-11-26");
  await expect(dialog.getByLabel(/^Due time/)).toBeEnabled();
  await dialog.getByRole("tab", { name: "Event" }).click();
  await dialog.getByLabel("Title").fill("Late");
  await dialog.getByLabel("Date").fill("2026-11-26");
  await dialog.getByLabel("Starts").fill("17:00");
  await dialog.getByLabel("Ends").fill("16:00");
  await dialog.getByRole("button", { name: "Add to calendar" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("The end must be after the start.");
  expect(await stored(page, "personalEvents")).toEqual([]);
});

test("on a 320 px phone the sheet, the grid and the to-do list fit without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openCalendar(page);
  const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await fits();
  await calendar(page).getByRole("button", { name: "Add to calendar or to-do" }).click();
  const dialog = page.getByRole("dialog", { name: "Add to calendar" });
  await expect(dialog).toBeVisible();
  const outside = await dialog.evaluate((el) => [...el.querySelectorAll("input, button")].filter((c) => c.getBoundingClientRect().right > window.innerWidth + 1).map((c) => c.getAttribute("aria-label") ?? c.textContent));
  expect(outside).toEqual([]);
  await dialog.getByLabel("Title").fill("Phone entry");
  await dialog.getByLabel("Date").fill("2026-11-25");
  await dialog.getByLabel("Starts").fill("11:00");
  await dialog.getByRole("button", { name: "Add to calendar" }).click();
  await expect(dialog).toHaveCount(0);
  await calendar(page).getByRole("textbox", { name: "New to-do" }).fill("Phone todo with a rather long title to check that it wraps instead of overflowing the card");
  await calendar(page).getByRole("textbox", { name: "New to-do" }).press("Enter");
  await expect(calendar(page).getByRole("button", { name: /^Phone todo/ })).toBeVisible();
  await fits();
  const wide = await calendar(page).evaluate((el) => [...el.querySelectorAll("*")].filter((c) => c.getBoundingClientRect().right > el.getBoundingClientRect().right + 1).map((c) => `${c.tagName}.${String(c.className).slice(0, 40)}`));
  expect(wide).toEqual([]);
});
