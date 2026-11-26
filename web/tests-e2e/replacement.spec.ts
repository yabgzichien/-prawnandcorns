import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false });

async function openDesk(page: Page) {
  await page.goto("/demo/lecturer", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Replacement Classes" })).toBeVisible();
}

test("the lecturer sets a replacement, the student is told and sees it in the timetable, and Undo takes it back", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // the student waits on Home, so the banner has to carry the news
  await page.goto("/", { waitUntil: "networkidle" });

  const desk = await context.newPage();
  desk.on("pageerror", (error) => errors.push(error.message));
  await openDesk(desk);
  const classes = desk.getByRole("radiogroup", { name: "Class to replace" });
  await expect(classes.getByRole("radio", { name: /CST1101 Lecture/ })).toBeDisabled(); // Monday's lecture is already taught
  await expect(classes.getByRole("radio", { name: /CST1101 Tutorial/ })).toHaveAttribute("aria-checked", "true");

  // the desk suggests the time the whole class is free, and says only counts
  await expect(desk.getByRole("button", { name: /Best.*Wed 25 Nov, 13:00.*36 of 36 free/ })).toBeVisible();
  await expect(desk.getByText("Every student is free by their timetable.")).toBeVisible();
  await expect(desk.getByText(/Only counts are shown/)).toBeVisible();
  // a time the lecturer teaches elsewhere is blocked, with the reason
  await expect(desk.getByRole("button", { name: /Tue 24 Nov, 14:00 to 15:00\. Not possible/ })).toBeVisible();

  await desk.getByRole("button", { name: "Set as replacement" }).click();
  const modal = desk.getByRole("dialog", { name: "Publish the replacement?" });
  await expect(modal.getByText("Wed 25 Nov, 13:00 to 14:00")).toBeVisible();
  await modal.getByRole("button", { name: "Publish to 36 students" }).click();
  await expect(desk.getByRole("status").getByText(/Replacement set for Wed 25 Nov, 13:00 to 14:00 in A2-104/)).toBeVisible();
  const stored = await desk.evaluate(() => JSON.parse(localStorage.getItem("compass:replacements:v1") ?? "[]"));
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ id: "DEMO-RPL-0001", sessionId: "c11", status: "scheduled", chosen: { day: 2, start: "13:00", room: "A2-104" } });

  // Compass, same browser, no reload
  await page.bringToFront();
  const banner = page.getByRole("status").getByText("CST1101 replacement class set: Wed 25 Nov, 13:00 to 14:00 in A2-104.");
  await expect(banner).toBeVisible({ timeout: 8000 });
  await page.getByRole("link", { name: "View class" }).click();
  await expect(page).toHaveURL(/section=timetable/);
  await expect(banner).toBeHidden(); // told once
  const panel = page.getByRole("region", { name: "Replacement classes" });
  await expect(panel.getByText("Replacement set")).toBeVisible();
  await expect(panel.getByText("CST1101 tutorial on Fri 27 Nov is cancelled")).toBeVisible();
  await expect(panel.getByText("Wednesday 25 Nov")).toBeVisible();
  await panel.getByRole("button", { name: "Show in timetable" }).click();
  await expect(page.getByText("Replacement class", { exact: true }).first()).toBeVisible();

  const [ics] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: "Add to calendar" }).click()]);
  expect(ics.suggestedFilename()).toBe("CST1101-replacement.ics");

  // the lecturer takes it back: Compass returns to the usual time
  await desk.bringToFront();
  await desk.getByRole("button", { name: "Undo" }).click();
  await expect(desk.getByRole("status").getByText(/Taken back/)).toBeVisible();
  await page.bringToFront();
  await expect(page.getByRole("region", { name: "Replacement classes" })).toBeHidden({ timeout: 8000 });
  expect(errors).toEqual([]);
});

