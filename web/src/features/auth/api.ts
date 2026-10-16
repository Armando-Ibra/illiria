import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router"

import { api, unwrap } from "@/api/client"
import { isApiError } from "@/api/errors"
import type { LoginRequest } from "@/api/types"
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

/** Public settings (`GET /api/config`, anonymous): whether sign-up is open, the tenancy mode. */
export const configQueryOptions = queryOptions({
  queryKey: ["config"],
  queryFn: ({ signal }) => unwrap(api.GET("/api/config", { signal })),
  staleTime: Infinity,
})

type Credentials = { email: string; password: string }

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { handlesErrors: true },
    // useCookies: the API sets the HttpOnly session cookie; no token is returned to JavaScript.
    // With two-factor authentication, the same request is repeated with `twoFactorCode` or `twoFactorRecoveryCode`.
    // rememberDevice: with a 2FA code, this browser won't be asked for a code again (opt-in).
    mutationFn: ({ rememberDevice, ...body }: LoginRequest & { rememberDevice?: boolean }) =>
      unwrap(api.POST("/api/auth/login", { params: { query: { useCookies: true, ...(rememberDevice ? { rememberDevice } : {}) } }, body })),
    // Nothing cached belongs to the new session (the public config stays valid).
    onSuccess: () => queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "config" }),
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
