import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false });

/**
 * Library availability is a fixed pattern, so these tests pick slots known to be free on the demo clock
 * (Monday 23 Nov 13:20): N205 09:00 and N206 13:00 on Wednesday 25 Nov.
 */
async function openLibrary(page: Page) {
  await page.goto("/library", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Study rooms" })).toBeVisible();
  await page.getByRole("tab", { name: /Wed.*25 Nov/ }).click();
}

async function bookN205(page: Page) {
  await openLibrary(page);
  await page.getByRole("button", { name: "N205, 09:00 to 11:00, available" }).click();
  const dialog = page.getByRole("dialog", { name: "Book N205" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm booking" }).click();
  await expect(dialog).toBeHidden();
}

test("book a room with the map pulled out, hit the one-per-day rule, then cancel", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openLibrary(page);

  await page.getByRole("button", { name: "N205, 09:00 to 11:00, available" }).click();
  const dialog = page.getByRole("dialog", { name: "Book N205" });
  await expect(dialog.getByText("A3 Library, Level 2, North wing")).toBeVisible();
  await expect(dialog.getByRole("application", { name: /Interactive campus map/ })).toBeVisible();
  await expect(dialog.getByRole("img", { name: /Schematic floor plan of Level 2\. Room N205 is in the North wing/ })).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Open the full campus map/ })).toHaveAttribute("href", /focus=N205/);
  await dialog.getByRole("button", { name: "Confirm booking" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: /Booked Silent study room N205/ })).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("xmum-compass:v1") ?? "{}").bookings);
  expect(saved).toEqual([{ id: "lb-N205-2026-11-25-0", roomId: "N205", date: "2026-11-25", slot: 0 }]);

  // a second slot on the same day is refused by the rules
  await page.getByRole("button", { name: "N206, 13:00 to 15:00, available" }).click();
  const second = page.getByRole("dialog", { name: "Book N206" });
  await expect(second.getByRole("alert")).toContainText(/one two-hour slot per day/);
  await expect(second.getByRole("button", { name: "Confirm booking" })).toBeDisabled();
  await second.getByRole("button", { name: "Not now" }).click();

  await page.getByRole("tab", { name: /My bookings \(1\)/ }).click();
  const mine = page.getByRole("list", { name: "My library bookings" });
  await expect(mine).toContainText("Silent study room N205");
  await expect(mine).toContainText("Wed 25 Nov, 09:00 to 11:00");
  await mine.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("No rooms booked")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("xmum-compass:v1") ?? "{}").bookings)).toEqual([]);
  expect(errors).toEqual([]);
});

test("the booking shows on Home and is saved across a reload", async ({ page }) => {
  await bookN205(page);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /My bookings \(1\)/ }).click();
  await expect(page.getByRole("list", { name: "My library bookings" })).toContainText("N205");
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("region", { name: "Reminders and calendar entries" })).toContainText("Silent study room N205");
});

test("when the library closes a room the student booked, the booking is flagged in Compass", async ({ page, context }) => {
  await bookN205(page);
  const consolePage = await context.newPage();
  await consolePage.goto("/demo/library", { waitUntil: "networkidle" });
  await consolePage.getByRole("button", { name: /Wed 25 Nov/ }).click();
  await expect(consolePage.getByLabel("N205 09:00 to 11:00, booked by your student")).toBeVisible();
  await consolePage.getByRole("listitem").filter({ hasText: /Close silent study room N205/ }).getByRole("button", { name: "Trigger" }).click();

  await page.getByRole("tab", { name: /My bookings \(1\)/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: /library has closed this room/ })).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole("button", { name: "Find another room" })).toBeVisible();
});

test("a fully booked evening: no room is offered at 17:00 tomorrow", async ({ page, context }) => {
  const consolePage = await context.newPage();
  await consolePage.goto("/demo", { waitUntil: "networkidle" });
  await consolePage.getByRole("listitem").filter({ hasText: /evening rush/ }).getByRole("button", { name: "Trigger" }).click();
  await page.goto("/library", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Tue.*24 Nov/ }).click();
  for (const tab of ["Silent", "Study", "Group", "Success"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(page.getByRole("button", { name: /17:00 to 19:00, available/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /19:00 to 21:00, available/ })).toHaveCount(0);
  }
  await page.getByRole("tab", { name: "Silent", exact: true }).click();
  await expect(page.getByRole("button", { name: /15:00 to 17:00, available/ }).first()).toBeVisible();
});

test.describe("narrow screens", () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  test("the booking sheet and its map fit 320px", async ({ page }) => {
    await openLibrary(page);
    await page.getByRole("button", { name: "N205, 09:00 to 11:00, available" }).click();
    const dialog = page.getByRole("dialog", { name: "Book N205" });
    await expect(dialog.getByRole("img", { name: /Schematic floor plan/ })).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(320);
    await dialog.getByRole("button", { name: "Not now" }).click();
    await expect(dialog).toBeHidden();
  });
});
