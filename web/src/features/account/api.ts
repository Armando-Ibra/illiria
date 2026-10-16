import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { api, currentPasswordHeader, unwrap } from "@/api/client"
import type { TwoFactorRequest, TwoFactorResponse } from "@/api/types"

/*
 * The signed-in user's own account: ASP.NET Core Identity's /api/auth/manage endpoints. After a successful change
 * the API re-issues this session's cookie (other sessions are signed out), so nothing here signs the user out.
 */
export const accountKeys = {
  twoFactor: ["account", "two-factor"] as const,
}

/** Two-factor status. `POST {}` only reads it (and creates the authenticator key on first use). */
export const twoFactorQueryOptions = queryOptions({
  queryKey: accountKeys.twoFactor,
  queryFn: ({ signal }) => unwrap(api.POST("/api/auth/manage/2fa", { body: {}, signal })),
})

export function useChangePassword() {
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: (body: { oldPassword: string; newPassword: string }) => unwrap(api.POST("/api/auth/manage/info", { body })),
  })
}

/** Sends a confirmation link to the new address; the email changes once that link is opened. */
export function useChangeEmail() {
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: ({ newEmail, currentPassword }: { newEmail: string; currentPassword: string }) =>
      unwrap(api.POST("/api/auth/manage/info", { body: { newEmail }, headers: currentPasswordHeader(currentPassword) })),
  })
}

export type TwoFactorChange = {
  change: TwoFactorRequest
  /** Required by the API for anything but `forgetMachine`. Passed per call, never stored. */
  currentPassword?: string
}

/**
 * Changes the two-factor settings: enable (with a code), disable, reset the authenticator key, new recovery codes,
 * forget this browser. The response's `recoveryCodes` are shown once by the caller and never cached.
 */
export function useChangeTwoFactor() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: ({ change, currentPassword }: TwoFactorChange) =>
      unwrap(
        api.POST("/api/auth/manage/2fa", {
          body: change,
          headers: currentPassword === undefined ? undefined : currentPasswordHeader(currentPassword),
        }),
      ),
    onSuccess: (state) =>
      queryClient.setQueryData<TwoFactorResponse>(accountKeys.twoFactor, { ...state, recoveryCodes: null }),
  })
}
