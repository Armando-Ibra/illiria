import { expect, test, type Page } from "@playwright/test"

import { PASSWORD, signIn, signOut, signUpAndSignIn, uniqueEmail } from "./helpers/accounts"
import { totp } from "./helpers/totp"

/** Fills the second sign-in step. */
async function submitCode(page: Page, label: "Authentication code" | "Recovery code", code: string) {
  await page.getByLabel(label).fill(code)
  await page.getByRole("button", { name: "Verify" }).click()
}

test("two-factor authentication: enable, sign in with a code, sign in with a recovery code once", async ({ page, browser }) => {
  test.setTimeout(90_000) // a long story across several browsers
  const email = await signUpAndSignIn(page, uniqueEmail("2fa"))
  await page.goto("/account")
  await expect(page.getByRole("heading", { name: "Two-factor authentication" })).toBeVisible()

  // Enable: the key under the QR code feeds the test's authenticator.
  await page.getByRole("button", { name: "Set up two-factor authentication" }).click()
  const dialog = page.getByRole("dialog", { name: "Set up two-factor authentication" })
  await expect(dialog.getByRole("img", { name: /QR code/ })).toBeVisible()
  const sharedKey = (await dialog.getByTestId("two-factor-key").innerText()).replace(/\s/g, "")
  expect(sharedKey).toMatch(/^[A-Z2-7]{16,}$/)

  await dialog.getByLabel("Code from your app").fill("000000")
  await dialog.getByLabel("Current password").fill(PASSWORD)
  await dialog.getByRole("button", { name: "Turn on" }).click()
  await expect(dialog.getByText(/token provided by the request was invalid/)).toBeVisible()

  await dialog.getByLabel("Code from your app").fill(totp(sharedKey))
  await dialog.getByRole("button", { name: "Turn on" }).click()
  await expect(dialog).toBeHidden()

  // The recovery codes are shown once, with copy and download.
  const codes = await page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem").allInnerTexts()
  expect(codes).toHaveLength(10)
  await expect(page.getByText("Store them now: you won't see them again.")).toBeVisible()
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Download .txt" }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe("illiria-recovery-codes.txt")
  await page.getByRole("button", { name: "I've saved them" }).click()
  await expect(page.getByRole("list", { name: "Recovery codes" })).toBeHidden()
  await expect(page.getByText("10 recovery codes left.")).toBeVisible()

  // Signing in now asks for a code; a wrong one is reported on the field.
  await signOut(page)
  await signIn(page, email)
  await expect(page.getByRole("heading", { name: "Two-factor authentication" })).toBeVisible()
  await submitCode(page, "Authentication code", "123456" === totp(sharedKey) ? "654321" : "123456")
  await expect(page.getByText("That code isn't valid. Check your app and try again.")).toBeVisible()
  // The next time step's code: different from the one used to enable, and accepted by the API's window.
  await submitCode(page, "Authentication code", totp(sharedKey, { stepOffset: 1 }))
  await expect(page).toHaveURL(/\/onboarding$/)

  // A recovery code works once. Fresh browsers: this one is now remembered and wouldn't ask for a code.
  const useRecoveryCode = async () => {
    const context = await browser.newContext()
    const other = await context.newPage()
    await signIn(other, email)
    await other.getByRole("button", { name: "Use a recovery code instead" }).click()
    await submitCode(other, "Recovery code", codes[0]!.toLowerCase()) // the app upper-cases it
    return { context, other }
  }
  const first = await useRecoveryCode()
  await expect(first.other).toHaveURL(/\/onboarding$/)
  await first.context.close()

  const second = await useRecoveryCode()
  await expect(second.other.getByText("That recovery code isn't valid or was already used.")).toBeVisible()
  // "Back" returns to the first step, with the password cleared.
  await second.other.getByRole("button", { name: "Back to sign in" }).click()
  await expect(second.other.getByRole("heading", { name: "Sign in" })).toBeVisible()
  await expect(second.other.getByLabel("Password")).toHaveValue("")
  await second.context.close()

  await page.goto("/account")
  await expect(page.getByText("9 recovery codes left.")).toBeVisible()

  // New recovery codes replace the old ones (password required), then turn 2FA off.
  await page.getByRole("button", { name: "Generate new recovery codes" }).click()
  const regenerate = page.getByRole("alertdialog", { name: "Generate new recovery codes?" })
  await regenerate.getByLabel("Current password").fill("not-my-password")
  await regenerate.getByRole("button", { name: "Generate new codes" }).click()
  await expect(regenerate.getByText("The current password is incorrect.")).toBeVisible()
  await regenerate.getByLabel("Current password").fill(PASSWORD)
  await regenerate.getByRole("button", { name: "Generate new codes" }).click()
  await expect(regenerate).toBeHidden()
  const newCodes = await page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem").allInnerTexts()
  expect(newCodes).toHaveLength(10)
  expect(newCodes).not.toContain(codes[1])
  await page.getByRole("button", { name: "I've saved them" }).click()

  await page.getByRole("button", { name: "Turn off" }).click()
  const disable = page.getByRole("alertdialog", { name: "Turn off two-factor authentication?" })
  await disable.getByLabel("Current password").fill(PASSWORD)
  await disable.getByRole("button", { name: "Turn off" }).click()
  await expect(page.getByText("Two-factor authentication is off.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Set up two-factor authentication" })).toBeVisible()
})
