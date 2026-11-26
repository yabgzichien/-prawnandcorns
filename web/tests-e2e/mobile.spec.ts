import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

test("all eight student pages fit a 320px screen", async ({ page }) => {
  const paths = ["/", "/timetable", "/assignments", "/map", "/courses", "/clubs", "/finance", "/mail"];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of paths) {
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.status(), `${path} should load`).toBe(200);
    const dimensions = await page.evaluate(() => ({
      layout: window.innerWidth,
      client: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.layout, `${path} should not expand the layout viewport`).toBe(320);
    expect(dimensions.document, `${path} should not scroll horizontally`).toBeLessThanOrEqual(320);
  }
  expect(errors).toEqual([]);
});

test("all eight pages reflow at 200% text size without horizontal page scrolling", async ({ page }) => {
  const paths = ["/", "/timetable", "/assignments", "/map", "/courses", "/clubs", "/finance", "/mail"];
  for (const path of paths) {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const dimensions = await page.evaluate(() => ({
      layout: window.innerWidth,
      document: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(dimensions.layout, `${path} should not expand the viewport under enlarged text`).toBe(320);
    expect(dimensions.document, `${path} should still fit the device viewport`).toBeLessThanOrEqual(320);
  }
});

test("study plan can be edited, validated, saved, reloaded and removed", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask Compass" }).click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await dialog.getByRole("button", { name: "Demo", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Message Compass" }).fill("Help me plan my week. I have a meeting on Wednesday evening.");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Proposed study plan" })).toBeVisible();
  await expect(dialog.getByText(/18:00.*21:00/).first()).toBeVisible();

  const inputs = dialog.locator('input[type="datetime-local"]');
  await expect(inputs).toHaveCount(6);
  const originalStart = await inputs.nth(0).inputValue();
  const originalEnd = await inputs.nth(1).inputValue();
  const confirm = dialog.getByRole("button", { name: "Confirm & save" });
  await inputs.nth(0).fill("2026-11-23T10:00");
  await inputs.nth(1).fill("2026-11-23T11:00");
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByRole("alert").first()).toContainText("overlaps");
  await inputs.nth(0).fill(originalStart);
  await inputs.nth(1).fill(originalEnd);
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(dialog.getByText(/saved in this browser/)).toBeVisible();
  await dialog.getByRole("button", { name: "Close assistant" }).click();

  const saved = page.locator('[aria-label="Confirmed study plan"] li');
  await expect(saved).toHaveCount(3);
  await page.reload({ waitUntil: "networkidle" });
  await expect(saved).toHaveCount(3);
  await saved.first().getByRole("button", { name: /Remove saved study session/ }).click();
  await page.reload({ waitUntil: "networkidle" });
  await expect(saved).toHaveCount(2);
});

test("storage failure does not claim the plan was saved", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask Compass" }).click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await dialog.getByRole("button", { name: "Demo", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Message Compass" }).fill("Help me plan my week. I have a meeting on Wednesday evening.");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Confirm & save" })).toBeEnabled();
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "xmum-compass:v1") throw new DOMException("Storage is full", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  });
  await dialog.getByRole("button", { name: "Confirm & save" }).click();
  await expect(dialog.getByRole("alert").first()).toContainText("Unable to save in this browser");
  await expect(dialog.getByRole("button", { name: "Confirm & save" })).toBeVisible();
});

test("rejecting a plan never creates a saved Home schedule", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask Compass" }).click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await dialog.getByRole("button", { name: "Demo", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Message Compass" }).fill("Help me plan my week. I have a meeting on Wednesday evening.");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Proposed study plan" })).toBeVisible();
  await dialog.getByRole("button", { name: "Reject plan" }).click();
  await expect(dialog.getByText("Plan rejected. Nothing was saved.")).toBeVisible();
  await dialog.getByRole("button", { name: "Close assistant" }).click();
  await expect(page.getByRole("heading", { name: "Your study plan" })).toHaveCount(0);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Your study plan" })).toHaveCount(0);
});

test("connecting Moodle asks for consent, never a password, and only connects after Allow", async ({ page }) => {
  await page.goto("/assignments", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Connect Moodle" }).click();
  const dialog = page.getByRole("dialog", { name: "Connect Moodle" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
  await expect(dialog.getByText("Compass would like to read")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Moodle demo connected", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Connect Moodle" }).click();
  await dialog.getByRole("button", { name: "Allow" }).click();
  await expect(page.getByText("Moodle demo connected", { exact: true })).toBeVisible();
});

test("modal keeps keyboard focus inside and returns it to the launcher on Escape", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const launcher = page.getByRole("button", { name: "Ask Compass" });
  await launcher.click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(launcher).toBeFocused();
});
