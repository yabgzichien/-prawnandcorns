import { defineConfig } from "@playwright/test";

/** Browser smoke tests run against a localhost-only development server.
 * No Gemini API requests are made by the study-plan E2E tests: they select Demo.
 */
export default defineConfig({
  testDir: "./tests-e2e",
  timeout: 45_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3456",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    timezoneId: "Asia/Kuala_Lumpur",
    reducedMotion: "reduce",
  },
  webServer: {
    command: "npm run dev -- -p 3456 -H 127.0.0.1",
    url: "http://127.0.0.1:3456/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
