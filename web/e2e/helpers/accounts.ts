import { expect, type APIRequestContext, type Page } from "@playwright/test"

import { waitForEmail } from "./mailpit"

/** Satisfies the API's Identity password policy. */
export const PASSWORD = "Illiria-e2e-Passw0rd!"

/** A fresh address per test: tests share one database (and one Mailpit) and never clean up. */
export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.illiria.test`
}

/** State-changing API calls need the CSRF header the web client adds. */
const csrf = { "X-CSRF": "1" }

/**
 * Creates an account and confirms it through the link in the confirmation email (via the API, not the UI: for
 * tests whose subject is something else). Leaves the browser signed out.
 */
export async function createConfirmedAccount(request: APIRequestContext, email = uniqueEmail(), password = PASSWORD) {
  const registered = await request.post("/api/auth/register", { headers: csrf, data: { email, password } })
  expect(registered.status(), await registered.text()).toBe(200)
  await confirmFromEmail(request, email)
  return email
}

/** Opens the newest "Confirm your email" link sent to `email` (as the confirm page would, through the API). */
export async function confirmFromEmail(request: APIRequestContext, email: string) {
  const link = (await waitForEmail(email, "Confirm your email")).link("/confirm-email")
  const confirmed = await request.get(`/api/auth/confirmEmail${link.slice(link.indexOf("?"))}`)
  expect(confirmed.status(), await confirmed.text()).toBe(200)
}

/** Signs in through the login form (no two-factor step). */
export async function signIn(page: Page, email: string, password = PASSWORD) {
  if (!page.url().includes("/login")) await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

/** A new confirmed account, signed in. */
export async function signUpAndSignIn(page: Page, email = uniqueEmail()): Promise<string> {
  await createConfirmedAccount(page.request, email)
  await signIn(page, email)
  await expect(page).not.toHaveURL(/\/login/)
  return email
}

/** Signs out from the account menu (present on every signed-in page with the top bar). */
export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)
}

/** Creates an organization from onboarding and waits for its (empty) projects page. Returns its id. */
export async function createOrganization(page: Page, name: string): Promise<string> {
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel("Organization name").fill(name)
  await page.getByRole("button", { name: "Create organization" }).click()
  await expect(page).toHaveURL(/\/orgs\/[0-9a-f-]+\/projects$/)
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible()
  return page.url().split("/")[4]!
}

/** Opens the members page of the current organization from the navigation. */
export async function openMembers(page: Page) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Members" }).first().click()
  await expect(page.getByRole("heading", { name: "Members", exact: true })).toBeVisible()
}
