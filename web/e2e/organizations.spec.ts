import { expect, test } from "@playwright/test"

import { createOrganization, signUpAndSignIn } from "./helpers"

test("create an organization and a project", async ({ page }) => {
  await signUpAndSignIn(page)
  await createOrganization(page, "Acme")
  await expect(page.getByText("No projects yet")).toBeVisible()

  await page.getByRole("button", { name: "New project" }).click()
  const dialog = page.getByRole("dialog", { name: "New project" })
  await dialog.getByLabel("Name").fill("Website relaunch")
  await dialog.getByLabel("Description").fill("New marketing site")
  await dialog.getByRole("button", { name: "Create project" }).click()
  await expect(dialog).toBeHidden()

  const row = page.getByRole("row", { name: /Website relaunch/ })
  await expect(row).toBeVisible()
  await expect(row).toContainText("New marketing site")

  // It's on the server, not just in the cache.
  await page.reload()
  await expect(page.getByRole("row", { name: /Website relaunch/ })).toBeVisible()
})

test("an owner can open the invite dialog with every role", async ({ page }) => {
  const email = await signUpAndSignIn(page)
  await createOrganization(page, "Invites Inc")

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Members" }).first().click()
  await expect(page.getByRole("heading", { name: "Members", exact: true })).toBeVisible()
  await expect(page.getByRole("row", { name: new RegExp(email) })).toContainText("Owner")
  await expect(page.getByText("No pending invitations")).toBeVisible()

  await page.getByRole("button", { name: "Invite member" }).click()
  const dialog = page.getByRole("dialog", { name: "Invite a member" })
  await expect(dialog.getByLabel("Email")).toBeVisible()

  await dialog.getByRole("combobox", { name: "Role" }).click()
  const options = page.getByRole("option")
  await expect(options).toHaveText(["Member", "Admin", "Owner"])
  await page.keyboard.press("Escape")

  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toBeHidden()
})
