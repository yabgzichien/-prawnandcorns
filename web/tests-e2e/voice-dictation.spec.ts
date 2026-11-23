import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

/** Browser speech engines are not reliable in CI and require real microphones.
 * Stub only the browser recognition boundary; test the actual chat UI and state.
 */
async function installSpeechMock(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    class FakeSpeechRecognition {
      static current: FakeSpeechRecognition;
      lang = "";
      continuous = true;
      interimResults = false;
      maxAlternatives = 0;
      onstart: (() => void) | null = null;
      onresult: ((event: { resultIndex: number; results: Array<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      aborted = 0;
      stopped = 0;
      constructor() { FakeSpeechRecognition.current = this; }
      start() { this.onstart?.(); }
      stop() { this.stopped++; this.onend?.(); }
      abort() { this.aborted++; this.onend?.(); }
      emit(text: string, isFinal: boolean) {
        this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript: text } }] });
      }
      error(error: string) { this.onerror?.({ error }); }
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: FakeSpeechRecognition });
    Object.assign(window, { __testSpeech: FakeSpeechRecognition });
  });
}

test("voice dictation previews, preserves typed text, and never auto-sends", async ({ page }) => {
  await installSpeechMock(page);
  let postCount = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/agent")) postCount++;
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask Compass" }).click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await dialog.getByRole("button", { name: "Demo", exact: true }).click();
  const input = dialog.getByRole("textbox", { name: "Message Compass" });
  await input.fill("Help me");
  await dialog.getByRole("button", { name: "Start voice dictation" }).click();
  await expect(dialog.getByRole("button", { name: "Stop voice dictation" })).toHaveAttribute("aria-pressed", "true");
  await expect(input).toHaveAttribute("readonly");
  await expect(dialog.getByRole("status").last()).toContainText("Listening");
  await expect(dialog.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.evaluate(() => {
    const Speech = (window as unknown as { __testSpeech: { current: { emit(text: string, final: boolean): void } } }).__testSpeech;
    Speech.current.emit("plan my", false);
  });
  await expect(dialog.getByRole("status").last()).toContainText("plan my");
  await expect(input).toHaveValue("Help me");

  await page.evaluate(() => {
    const Speech = (window as unknown as { __testSpeech: { current: { emit(text: string, final: boolean): void } } }).__testSpeech;
    Speech.current.emit("plan my week", true);
  });
  await expect(input).toHaveValue("Help me plan my week");
  await expect(dialog.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
  expect(postCount).toBe(0);

  await dialog.getByRole("button", { name: "Stop voice dictation" }).click();
  await expect(dialog.getByRole("status").last()).toContainText("Transcript added");
  await expect(input).not.toHaveAttribute("readonly");
  await input.fill("Help me plan my week around my deadlines");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(dialog.getByText("Help me plan my week around my deadlines", { exact: true })).toBeVisible();
  expect(postCount).toBe(0);
});

test("permission denial is explained without losing the typed prompt", async ({ page }) => {
  await installSpeechMock(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask Compass" }).click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  const input = dialog.getByRole("textbox", { name: "Message Compass" });
  await input.fill("Please check");
  await dialog.getByRole("button", { name: "Start voice dictation" }).click();
  await page.evaluate(() => {
    const Speech = (window as unknown as { __testSpeech: { current: { error(code: string): void } } }).__testSpeech;
    Speech.current.error("not-allowed");
  });
  await expect(dialog.getByRole("alert")).toContainText("permission was denied");
  await expect(input).toHaveValue("Please check");
  await expect(dialog.getByRole("button", { name: "Start voice dictation" })).toBeEnabled();
});

test("dismissal cancels speech and rejects late transcription events", async ({ page }) => {
  await installSpeechMock(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask Compass" }).click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await dialog.getByRole("button", { name: "Start voice dictation" }).click();
  await dialog.getByRole("button", { name: "Close assistant" }).click();
  await expect(dialog).toBeHidden();
  const count = await page.evaluate(() => {
    const Speech = (window as unknown as { __testSpeech: { current: { aborted: number; emit(text: string, final: boolean): void } } }).__testSpeech;
    Speech.current.emit("should never appear", true);
    return Speech.current.aborted;
  });
  expect(count).toBe(1);
  await page.getByRole("button", { name: "Ask Compass" }).click();
  await expect(dialog.getByRole("textbox", { name: "Message Compass" })).toHaveValue("");
});

test("unsupported browser offers typing without starting microphone recognition", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: undefined });
  });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask Compass" }).click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await expect(dialog.getByRole("button", { name: "Voice dictation unavailable" })).toBeDisabled();
  await expect(dialog.getByRole("status").last()).toContainText("not supported in this browser");
  await dialog.getByRole("textbox", { name: "Message Compass" }).fill("Hello from my keyboard");
  await expect(dialog.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
});
