import { redirect } from "react-router"

import { isApiError } from "@/api/errors"
import type { Me } from "@/api/types"
import { meQueryOptions } from "@/features/auth/api"
import { queryClient } from "@/lib/query-client"
import { loginPath } from "@/lib/return-to"

/**
 * Route loader guard: resolves the signed-in user (cached by TanStack Query), or redirects to /login with a
 * returnTo pointing back at the requested page.
 */
export async function requireMe(request: Request, options: { fresh?: boolean } = {}): Promise<Me> {
  try {
    return options.fresh
      ? await queryClient.fetchQuery({ ...meQueryOptions, staleTime: 0 })
      : await queryClient.ensureQueryData(meQueryOptions)
  } catch (error) {
    if (isApiError(error, 401)) {
      const url = new URL(request.url)
      throw redirect(loginPath(url.pathname + url.search))
    }
    throw error
  }
}
