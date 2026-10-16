import { expect, test } from "@playwright/test"

import { PASSWORD, signIn, signOut, signUpAndSignIn, uniqueEmail } from "./helpers/accounts"
import { waitForEmail } from "./helpers/mailpit"

test("change the password: this session stays signed in, only the new password works afterwards", async ({ page }) => {
  const email = await signUpAndSignIn(page, uniqueEmail("password"))
  await page.getByRole("button", { name: "Sign out" }).waitFor() // onboarding, with "Signed in as … · Account"
  await page.getByRole("link", { name: "Account" }).click()
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible()

  const form = page.locator("form", { has: page.getByRole("button", { name: "Change password" }) })
  const newPassword = `${PASSWORD}-new`

  // A wrong current password lands on its field.
  await form.getByLabel("Current password").fill("not-my-password")
  await form.getByLabel("New password", { exact: true }).fill(newPassword)
  await form.getByLabel("Confirm new password").fill(newPassword)
  await form.getByRole("button", { name: "Change password" }).click()
  await expect(form.getByText("Incorrect password.")).toBeVisible()

  await form.getByLabel("Current password").fill(PASSWORD)
  await form.getByRole("button", { name: "Change password" }).click()
  await expect(page.getByText("Password changed. Other devices were signed out.")).toBeVisible()

  // Still signed in, also after a reload.
  await page.reload()
  await expect(page.getByTestId("account-email")).toHaveText(email)

  await signOut(page)
  await signIn(page, email, PASSWORD)
  await expect(page.getByRole("alert")).toContainText("Invalid email or password.")
  await signIn(page, email, newPassword)
  await expect(page).toHaveURL(/\/onboarding$/)
})

test("change the email through a confirmation link sent to the new address", async ({ page }) => {
  const email = await signUpAndSignIn(page, uniqueEmail("email-old"))
  const newEmail = uniqueEmail("email-new")
  await page.goto("/account")
  await page.getByRole("button", { name: "Change email" }).click()
  const form = page.locator("form", { has: page.getByRole("button", { name: "Send confirmation link" }) })

  // The current password is required (X-Current-Password).
  await form.getByLabel("New email").fill(newEmail)
  await form.getByLabel("Current password").fill("not-my-password")
  await form.getByRole("button", { name: "Send confirmation link" }).click()
  await expect(form.getByText("The current password is incorrect.")).toBeVisible()

  await form.getByLabel("Current password").fill(PASSWORD)
  await form.getByRole("button", { name: "Send confirmation link" }).click()
  await expect(page.getByText(`Check your inbox at ${newEmail}`)).toBeVisible()
  await expect(page.getByTestId("account-email")).toHaveText(email) // unchanged until confirmed

  const confirmation = await waitForEmail(newEmail, "Confirm your email")
  await page.goto(confirmation.link("/confirm-email"))
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible()
  await expect(page.getByText(`Your email address is now ${newEmail}.`)).toBeVisible()

  await page.goto("/account")
  await expect(page.getByTestId("account-email")).toHaveText(newEmail)
  await signOut(page)
  await signIn(page, newEmail)
  await expect(page).toHaveURL(/\/onboarding$/)
})
