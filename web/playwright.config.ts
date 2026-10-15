import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173"

/**
 * End-to-end tests against the real API (no route mocks). Start the API first, with
 * `Identity__RequireConfirmedEmail=false` so new accounts can sign in without an email; see README.md.
 * Playwright starts the Vite dev server itself (which proxies /api to the API).
 */
export default defineConfig({
  testDir: "./e2e",
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
