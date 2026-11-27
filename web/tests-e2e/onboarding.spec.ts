import { test, expect } from "@playwright/test";

// A first visit: no saved onboarding answer. Every other spec starts with the answer set to done.
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 800 }, isMobile: false });

const sheet = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "Connect your campus systems" });

test("first visit shows the sheet, with no field for a student ID or password", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const dialog = sheet(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Connect your campus systems" })).toBeVisible();
  await expect(dialog.getByRole("checkbox")).toHaveCount(4);
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
  await expect(dialog.getByText(/invented/).first()).toBeVisible();
});

test("Skip for now closes it, connects nothing and stays closed after a reload", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await sheet(page).getByRole("button", { name: "Skip for now" }).click();
  await expect(sheet(page)).toBeHidden();
  await page.reload({ waitUntil: "networkidle" });
  await expect(sheet(page)).toBeHidden();
  await page.goto("/connections", { waitUntil: "networkidle" });
  await expect(page.getByText("Not connected", { exact: true })).toHaveCount(4);
});

test("Escape counts as skipping", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeHidden();
  await page.reload({ waitUntil: "networkidle" });
  await expect(sheet(page)).toBeHidden();
});

test("Allow connects all four, shows what was read, and Done does not bring it back", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const dialog = sheet(page);
  await dialog.getByRole("button", { name: "Allow and connect all four" }).click();
  await expect(dialog.getByRole("heading", { name: "You are connected" })).toBeVisible();
  await expect(dialog.getByText("Connected", { exact: true })).toHaveCount(4);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await page.reload({ waitUntil: "networkidle" });
  await expect(sheet(page)).toBeHidden();
  await page.goto("/connections", { waitUntil: "networkidle" });
  await expect(page.getByText("Connected", { exact: true })).toHaveCount(4);
});

test("switching a row off leaves that system disconnected", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const dialog = sheet(page);
  await dialog.getByRole("checkbox", { name: /Finance Office/ }).uncheck();
  await dialog.getByRole("button", { name: "Allow and connect 3 systems" }).click();
  await expect(dialog.getByRole("heading", { name: "You are connected" })).toBeVisible();
  await expect(dialog.getByText("Connected", { exact: true })).toHaveCount(3);
  await expect(dialog.getByText("Not connected", { exact: true })).toHaveCount(1);
});

test("with every row off, Allow is unavailable and Skip still works", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const dialog = sheet(page);
  for (const box of await dialog.getByRole("checkbox").all()) await box.uncheck();
  await expect(dialog.getByRole("button", { name: "Choose a system to connect" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Skip for now" }).click();
  await expect(dialog).toBeHidden();
});

test("blocked storage keeps the sheet open with a message, never a success", async ({ page }) => {
  await page.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "compass:connections:v1") throw new Error("blocked");
      return real.call(this, key, value);
    };
  });
  await page.goto("/", { waitUntil: "networkidle" });
  const dialog = sheet(page);
  await dialog.getByRole("button", { name: "Allow and connect all four" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Could not save the connections");
  await expect(dialog.getByRole("heading", { name: "Connect your campus systems" })).toBeVisible();
});

test("Reset demo brings it back, and the presenter console and other pages never show it", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await sheet(page).getByRole("button", { name: "Skip for now" }).click();
  await expect(sheet(page)).toBeHidden();
  await page.getByRole("button", { name: "Reset demo" }).first().click();
  await expect(sheet(page)).toBeVisible();
  await sheet(page).getByRole("button", { name: "Skip for now" }).click();
  await page.goto("/demo", { waitUntil: "networkidle" });
  await expect(sheet(page)).toHaveCount(0);

  await page.evaluate(() => localStorage.removeItem("compass:onboarding:v1"));
  await page.goto("/connections", { waitUntil: "networkidle" });
  await expect(sheet(page)).toHaveCount(0);
  await page.goto("/demo", { waitUntil: "networkidle" });
  await expect(sheet(page)).toHaveCount(0);
});

test("Plan my week opens the assistant", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await sheet(page).getByRole("button", { name: "Allow and connect all four" }).click();
  await sheet(page).getByRole("button", { name: /Plan my week/ }).click();
  await expect(page.getByRole("dialog", { name: "Compass assistant" })).toBeVisible();
  // Focus must stay in the assistant, not return to a control behind it when the first-run sheet finishes closing.
  await page.waitForTimeout(1200);
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]')?.getAttribute("aria-label"))).toBe("Compass assistant");
});

test("after Reset demo, Plan my week still leaves focus in the assistant", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await sheet(page).getByRole("button", { name: "Skip for now" }).click();
  await expect(sheet(page)).toBeHidden();
  await page.getByRole("button", { name: "Reset demo" }).first().click();
  await sheet(page).getByRole("button", { name: "Allow and connect all four" }).click();
  await sheet(page).getByRole("button", { name: /Plan my week/ }).click();
  await expect(page.getByRole("dialog", { name: "Compass assistant" })).toBeVisible();
  await page.waitForTimeout(1200);
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]')?.getAttribute("aria-label"))).toBe("Compass assistant");
});

test("fits at 320 px with the buttons reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/", { waitUntil: "networkidle" });
  const dialog = sheet(page);
  await expect(dialog).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(dialog.getByRole("button", { name: "Allow and connect all four" })).toBeInViewport();
  await expect(dialog.getByRole("button", { name: "Skip for now" })).toBeInViewport();
});
