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

test("Gemini model chooser sends only the selected allowlisted model", async ({ page }) => {
  const requested: string[] = [];
  await page.route("**/api/agent", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, model: "gemini-2.5-flash", data: "fictional_demo" }) });
      return;
    }
    const body = route.request().postDataJSON() as { model?: string };
    requested.push(body.model ?? "missing");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      mode: "gemini", model: body.model, text: "Fictional demo answer.", tools: [], cards: [], saved: false,
    }) });
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask Compass" }).click();
  const assistant = page.getByRole("dialog", { name: "Compass assistant" });
  const models = assistant.getByRole("combobox", { name: "Gemini model" });
  await expect(models).toHaveValue("gemini-2.5-flash");
  await models.selectOption("gemini-4-hydrogen");
  await expect(assistant.getByText(/Hydrogen may take longer/)).toBeVisible();
  await assistant.getByRole("textbox", { name: "Message Compass" }).fill("What is due tomorrow?");
  await assistant.getByRole("button", { name: "Send", exact: true }).click();
  await expect(assistant.getByText("Fictional demo answer.")).toBeVisible();
  expect(requested).toEqual(["gemini-4-hydrogen"]);

  await models.selectOption("gemini-2.5-flash");
  await assistant.getByRole("textbox", { name: "Message Compass" }).fill("What about next week?");
  await assistant.getByRole("button", { name: "Send", exact: true }).click();
  await expect(assistant.getByText("What about next week?")).toBeVisible();
  expect(requested).toEqual(["gemini-4-hydrogen", "gemini-2.5-flash"]);
});
