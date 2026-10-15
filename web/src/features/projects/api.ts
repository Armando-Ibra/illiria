import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { api, unwrap } from "@/api/client"
import type { SaveProjectRequest } from "@/api/types"

/*
 * Projects is the sample feature: copy this folder for a new organization-scoped resource.
 * Keys start with ["orgs", orgId] so everything of an organization can be invalidated at once.
 */
export const projectKeys = {
  list: (orgId: string) => ["orgs", orgId, "projects"] as const,
}

export function projectsQueryOptions(orgId: string) {
  return queryOptions({
    queryKey: projectKeys.list(orgId),
    queryFn: ({ signal }) => unwrap(api.GET("/api/orgs/{orgId}/projects", { params: { path: { orgId } }, signal })),
  })
}

export function useCreateProject(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: (body: SaveProjectRequest) =>
      unwrap(api.POST("/api/orgs/{orgId}/projects", { params: { path: { orgId } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.list(orgId) }),
  })
}

export function useUpdateProject(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: ({ id, ...body }: SaveProjectRequest & { id: string }) =>
      unwrap(api.PUT("/api/orgs/{orgId}/projects/{id}", { params: { path: { orgId, id } }, body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.list(orgId) }),
  })
}

export function useDeleteProject(orgId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/api/orgs/{orgId}/projects/{id}", { params: { path: { orgId, id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.list(orgId) }),
  })
}