test("the lecturer asks about a shortlist, the student answers, and the lecturer sets the time from the answers", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/", { waitUntil: "networkidle" });

  const desk = await context.newPage();
  await openDesk(desk);
  await desk.getByRole("button", { name: "Public holiday" }).click();
  await expect(desk.getByRole("button", { name: "Add at least 2 times to ask" })).toBeDisabled();
  const chips = desk.getByRole("button", { name: /of 36 free/ });
  await chips.nth(0).click();
  await desk.getByRole("button", { name: "Add to shortlist to ask students" }).click();
  await expect(desk.getByRole("button", { name: "In your shortlist" })).toBeDisabled();
  await chips.nth(1).click();
  await desk.getByRole("button", { name: "Add to shortlist to ask students" }).click();
  await desk.getByRole("button", { name: "Ask students about 2 times" }).click();
  await desk.getByRole("dialog", { name: "Ask the students?" }).getByRole("button", { name: "Ask 36 students" }).click();
  await expect(desk.getByText("The demo student has not answered in Compass yet.").first()).toBeVisible();

  await page.bringToFront();
  await expect(page.getByRole("status").getByText("Dr. Lim (demo) asks which times work for a CST1101 replacement class.")).toBeVisible({ timeout: 8000 });
  await page.getByRole("link", { name: "Answer" }).click();
  const panel = page.getByRole("region", { name: "Replacement classes" });
  await expect(panel.getByText("Your answer needed")).toBeVisible();
  await expect(panel.getByText("Free in your timetable").first()).toBeVisible();
  // Compass suggests from the timetable, the student decides
  const first = panel.getByRole("group").first();
  await expect(first.getByRole("button", { name: "Works" })).toHaveAttribute("aria-pressed", "true");
  await panel.getByRole("group").nth(1).getByRole("button", { name: "Can’t" }).click();
  await panel.getByRole("button", { name: "Send answer" }).click();
  await expect(page.getByText(/Answer saved: 1 of 2 times work for you/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Answer saved" })).toBeDisabled();
  const answers = await page.evaluate(() => JSON.parse(localStorage.getItem("compass:replacement-answers:v1") ?? "{}"));
  expect(Object.values(answers["DEMO-RPL-0001"].works)).toEqual([true, false]);

  await desk.bringToFront();
  await expect(desk.getByText("Includes the answer sent from Compass (works).")).toBeVisible({ timeout: 8000 });
  await expect(desk.getByText("Includes the answer sent from Compass (does not work).")).toBeVisible();
  await desk.getByRole("button", { name: "Set this time" }).first().click();
  await desk.getByRole("dialog", { name: "Publish the replacement?" }).getByRole("button", { name: "Publish to 36 students" }).click();
  await expect(desk.getByText(/Replacement set: .* in /)).toBeVisible();

  await page.bringToFront();
  await expect(panel.getByText("Replacement set")).toBeVisible({ timeout: 8000 });
  await expect(panel.getByText("Your answer needed")).toBeHidden();
  expect(errors).toEqual([]);
});

test("an answer to an earlier request does not count once the lecturer asks again", async ({ page, context }) => {
  await page.goto("/hub?section=timetable", { waitUntil: "networkidle" });
  const desk = await context.newPage();
  await openDesk(desk);
  const ask = async () => {
    const chips = desk.getByRole("button", { name: /of 36 free/ });
    for (const i of [0, 1]) { await chips.nth(i).click(); await desk.getByRole("button", { name: "Add to shortlist to ask students" }).click(); }
    await desk.getByRole("button", { name: "Ask students about 2 times" }).click();
    await desk.getByRole("dialog", { name: "Ask the students?" }).getByRole("button", { name: "Ask 36 students" }).click();
  };
  await ask();
  await page.bringToFront();
  const panel = page.getByRole("region", { name: "Replacement classes" });
  await panel.getByRole("button", { name: "Send answer" }).click();
  await desk.bringToFront();
  await expect(desk.getByText(/Includes the answer sent from Compass/).first()).toBeVisible({ timeout: 8000 });
  await desk.getByRole("button", { name: "Withdraw" }).click();
  // wait for the request card to leave, so the time chips have stopped moving
  await expect(desk.getByRole("status").getByText(/Withdrawn/)).toBeVisible();
  await expect(desk.getByRole("button", { name: "Set this time" })).toHaveCount(0);
  await ask();
  await expect(desk.getByText("The demo student has not answered in Compass yet.").first()).toBeVisible();
  await page.bringToFront();
  await expect(panel.getByRole("button", { name: "Send answer" })).toBeEnabled({ timeout: 8000 });
});

test.describe("small screens", () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  test("the lecturer desk and the student's replacement card fit 320px", async ({ page }) => {
    await openDesk(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.getByRole("button", { name: "Set as replacement" }).click();
    await page.getByRole("button", { name: "Publish to 36 students" }).click();
    await page.goto("/hub?section=timetable", { waitUntil: "networkidle" });
    await expect(page.getByRole("region", { name: "Replacement classes" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.goto("/demo/lecturer", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
});
