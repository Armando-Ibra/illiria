import { expect, type Page } from "@playwright/test"

/** Satisfies the API's Identity password policy. */
export const PASSWORD = "Illiria-e2e-Passw0rd!"

/** A fresh address per test run: tests share one database and never clean up. */
export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.illiria.test`
}

/** Registers a new account through the UI and signs in. Requires the API's Identity__RequireConfirmedEmail=false. */
export async function signUpAndSignIn(page: Page, email = uniqueEmail()): Promise<string> {
  await page.goto("/register")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByLabel("Confirm password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()

  await page.getByRole("link", { name: "Sign in" }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  return email
}

/** Creates an organization from onboarding and waits for its (empty) projects page. */
export async function createOrganization(page: Page, name: string) {
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel("Organization name").fill(name)
  await page.getByRole("button", { name: "Create organization" }).click()
  await expect(page).toHaveURL(/\/orgs\/[0-9a-f-]+\/projects$/)
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible()
}
