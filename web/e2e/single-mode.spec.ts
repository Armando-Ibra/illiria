import { expect, test, type Page } from "@playwright/test"

import { PASSWORD, openMembers, signIn, signUpAndSignIn, uniqueEmail } from "./helpers/accounts"
import { waitForEmail } from "./helpers/mailpit"
import { tenancyMode } from "./helpers/mode"

/*
 * Single-tenant mode: everybody works in one default organization; nobody creates organizations.
 * Runs only with E2E_TENANCY_MODE=Single, against an API started with Tenancy__Mode=Single on an EMPTY database
 * (the first confirmed user becomes the owner). The tests depend on each other's order, so they run serially.
 */
test.skip(tenancyMode !== "Single", "Single-mode spec: set E2E_TENANCY_MODE=Single (API with Tenancy__Mode=Single)")
test.describe.configure({ mode: "serial" })

const ownerEmail = uniqueEmail("single-owner")
const memberEmail = uniqueEmail("single-member")
let organizationPath = ""

test("the first confirmed user lands in the default organization as its owner", async ({ page }) => {
  // Registered and confirmed through the UI and the real email.
  await page.goto("/register")
  await page.getByLabel("Email").fill(ownerEmail)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByLabel("Confirm password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
  await page.goto((await waitForEmail(ownerEmail, "Confirm your email")).link("/confirm-email"))
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible()

  await signIn(page, ownerEmail)
  // Straight into the organization: no onboarding.
  await expect(page).toHaveURL(/\/orgs\/[0-9a-f-]+\/projects$/)
  organizationPath = new URL(page.url()).pathname.replace(/\/projects$/, "")

  await openMembers(page)
  await expect(
    page.getByRole("combobox", { name: `Role for ${ownerEmail}` }),
    "The first confirmed user must be the owner: Single-mode e2e needs an empty database.",
  ).toHaveText("Owner")
  await expect(page.getByRole("button", { name: "Invite member" })).toBeVisible()

  // No way to create organizations: no switcher (just the name), and onboarding sends you home.
  const me = (await (await page.request.get("/api/me")).json()) as { organizations: { name: string }[] }
  expect(me.organizations).toHaveLength(1)
  await expect(page.getByRole("banner").getByText(me.organizations[0]!.name, { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Switch organization" })).toHaveCount(0)
  await page.goto("/onboarding")
  await expect(page).toHaveURL(new RegExp(`${organizationPath}/projects$`))
})

test("later users join as members with member-level UI, and can leave", async ({ page }) => {
  await signUpAndSignIn(page, memberEmail)
  await expect(page).toHaveURL(new RegExp(`${organizationPath}/projects$`))

  await openMembers(page)
  await expect(page.getByRole("row", { name: new RegExp(memberEmail) })).toContainText("Member")
  await expect(page.getByRole("row", { name: new RegExp(ownerEmail) })).toContainText("Owner")
  await expect(page.getByRole("button", { name: "Invite member" })).toBeHidden()
  await expect(page.getByRole("combobox")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^Remove/ })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Pending invitations" })).toBeHidden()

  await expect(page.getByRole("button", { name: "Switch organization" })).toHaveCount(0)

  // The API refuses new organizations in single-tenant mode.
  const created = await page.request.post("/api/orgs", { headers: { "X-CSRF": "1" }, data: { name: "Nope" } })
  expect(created.status()).toBe(403)

  // Leaving ends on "no access" (there's no onboarding to go to).
  await page.getByRole("button", { name: "Leave organization" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Leave" }).click()
  await expect(page).toHaveURL(/\/no-access$/)
  await expect(page.getByRole("heading", { name: "No access yet" })).toBeVisible()
  await page.goto(`${organizationPath}/projects`)
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible()
})

test("an unconfirmed account isn't a member yet", async ({ page }) => {
  // Membership starts at email confirmation: until then, signing in is refused and no organization is joined.
  const email = uniqueEmail("single-pending")
  const registered = await page.request.post("/api/auth/register", { headers: { "X-CSRF": "1" }, data: { email, password: PASSWORD } })
  expect(registered.ok()).toBe(true)
  await signIn(page, email)
  await expect(page.getByRole("alert")).toContainText("Confirm your email address before signing in.")

  await openConfirmationLink(page, email)
  await signIn(page, email)
  await expect(page).toHaveURL(new RegExp(`${organizationPath}/projects$`))
})

/** Opens the confirmation link already sent at registration. */
async function openConfirmationLink(page: Page, email: string) {
  await page.goto((await waitForEmail(email, "Confirm your email")).link("/confirm-email"))
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible()
  await page.goto("/login")
}
