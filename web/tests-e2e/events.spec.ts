import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false });

const PROMPT = "Book 3 classrooms, 30 plastic chairs, 10 banquet tables and 2 megaphones for our Robotics Demo Night on 10 December from 4pm to 10pm, 80 people. The Robotics & AI Society is organising it.";

async function askAgent(page: Page, text: string) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await dialog.getByRole("button", { name: "Demo", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Message Compass" }).fill(text);
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  return dialog;
}

async function submitViaAgent(page: Page) {
  const dialog = await askAgent(page, PROMPT);
  const card = dialog.getByRole("region", { name: "Club event application ready to review" });
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card.getByText("Not submitted")).toBeVisible();
  await card.getByRole("button", { name: "Review and submit" }).click();
  const form = page.getByRole("dialog", { name: "Club event application" });
  await expect(form).toBeVisible();
  await expect(dialog).toBeHidden(); // one sheet at a time
  await expect(form.getByLabel("Event name")).toHaveValue("Robotics Demo Night");
  await expect(form.getByLabel("Organising club or clubs")).toHaveValue("Robotics & AI Society");
  return form;
}

test("the agent turns plain words into one application, and nothing is saved until the student submits", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const form = await submitViaAgent(page);

  // the adviser is the one thing only the student knows, so Submit waits for it
  await form.getByRole("button", { name: "Review", exact: false }).first().click();
  await expect(form.getByRole("button", { name: "Submit application" })).toBeDisabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("xmum-compass:v1") ?? "{}").eventApplications ?? [])).toHaveLength(0);

  await form.getByRole("button", { name: /1\. Event/ }).click();
  await form.getByLabel("Adviser's name").fill("Dr. Lim (demo)");
  await form.getByLabel("Adviser's email").fill("lim@demo.invalid");
  await form.getByRole("button", { name: /5\. Review/ }).click();
  await expect(form.getByText(/Nothing to a real office|sends nothing to a real office/)).toBeVisible();
  await form.getByRole("button", { name: "Submit application" }).click();
  await expect(form).toBeHidden();
  await expect(page).toHaveURL(/section=events/);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("xmum-compass:v1") ?? "{}").eventApplications);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ id: "DEMO-EVT-0001", name: "Robotics Demo Night", participants: 80, date: "2026-12-10" });
  expect(saved[0].lines).toHaveLength(6);
  expect(JSON.stringify(saved)).not.toMatch(/xmu\.edu\.my/);
  await expect(page.getByText("DEMO-EVT-0001", { exact: true })).toBeVisible();
  await expect(page.getByText("0 of 6 lines answered. 6 still waiting.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a room another club already holds is caught before submitting", async ({ page }) => {
  const dialog = await askAgent(page, "Reserve B1-B08 for our club event, the Open Mic Rematch, on 4 December from 6pm to 10pm for 80 people. The Music & Band Club is organising it.");
  const card = dialog.getByRole("region", { name: "Club event application ready to review" });
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card.getByText(/already approved for Music & Band Club/)).toBeVisible();
  await card.getByRole("button", { name: "Review and submit" }).click();
  const form = page.getByRole("dialog", { name: "Club event application" });
  await form.getByRole("button", { name: /5\. Review/ }).click();
  await expect(form.getByRole("button", { name: "Submit application" })).toBeDisabled();
  await expect(form.getByText(/is already approved for Music & Band Club/).first()).toBeVisible();
});

test("a library study room request still goes to the library", async ({ page }) => {
  const dialog = await askAgent(page, "Book a study room for 2 tomorrow at 3pm");
  await expect(dialog.getByRole("region", { name: "Library rooms you can book" })).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByRole("region", { name: "Club event application ready to review" })).toHaveCount(0);
});

