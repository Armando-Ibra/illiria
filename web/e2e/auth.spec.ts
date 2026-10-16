import { expect, test } from "@playwright/test"

import { PASSWORD, signIn, uniqueEmail } from "./helpers/accounts"
import { waitForEmail } from "./helpers/mailpit"

test("signed-out visitors are sent to sign in, then back", async ({ page }) => {
  await page.goto("/orgs/00000000-0000-0000-0000-000000000000/members")
  await expect(page).toHaveURL(/\/login\?returnTo=%2Forgs%2F00000000-0000-0000-0000-000000000000%2Fmembers$/)
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
})

test("register, confirm through the email link, sign in, sign out", async ({ page }) => {
  const email = uniqueEmail("auth")
  await page.goto("/login")
  await page.getByRole("link", { name: "Create an account" }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByLabel("Confirm password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()

  // Not confirmed yet: signing in is refused.
  await page.getByRole("link", { name: "Sign in" }).click()
  await signIn(page, email)
  await expect(page.getByRole("alert")).toContainText("Confirm your email address before signing in.")

  // The link in the email confirms the address.
  const confirmation = await waitForEmail(email, "Confirm your email")
  await page.goto(confirmation.link("/confirm-email"))
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible()
  await page.getByRole("link", { name: "Continue" }).click()

  // Still signed out: "/" asks to sign in, then a new user in multi-tenant mode lands on onboarding.
  await expect(page).toHaveURL(/\/login$/)
  await signIn(page, email)
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole("heading", { name: "Create your organization" })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()

  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)

  // The session is gone: protected pages bounce back to sign in.
  await page.goto("/onboarding")
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fonboarding$/)

  // Wrong password shows a form-level error.
  await signIn(page, email, `${PASSWORD}-wrong`)
  await expect(page.getByRole("alert")).toContainText("Invalid email or password.")
})

test("an unconfirmed account finishes its setup through a set-password link", async ({ page }) => {
  const email = uniqueEmail("setup")
  const registered = await page.request.post("/api/auth/register", {
    headers: { "X-CSRF": "1" },
    data: { email, password: PASSWORD },
  })
  expect(registered.ok()).toBe(true)

  // Asking for a new link for an unconfirmed account sends a set-password link, not a confirmation link.
  await page.goto(`/check-email?email=${encodeURIComponent(email)}`)
  await page.getByRole("button", { name: "Send a new link" }).click()
  await expect(page.getByText(/we sent it a link to finish setting up your account/)).toBeVisible()

  const setup = await waitForEmail(email, "Finish setting up your account")
  await page.goto(setup.link("/reset-password"))
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible()
  const newPassword = `${PASSWORD}-set`
  await page.getByLabel("New password", { exact: true }).fill(newPassword)
  await page.getByLabel("Confirm new password").fill(newPassword)
  await page.getByRole("button", { name: "Save password" }).click()

  // Setting the password confirmed the email: signing in works right away.
  await expect(page).toHaveURL(/\/login$/)
  await signIn(page, email, newPassword)
  await expect(page).toHaveURL(/\/onboarding$/)
})

test("registration shows the API's validation errors on the form", async ({ page }) => {
  await page.goto("/register")
  await page.getByLabel("Email").fill(uniqueEmail("weak"))
  // Long enough for the client-side check, but missing what the Identity password policy requires.
  await page.getByLabel("Password", { exact: true }).fill("alllowercase")
  await page.getByLabel("Confirm password").fill("alllowercase")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByText(/uppercase/)).toBeVisible()
})
