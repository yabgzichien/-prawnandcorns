import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false });

async function prepareViaAssistant(page: Page, problem: string) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await dialog.getByRole("button", { name: "Demo", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Message Compass" }).fill(problem);
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "AskA ticket ready to review" })).toBeVisible({ timeout: 15000 });
  return dialog;
}

test("a hostel fault goes to an AskA ticket, not an email, and the student reviews before submitting", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const dialog = await prepareViaAssistant(page, "The air-con in D3-512 is leaking water onto the floor");
  await expect(dialog.getByText(/reported on the AskA help desk, not by email/)).toBeVisible();
  const card = dialog.getByRole("region", { name: "AskA ticket ready to review" });
  await expect(card.getByText("Operation and Maintenance Office > Hostel maintenance > Air-conditioner")).toBeVisible();
  await expect(card.getByText("Not submitted")).toBeVisible();
  await expect(dialog.getByRole("link", { name: /mail/i })).toHaveCount(0);

  await dialog.getByRole("button", { name: "Review and submit" }).click();
  const form = page.getByRole("dialog", { name: "Submit an AskA ticket" });
  await expect(form).toBeVisible();
  await expect(dialog).toBeHidden(); // one sheet at a time
  await expect(form.getByLabel("Block", { exact: true })).toHaveValue("D3");
  await expect(form.getByLabel("Room number", { exact: true })).toHaveValue("512");
  await expect(form.getByText(/Nothing is sent to the real help desk/)).toBeVisible();
  await form.getByRole("button", { name: "Submit ticket" }).click();
  await expect(form).toBeHidden();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("xmum-compass:v1") ?? "{}").tickets);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ id: "T-1041", kind: "aircon", block: "D3", room: "512" });
  expect(errors).toEqual([]);
});

test("a ticket without a room is refused until the student adds one", async ({ page }) => {
  const dialog = await prepareViaAssistant(page, "My toilet is blocked and overflowing");
  await expect(dialog.getByText(/couldn't see your block and room number/)).toBeVisible();
  await dialog.getByRole("button", { name: "Review and submit" }).click();
  const form = page.getByRole("dialog", { name: "Submit an AskA ticket" });
  await form.getByRole("button", { name: "Submit ticket" }).click();
  await expect(form.getByRole("alert")).toContainText(/block and room number/);
  await form.getByLabel("Block", { exact: true }).selectOption("D4");
  await form.getByLabel("Room number", { exact: true }).fill("305");
  await form.getByRole("button", { name: "Submit ticket" }).click();
  await expect(form).toBeHidden();
});

test("the console schedules a technician, Compass shows it and adds the visit to the calendar", async ({ page, context }) => {
  const dialog = await prepareViaAssistant(page, "The air-con in D3-512 is not working");
  await dialog.getByRole("button", { name: "Review and submit" }).click();
  await page.getByRole("dialog", { name: "Submit an AskA ticket" }).getByRole("button", { name: "Submit ticket" }).click();

  const consolePage = await context.newPage();
  await consolePage.goto("/demo/aska", { waitUntil: "networkidle" });
  await expect(consolePage.getByText("T-1041")).toBeVisible();
  await consolePage.getByLabel("Visit time").selectOption({ label: "Thu 26 Nov, 09:00" });
  await consolePage.getByRole("button", { name: "Schedule technician" }).click();
  await expect(consolePage.getByText("Technician scheduled").first()).toBeVisible();

  await expect(page.getByRole("status").filter({ hasText: /AskA ticket T-1041 is now technician scheduled/ })).toBeVisible({ timeout: 8000 });
  await page.getByRole("link", { name: "View ticket" }).click();
  await expect(page.getByRole("heading", { name: "Hostel problems" })).toBeVisible();
  await expect(page.getByText(/Technician visit: Thu 26 Nov, 09:00/)).toBeVisible();
  await page.getByRole("button", { name: "Add to my calendar" }).click();
  await expect(page.getByRole("button", { name: /In your calendar/ })).toBeVisible();
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem("xmum-compass:v1") ?? "{}").personalEvents);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ start: "2026-11-26T09:00:00+08:00", place: "D3-512" });
  await expect(page.getByRole("status").filter({ hasText: /AskA ticket T-1041/ })).toHaveCount(0); // told once
});

test("the mail assistant points hostel repairs to AskA instead of drafting an email", async ({ page }) => {
  await page.goto("/mail", { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "What do you need?" }).fill("my hostel air-con is not working");
  const callout = page.getByRole("region", { name: "Hostel repairs go through AskA" });
  await expect(callout).toBeVisible();
  await callout.getByRole("button", { name: "Prepare AskA ticket" }).click();
  await expect(page.getByRole("dialog", { name: "Submit an AskA ticket" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("textbox", { name: "What do you need?" }).fill("I can't log in to Moodle");
  await expect(callout).toHaveCount(0);
});

test("the Help desk page reports a problem and lists tickets", async ({ page }) => {
  await page.goto("/helpdesk", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Hostel problems" })).toBeVisible();
  await page.getByRole("textbox", { name: "Describe the problem" }).fill("What is due this week");
  await page.getByRole("button", { name: "Prepare ticket" }).click();
  await expect(page.getByText(/does not look like a hostel fault/)).toBeVisible();
  await page.getByRole("button", { name: "Water is leaking from the ceiling" }).click();
  await page.getByRole("button", { name: "Prepare ticket" }).click();
  await expect(page.getByRole("dialog", { name: "Submit an AskA ticket" })).toBeVisible();
});