test("the ECA desk answers one application line by line, Compass shows each answer and the room swap, and the slip downloads", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const form = await submitViaAgent(page);
  await form.getByLabel("Adviser's name").fill("Dr. Lim (demo)");
  await form.getByLabel("Adviser's email").fill("lim@demo.invalid");
  await form.getByRole("button", { name: /5\. Review/ }).click();
  await form.getByRole("button", { name: "Submit application" }).click();
  await expect(form).toBeHidden();
  // sit on Home, not on the Club events page, so the banner has to carry the news
  await page.goto("/", { waitUntil: "networkidle" });

  const desk = await context.newPage();
  const deskErrors: string[] = [];
  desk.on("pageerror", (error) => deskErrors.push(error.message));
  await desk.goto("/demo/eca", { waitUntil: "networkidle" });
  await expect(desk.getByRole("heading", { name: "ECA Event Applications" })).toBeVisible();
  // the queue holds the other clubs' invented applications and this one
  await expect(desk.getByRole("list", { name: "Applications waiting for the ECA office" }).getByRole("listitem")).toHaveCount(6);
  await desk.getByRole("button", { name: /DEMO-EVT-0001/ }).click();
  await expect(desk.getByRole("heading", { name: "Robotics Demo Night" })).toBeVisible();

  await desk.getByRole("button", { name: /Approve 6 that pass the checks/ }).click();
  const megaphone = desk.getByRole("listitem").filter({ hasText: "2 x Megaphone" });
  await megaphone.getByRole("button", { name: "Reject" }).click();
  await megaphone.getByLabel(/Remark for the club/).fill("None free that day.");
  const room = desk.getByRole("listitem").filter({ hasText: "B1-212, Classroom" });
  await room.getByRole("button", { name: "With condition" }).click();
  await room.getByLabel("Room given").selectOption("B1-B08");
  await expect(room.getByLabel(/Remark for the club/)).toHaveValue("You asked for B1-212. B1-B08 is given instead.");
  await desk.getByRole("button", { name: /Send one decision \(6 lines\)/ }).click();
  await expect(desk.getByRole("status").getByText(/One decision sent for Robotics Demo Night/)).toBeVisible();
  await expect(desk.getByRole("status").getByText(/Approve With Condition/)).toBeVisible();

  const stored = await desk.evaluate(() => JSON.parse(localStorage.getItem("compass:eca-decisions:v1") ?? "{}"));
  expect(stored["DEMO-EVT-0001"].eventStatus).toBe("Approve With Condition");
  expect(stored["DEMO-EVT-0001"].lines.v1.assignedVenueId).toBe("B1-B08");
  expect(Object.keys(stored)).toEqual(["DEMO-EVT-0001"]); // the invented answers are never copied into saved data

  // Compass, same browser: the banner and the page show it, with no reload
  await page.bringToFront();
  await expect(page.getByRole("status").getByText(/The ECA office answered Robotics Demo Night: Approve With Condition/)).toBeVisible({ timeout: 8000 });
  await page.getByRole("link", { name: "View booking" }).click();
  await expect(page).toHaveURL(/section=events/);
  await expect(page.getByRole("status").getByText(/The ECA office answered/)).toBeHidden(); // told once
  await expect(page.getByText("You asked for B1-212. You were given B1-B08.")).toBeVisible();
  await expect(page.getByText("Every line has an answer.")).toBeVisible();
  const card = page.getByRole("listitem").filter({ hasText: "DEMO-EVT-0001" }).first();
  await expect(card.getByText("None free that day.")).toBeVisible();
  await expect(card.getByText("Collect from LG-B12.")).toHaveCount(2); // chairs and tables, once each

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download booking slip/ }).click()]);
  expect(download.suggestedFilename()).toBe("booking-slip-DEMO-EVT-0001.pdf");

  // a revision after the first decision is a new thing to tell the student, who waits on Home this time
  await page.goto("/", { waitUntil: "networkidle" });
  await desk.bringToFront();
  await desk.getByRole("button", { name: /DEMO-EVT-0001/ }).click();
  await desk.getByRole("listitem").filter({ hasText: "2 x Megaphone" }).getByRole("button", { name: "With condition" }).click();
  await desk.getByRole("listitem").filter({ hasText: "2 x Megaphone" }).getByLabel("Number approved").fill("1");
  await desk.getByRole("button", { name: /Send one decision \(1 line\)/ }).click();
  await page.bringToFront();
  await expect(page.getByRole("status").getByText(/The ECA office answered Robotics Demo Night/)).toBeVisible({ timeout: 8000 });

  // the desk can take its decision back
  await desk.bringToFront();
  await desk.getByRole("button", { name: "Undo" }).last().click();
  await expect(desk.getByText("Decision taken back.")).toBeVisible();
  const after = await desk.evaluate(() => JSON.parse(localStorage.getItem("compass:eca-decisions:v1") ?? "{}"));
  expect(after["DEMO-EVT-0001"].lines.i3.status).toBe("Rejected"); // back to the first decision, not to nothing
  expect(errors).toEqual([]);
  expect(deskErrors).toEqual([]);
});

test("the form works at 320px wide without sideways scrolling, and the desk queue too", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/hub?section=events", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Fill in the form" }).click();
  const form = page.getByRole("dialog", { name: "Club event application" });
  await expect(form).toBeVisible();
  for (const step of [/1\. Event/, /2\. Rooms/, /3\. Items/, /4\. Arrangements/, /5\. Review/]) {
    await form.getByRole("button", { name: step }).click();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `page overflows sideways on ${step}`).toBeLessThanOrEqual(0);
    const box = await form.boundingBox();
    expect(box && box.width).toBeLessThanOrEqual(320);
  }
  await form.getByRole("button", { name: "Close" }).click();

  const desk = await context.newPage();
  await desk.setViewportSize({ width: 320, height: 640 });
  await desk.goto("/demo/eca", { waitUntil: "networkidle" });
  await desk.getByRole("button", { name: /DEMO-EVT-0103/ }).click();
  const over = await desk.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
  await expect(desk.getByRole("button", { name: "Back to queue" })).toBeVisible();
});
