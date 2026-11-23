import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 }, isMobile: false });

test("desktop dashboard and keyboard assistant access work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog", { name: "Compass assistant" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Compass assistant" })).toBeHidden();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(1280);
  expect(errors).toEqual([]);
});

test("invalid cross-origin requests do not access the Gemini endpoint", async ({ request }) => {
  const response = await request.post("/api/agent", {
    data: JSON.stringify({ prompt: "Hello" }),
    headers: { "Content-Type": "application/json", Origin: "http://untrusted.example" },
  });
  expect(response.status()).toBe(403);
});
