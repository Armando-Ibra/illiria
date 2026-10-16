import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173"
const singleMode = process.env.E2E_TENANCY_MODE === "Single"

/**
 * End-to-end tests against the real API (no route mocks) and its real emails, read from Mailpit (MAILPIT_URL,
 * default http://localhost:8025). Start Postgres + Mailpit and the API first; see README.md.
 * Playwright starts the Vite dev server itself (which proxies /api to the API) unless E2E_BASE_URL is set.
 *
 * E2E_TENANCY_MODE=Single runs only e2e/single-mode.spec.ts, against an API started with Tenancy__Mode=Single on an
 * empty database; the default (Multi) runs everything else.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: singleMode ? "single-mode.spec.ts" : "*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
})
