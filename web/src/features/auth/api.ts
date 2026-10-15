import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router"

import { api, unwrap } from "@/api/client"
import { isApiError } from "@/api/errors"
import { meQueryKey } from "@/lib/query-client"

export const meQueryOptions = queryOptions({
  queryKey: meQueryKey,
  queryFn: ({ signal }) => unwrap(api.GET("/api/me", { signal })),
  staleTime: 5 * 60_000,
})

/** The signed-in user. Only for routes behind `requireMe`, which loads it before rendering. */
export function useMe() {
  return useSuspenseQuery(meQueryOptions).data
}

type Credentials = { email: string; password: string }

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { handlesErrors: true },
    // useCookies: the API sets the HttpOnly session cookie; no token is returned to JavaScript.
    mutationFn: (body: Credentials) => unwrap(api.POST("/api/auth/login", { params: { query: { useCookies: true } }, body })),
    // Nothing cached belongs to the new session.
    onSuccess: () => queryClient.clear(),
  })
}

export function useRegister() {
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: (body: Credentials) => unwrap(api.POST("/api/auth/register", { body })),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async (_returnTo?: string) => {
      try {
        await unwrap(api.POST("/api/auth/logout"))
      } catch (error) {
        // Already signed out (expired session): the outcome is the same.
        if (!isApiError(error, 401)) throw error
      }
    },
    onSuccess: async (_data, returnTo?: string) => {
      // Leave the signed-in screens first, so nothing re-fetches while the cache is cleared.
      await navigate(returnTo ? `/login?${new URLSearchParams({ returnTo })}` : "/login", { replace: true })
      queryClient.clear()
    },
  })
}

export function useResendConfirmationEmail() {
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: (email: string) => unwrap(api.POST("/api/auth/resendConfirmationEmail", { body: { email } })),
  })
}

export function useForgotPassword() {
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: (email: string) => unwrap(api.POST("/api/auth/forgotPassword", { body: { email } })),
  })
}

export function useResetPassword() {
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: (body: { email: string; resetCode: string; newPassword: string }) =>
      unwrap(api.POST("/api/auth/resetPassword", { body })),
  })
}

export type ConfirmEmailParams = { userId: string; code: string; changedEmail?: string }

export function confirmEmailQueryOptions(params: ConfirmEmailParams) {
  return queryOptions({
    queryKey: ["confirm-email", params],
    // The endpoint answers with a plain-text sentence; only the status matters.
    queryFn: ({ signal }) =>
      unwrap(api.GET("/api/auth/confirmEmail", { params: { query: params }, parseAs: "text", signal })),
    staleTime: Infinity,
    retry: false,
  })
}
