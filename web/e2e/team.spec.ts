import { expect, test, type Page } from "@playwright/test"

import { createConfirmedAccount, createOrganization, openMembers, signIn, signUpAndSignIn, uniqueEmail } from "./helpers/accounts"
import { waitForEmail } from "./helpers/mailpit"

async function invite(page: Page, email: string, role: "Member" | "Admin" | "Owner" = "Member") {
  await page.getByRole("button", { name: "Invite member" }).click()
  const dialog = page.getByRole("dialog", { name: "Invite a member" })
  await dialog.getByLabel("Email").fill(email)
  if (role !== "Member") {
    await dialog.getByRole("combobox", { name: "Role" }).click()
    await page.getByRole("option", { name: role }).click()
  }
  await dialog.getByRole("button", { name: "Send invitation" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("row", { name: new RegExp(email) })).toBeVisible()
}

test("team: invite and accept, promote, revoke an invitation, leave", async ({ page, browser }) => {
  test.setTimeout(90_000) // a long story across several browsers
  const organizationName = `Team ${Date.now()}`
  const owner = await signUpAndSignIn(page, uniqueEmail("owner"))
  const orgId = await createOrganization(page, organizationName)
  await openMembers(page)

  // The only owner can't leave.
  await page.getByRole("button", { name: "Leave organization" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click()
  await expect(page.getByText("Make someone else an owner before leaving.")).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/orgs/${orgId}/members$`))

  const memberEmail = uniqueEmail("member")
  const revokedEmail = uniqueEmail("revoked")
  await invite(page, memberEmail)
  await invite(page, revokedEmail)

  // Inviting the same address twice is refused, on the field.
  await page.getByRole("button", { name: "Invite member" }).click()
  const dialog = page.getByRole("dialog", { name: "Invite a member" })
  await dialog.getByLabel("Email").fill(memberEmail)
  await dialog.getByRole("button", { name: "Send invitation" }).click()
  await expect(dialog.getByText("This address already has a pending invitation.")).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()

  // The invitee opens the emailed link, signs in (new account), and accepts.
  const memberContext = await browser.newContext()
  const member = await memberContext.newPage()
  await createConfirmedAccount(member.request, memberEmail)
  const invitation = await waitForEmail(memberEmail, `You're invited to ${organizationName}`)
  await member.goto(invitation.link("/invitations/accept"))
  await expect(member).toHaveURL(/\/login\?returnTo=/)
  await signIn(member, memberEmail)
  await member.getByRole("button", { name: "Accept invitation" }).click()
  await expect(member).toHaveURL(new RegExp(`/orgs/${orgId}/projects$`))

  // Member-level UI: no invitations, no role or remove controls, but they can leave.
  await openMembers(member)
  await expect(member.getByRole("button", { name: "Invite member" })).toBeHidden()
  await expect(member.getByRole("combobox")).toHaveCount(0)
  await expect(member.getByRole("button", { name: /^Remove/ })).toHaveCount(0)
  await expect(member.getByRole("heading", { name: "Pending invitations" })).toBeHidden()
  await expect(member.getByRole("row", { name: new RegExp(owner) })).toContainText("Owner")

  // The owner promotes the member to Admin.
  await page.reload()
  const memberRole = page.getByRole("combobox", { name: `Role for ${memberEmail}` })
  await expect(memberRole).toHaveText("Member")
  await memberRole.click()
  await page.getByRole("option", { name: "Admin" }).click()
  await expect(page.getByText(`${memberEmail} is now an Admin.`)).toBeVisible()
  await expect(memberRole).toHaveText("Admin")

  // The new admin sees admin UI after a refresh: invitations, but no control over the owner.
  await member.reload()
  await expect(member.getByRole("button", { name: "Invite member" })).toBeVisible()
  await expect(member.getByRole("combobox", { name: `Role for ${owner}` })).toHaveCount(0)

  // The owner revokes the other invitation: its link stops working.
  await page.getByRole("button", { name: `Revoke invitation for ${revokedEmail}` }).click()
  await page.getByRole("alertdialog", { name: "Revoke invitation?" }).getByRole("button", { name: "Revoke" }).click()
  await expect(page.getByText(`Invitation to ${revokedEmail} revoked.`)).toBeVisible()
  await expect(page.getByRole("row", { name: new RegExp(revokedEmail) })).toHaveCount(0)

  const revokedContext = await browser.newContext()
  const revoked = await revokedContext.newPage()
  await createConfirmedAccount(revoked.request, revokedEmail)
  const revokedInvitation = await waitForEmail(revokedEmail, `You're invited to ${organizationName}`)
  await revoked.goto(revokedInvitation.link("/invitations/accept"))
  await expect(revoked).toHaveURL(/\/login\?returnTo=/)
  await signIn(revoked, revokedEmail)
  await revoked.getByRole("button", { name: "Accept invitation" }).click()
  await expect(revoked.getByText("This invitation is invalid, expired, or was already used.")).toBeVisible()
  await revokedContext.close()

  // The member leaves and loses access.
  await member.getByRole("button", { name: "Leave organization" }).click()
  await member.getByRole("alertdialog", { name: `Leave ${organizationName}?` }).getByRole("button", { name: "Leave" }).click()
  await expect(member.getByText(`You left ${organizationName}.`)).toBeVisible()
  await expect(member).toHaveURL(/\/onboarding$/) // multi-tenant, no other organization
  await member.goto(`/orgs/${orgId}/projects`)
  await expect(member.getByRole("heading", { name: "Page not found" })).toBeVisible()
  await memberContext.close()

  await page.reload()
  await expect(page.getByRole("row", { name: new RegExp(memberEmail) })).toHaveCount(0)
})
