import { expect, test } from "@playwright/test"

import { createOrganization, openMembers, signUpAndSignIn } from "./helpers/accounts"

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

  await openMembers(page)
  // The owner's own row: role editable (owners can change owners), no "Remove" for oneself.
  await expect(page.getByRole("combobox", { name: `Role for ${email}` })).toHaveText("Owner")
  await expect(page.getByRole("button", { name: `Remove ${email}` })).toHaveCount(0)
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

test("the last owner can't demote themselves", async ({ page }) => {
  const email = await signUpAndSignIn(page)
  await createOrganization(page, "Solo")
  await openMembers(page)

  await page.getByRole("combobox", { name: `Role for ${email}` }).click()
  await page.getByRole("option", { name: "Member" }).click()
  await expect(page.getByText("An organization must keep at least one owner.")).toBeVisible()
  await expect(page.getByRole("combobox", { name: `Role for ${email}` })).toHaveText("Owner")
})
