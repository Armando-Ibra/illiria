import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { ApiError, errorMessage, isApiError } from "@/api/errors"

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** The caller shows errors itself (e.g. on form fields), so no global error toast. */
      handlesErrors?: boolean
    }
  }
}

export const meQueryKey = ["me"] as const

let onSessionExpired: () => void = () => {}

/** Wired by the router: what to do when a signed-in user's requests start returning 401. */
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

function handleUnauthorized(error: unknown): boolean {
  // Only an expired session counts: anonymous 401s (a wrong password, the first /api/me) are handled where they happen.
  if (isApiError(error, 401) && queryClient.getQueryData(meQueryKey) !== undefined) {
    onSessionExpired()
    return true
  }
  return false
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => handleUnauthorized(error),
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) => {
      if (handleUnauthorized(error) || mutation.meta?.handlesErrors) return
      toast.error(errorMessage(error))
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A 4xx won't fix itself on retry; network errors and 5xx get two more attempts.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
    mutations: {
      retry: false,
    },
  },
})
