import { expect, test } from "@playwright/test"

import { PASSWORD, signUpAndSignIn, uniqueEmail } from "./helpers"

test("signed-out visitors are sent to sign in, then back", async ({ page }) => {
  await page.goto("/orgs/00000000-0000-0000-0000-000000000000/members")
  await expect(page).toHaveURL(/\/login\?returnTo=%2Forgs%2F00000000-0000-0000-0000-000000000000%2Fmembers$/)
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
})

test("register, sign in, sign out", async ({ page }) => {
  const email = uniqueEmail("auth")
  await signUpAndSignIn(page, email)

  // A new user in multi-tenant mode has no organization yet.
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole("heading", { name: "Create your organization" })).toBeVisible()
  await expect(page.getByText(email)).toBeVisible()

  await page.getByRole("button", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/login$/)

  // The session is gone: protected pages bounce back to sign in.
  await page.goto("/onboarding")
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fonboarding$/)

  // Wrong password shows a form-level error.
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(`${PASSWORD}-wrong`)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("alert")).toContainText("Invalid email or password.")
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
