import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false });

const open = async (page: Page, query = "") => {
  await page.goto(`/hub?section=electives${query}`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "General electives" })).toBeVisible();
};
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("xmum-compass:v1") ?? "{}").electives ?? null);

test("a suggested set fits, adds up, and is saved only when the student saves it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  await expect(page.getByText("No electives chosen yet")).toBeVisible();
  await expect(page.getByText("You may take Business and Arts electives, not Science ones.")).toBeVisible();

  await page.getByRole("button", { name: "Use this set" }).first().click();
  await expect(page.getByText(/No clashes\./)).toBeVisible();
  await expect(page.getByText(/4 of 4 credits/)).toBeVisible();
  await expect(page.getByText("In your choices")).toBeVisible();
  expect(await saved(page)).toBeNull();

  // the summary with Save stays in view while scrolling the long list
  await page.getByRole("heading", { name: "All electives" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Save shortlist" })).toBeInViewport();
  await page.getByRole("button", { name: "Save shortlist" }).click();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeDisabled();
  const s = await saved(page);
  expect(s.target).toBe(4);
  expect(s.codes.length).toBeGreaterThan(0);

  // it is still there after a reload, and Courses shows it
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByText("Saved in this browser, not registered.")).toBeVisible();
  await page.goto("/courses", { waitUntil: "networkidle" });
  await expect(page.getByText(s.codes[0]).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("a clash between two electives in some weeks is shown on both, and saving waits until it is fixed", async ({ page }) => {
  await open(page);
  await page.getByRole("textbox", { name: "Search electives" }).fill("GEA1");
  await page.getByRole("button", { name: "Add GEA1305 to your choices" }).click();
  await page.getByRole("button", { name: "Add GEA1402 to your choices" }).click();
  await expect(page.getByText("1 clash to fix.")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "GEA1305" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save shortlist" })).toBeDisabled();
  await expect(page.getByText("Clashes with GEA1305 Film Appreciation, Thu 16:00, weeks 8 to 14").first()).toBeVisible();
  await expect(page.getByRole("img", { name: /clashes/ }).first()).toBeVisible();

  // a course that clashes with a core class cannot be added at all
  await page.getByRole("textbox", { name: "Search electives" }).fill("GEA1101");
  await expect(page.getByText("Clashes with CST1202 Lecture, Mon 10:00")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add GEA1101 to your choices" })).toBeDisabled();

  await page.getByRole("button", { name: "Remove GEA1402" }).click();
  await expect(page.getByText(/No clashes\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save shortlist" })).toBeEnabled();
});

test("the stream rule hides own-stream electives and locks them when shown", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("button", { name: /GES1203 to your choices/ })).toHaveCount(0);
  await page.getByRole("tab", { name: "All streams" }).click();
  await expect(page.getByRole("button", { name: "Add GES1203 to your choices" })).toBeDisabled();
  // the demo can show the rule for another stream, but saving stays off
  await page.getByRole("tab", { name: "Arts", exact: true }).click();
  await expect(page.getByText("You may take Science and Business electives, not Arts ones.")).toBeVisible();
  await page.getByRole("button", { name: "Use this set" }).first().click();
  await expect(page.getByText("Saving is off while you view another stream.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save shortlist" })).toBeDisabled();
});

test("credits and interests carry over from a link, and the credit stepper changes the suggestions", async ({ page }) => {
  await open(page, "&credits=2&likes=languages");
  await expect(page.getByLabel("2 credits")).toBeVisible();
  await expect(page.getByRole("button", { name: "Languages" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("2 credits", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "One credit more" }).click();
  await expect(page.getByLabel("3 credits")).toBeVisible();
  for (const card of await page.getByRole("article").filter({ hasText: "Use this set" }).all()) await expect(card.getByText("3 credits", { exact: true })).toBeVisible();
});

test("asking Compass in plain words gives a set that fits and a link to the planner", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await dialog.getByRole("button", { name: "Demo", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Message Compass" }).fill("Which electives fit my timetable? I need 4 credits and like languages");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  const link = dialog.getByRole("link", { name: "Open GE planner" });
  await expect(link).toBeVisible({ timeout: 15000 });
  await link.click();
  await expect(page).toHaveURL(/section=electives&credits=4&likes=languages/);
  await expect(page.getByRole("button", { name: "Languages" })).toHaveAttribute("aria-pressed", "true");
});

test.describe("small screens", () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  test("the GE planner fits 320px", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Use this set" }).first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    // and at 200% text size
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
});
