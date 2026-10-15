import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import type { OrganizationRole } from "@/api/types"
import { meQueryKey } from "@/lib/query-client"

export const organizationKeys = {
  all: (orgId: string) => ["orgs", orgId] as const,
  members: (orgId: string) => ["orgs", orgId, "members"] as const,
  invitations: (orgId: string) => ["orgs", orgId, "invitations"] as const,
}

export function membersQueryOptions(orgId: string) {
  return queryOptions({
    queryKey: organizationKeys.members(orgId),
    queryFn: ({ signal }) => unwrap(api.GET("/api/orgs/{orgId}/members", { params: { path: { orgId } }, signal })),
  })
}

/** Pending invitations. Admin+ only: the API answers 403 to members. */
export function invitationsQueryOptions(orgId: string) {
  return queryOptions({
    queryKey: organizationKeys.invitations(orgId),
    queryFn: ({ signal }) => unwrap(api.GET("/api/orgs/{orgId}/invitations", { params: { path: { orgId } }, signal })),
  })
}

export function useCreateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: (name: string) => unwrap(api.POST("/api/orgs", { body: { name } })),
    // The organization list lives in /api/me: refresh it before navigating into the new organization.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meQueryKey }),
  })
}

export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(api.DELETE("/api/orgs/{orgId}/members/{userId}", { params: { path: { orgId, userId } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.members(orgId) }),
  })
}

export function useCreateInvitation(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: (body: { email: string; role: OrganizationRole }) =>
      unwrap(api.POST("/api/orgs/{orgId}/invitations", { params: { path: { orgId } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.invitations(orgId) }),
  })
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: (token: string) => unwrap(api.POST("/api/invitations/accept", { body: { token } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meQueryKey }),
  })
}
