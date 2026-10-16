import type { OrganizationRole } from "@/api/types"

/** Organization roles from least to most privileged; mirrors the API's OrganizationRole enum order. */
export const roles: readonly OrganizationRole[] = ["Member", "Admin", "Owner"]

export function hasRole(role: OrganizationRole, required: OrganizationRole): boolean {
  return roles.indexOf(role) >= roles.indexOf(required)
}

/** Roles a user with `role` may grant: never above their own (the API enforces the same rule). */
export function grantableRoles(role: OrganizationRole): OrganizationRole[] {
  return roles.filter((candidate) => hasRole(role, candidate))
}
