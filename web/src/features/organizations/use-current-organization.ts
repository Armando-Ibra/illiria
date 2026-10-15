import { useParams, useRouteLoaderData } from "react-router"

import type { MyOrganization } from "@/api/types"
import { useMe } from "@/features/auth/api"
import type { organizationLoader } from "@/features/organizations/loaders"
import { hasRole } from "@/lib/roles"

/** Route id of `/orgs/:orgId` (see the router). */
export const ORGANIZATION_ROUTE_ID = "organization"

/** The organization of the current `/orgs/:orgId` route, with the user's role in it. */
export function useCurrentOrganization(): MyOrganization & { isAdmin: boolean } {
  const { orgId } = useParams()
  const me = useMe()
  // Live from /api/me (role changes show up), else the loader's snapshot, e.g. right after leaving the organization.
  const snapshot = useRouteLoaderData<typeof organizationLoader>(ORGANIZATION_ROUTE_ID)
  const organization = me.organizations.find((candidate) => candidate.id === orgId) ?? snapshot
  if (!organization) {
    throw new Error("useCurrentOrganization must be used under the /orgs/:orgId route.")
  }
  return { ...organization, isAdmin: hasRole(organization.role, "Admin") }
}
