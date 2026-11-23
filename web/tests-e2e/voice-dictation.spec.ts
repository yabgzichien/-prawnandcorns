import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

/** Browser speech engines are not reliable in CI and require real microphones.
 * Stub only the browser recognition boundary; test the actual chat UI and state.
 */
async function installSpeechMock(page: import("@playwright/test").Page, localStatus?: "available" | "downloadable" | "unavailable") {
  await page.addInitScript(({ localStatus }) => {
    class FakeSpeechRecognition {
      static current: FakeSpeechRecognition;
      static checks = 0;
      static installs = 0;
      static async available() { FakeSpeechRecognition.checks++; return localStatus ?? "unavailable"; }
      static async install() { FakeSpeechRecognition.installs++; return true; }
      lang = "";
      processLocally = false;
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
    if (localStatus) FakeSpeechRecognition.prototype.processLocally = false;
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: localStatus ? FakeSpeechRecognition : undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: FakeSpeechRecognition });
    Object.assign(window, { __testSpeech: FakeSpeechRecognition });
  }, { localStatus });
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

test("browser speech network failure offers an explicit on-device English recovery", async ({ page }) => {
  await installSpeechMock(page, "downloadable");
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask Compass" }).click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  const input = dialog.getByRole("textbox", { name: "Message Compass" });
  await input.fill("Can you");
  await dialog.getByRole("button", { name: "Start voice dictation" }).click();
  await page.evaluate(() => {
    const Speech = (window as unknown as { __testSpeech: { current: { error(code: string): void } } }).__testSpeech;
    Speech.current.error("network");
  });
  await expect(dialog.getByRole("alert")).toContainText("Gemini is unaffected");
  await expect(input).toHaveValue("Can you");
  await expect(dialog.getByRole("button", { name: "Try on-device speech (English)" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await dialog.getByRole("button", { name: "Try on-device speech (English)" }).click();
  await expect(dialog.getByRole("button", { name: "Install English speech pack" })).toBeVisible();
  const before = await page.evaluate(() => {
    const Speech = (window as unknown as { __testSpeech: { installs: number; checks: number } }).__testSpeech;
    return { installs: Speech.installs, checks: Speech.checks };
  });
  expect(before).toEqual({ installs: 0, checks: 1 });

  await dialog.getByRole("button", { name: "Install English speech pack" }).click();
  await expect(dialog.getByRole("status").last()).toContainText("English language pack is ready");
  await dialog.getByRole("button", { name: "Start voice dictation" }).click();
  const mode = await page.evaluate(() => {
    const Speech = (window as unknown as { __testSpeech: { current: { processLocally: boolean; lang: string }; installs: number } }).__testSpeech;
    return { local: Speech.current.processLocally, language: Speech.current.lang, installs: Speech.installs };
  });
  expect(mode).toEqual({ local: true, language: "en-US", installs: 1 });
  await page.evaluate(() => {
    const Speech = (window as unknown as { __testSpeech: { current: { emit(text: string, final: boolean): void } } }).__testSpeech;
    Speech.current.emit("help me plan", true);
  });
  await dialog.getByRole("button", { name: "Stop voice dictation" }).click();
  await expect(input).toHaveValue("Can you help me plan");
  await expect(dialog.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
});

test("unavailable on-device recognition keeps an actionable typing fallback", async ({ page }) => {
  await installSpeechMock(page, "unavailable");
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask Compass" }).click();
  const dialog = page.getByRole("dialog", { name: "Compass assistant" });
  await dialog.getByRole("button", { name: "Start voice dictation" }).click();
  await page.evaluate(() => {
    const Speech = (window as unknown as { __testSpeech: { current: { error(code: string): void } } }).__testSpeech;
    Speech.current.error("network");
  });
  await dialog.getByRole("button", { name: "Try on-device speech (English)" }).click();
  await expect(dialog.getByText(/On-device English recognition is unavailable/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Install English speech pack" })).toHaveCount(0);
  await dialog.getByRole("textbox", { name: "Message Compass" }).fill("I'll type my question");
  await expect(dialog.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
});
