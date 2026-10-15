import { data, redirect, type LoaderFunctionArgs } from "react-router"

import type { Me } from "@/api/types"
import { requireMe } from "@/features/auth/session"
import { getLastOrganizationId, setLastOrganizationId } from "@/lib/preferences"

/** The organization to open by default: the last one used, else the first. */
function defaultOrganization(me: Me) {
  const lastId = getLastOrganizationId()
  return me.organizations.find((organization) => organization.id === lastId) ?? me.organizations[0]
}

/** `/`: sends the user to their organization, to onboarding (multi-tenant) or to the "no access" screen. */
export async function homeLoader({ request }: LoaderFunctionArgs) {
  const me = await requireMe(request)
  const organization = defaultOrganization(me)
  if (organization) return redirect(`/orgs/${organization.id}/projects`)
  return redirect(me.tenancyMode === "Multi" ? "/onboarding" : "/no-access")
}

/** `/orgs/:orgId`: the user must be a member. The API checks it on every request too; this is for the UI. */
export async function organizationLoader({ request, params }: LoaderFunctionArgs) {
  const findIn = (me: Me) => me.organizations.find((organization) => organization.id === params.orgId)
  // A miss may just be a stale /api/me (an invitation accepted, an organization created): re-check once.
  const organization = findIn(await requireMe(request)) ?? findIn(await requireMe(request, { fresh: true }))
  if (!organization) {
    throw data("Organization not found", { status: 404 })
  }
  setLastOrganizationId(organization.id)
  return organization
}

/** `/onboarding`: creating organizations is a multi-tenant feature. */
export async function onboardingLoader({ request }: LoaderFunctionArgs) {
  const me = await requireMe(request)
  return me.tenancyMode === "Multi" ? null : redirect("/")
}

/** `/no-access`: only for signed-in users without any organization. */
export async function noAccessLoader({ request }: LoaderFunctionArgs) {
  const me = await requireMe(request)
  return me.organizations.length === 0 ? null : redirect("/")
}
