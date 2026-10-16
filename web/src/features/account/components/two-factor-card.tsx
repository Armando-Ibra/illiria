import { useQuery } from "@tanstack/react-query"
import { ShieldCheckIcon, ShieldIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { ErrorState, LoadingState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useMe } from "@/features/auth/api"
import { twoFactorQueryOptions, useChangeTwoFactor } from "@/features/account/api"
import { EnableTwoFactorDialog } from "@/features/account/components/enable-two-factor-dialog"
import { PasswordConfirmDialog } from "@/features/account/components/password-confirm-dialog"
import { RecoveryCodes } from "@/features/account/components/recovery-codes"

type ConfirmAction = "regenerate" | "reset" | "disable"

const confirmations: Record<
  ConfirmAction,
  { title: string; description: string; confirmLabel: string; destructive: boolean; success: string }
> = {
  regenerate: {
    title: "Generate new recovery codes?",
    description: "Your current recovery codes stop working. You'll see the new ones once, so be ready to save them.",
    confirmLabel: "Generate new codes",
    destructive: false,
    success: "New recovery codes generated. The old ones no longer work.",
  },
  reset: {
    title: "Reset your authenticator app?",
    description:
      "Your authenticator app stops working for Illiria and two-factor authentication is turned off. Set it up again with the new key afterwards.",
    confirmLabel: "Reset authenticator",
    destructive: true,
    success: "Authenticator reset. Two-factor authentication is off until you set it up again.",
  },
  disable: {
    title: "Turn off two-factor authentication?",
    description: "Signing in will only need your password. Your account will be less protected.",
    confirmLabel: "Turn off",
    destructive: true,
    success: "Two-factor authentication is off.",
  },
}

export function TwoFactorCard() {
  const me = useMe()
  const twoFactor = useQuery(twoFactorQueryOptions)
  const change = useChangeTwoFactor()
  const [enabling, setEnabling] = useState(false)
  // Keeps the action while the dialog closes, so its text doesn't change mid-animation.
  const [confirming, setConfirming] = useState<{ open: boolean; action: ConfirmAction }>({ open: false, action: "disable" })
  // Shown once, right after the API returned them; never cached or stored.
  const [newCodes, setNewCodes] = useState<string[] | null>(null)

  const state = twoFactor.data
  const enabled = state?.isTwoFactorEnabled === true
  const codesLeft = Number(state?.recoveryCodesLeft ?? 0)
  const confirmation = confirmations[confirming.action]

  const onConfirm = (currentPassword: string, { onError }: { onError: (error: unknown) => void }) => {
    const action = confirming.action
    const request =
      action === "regenerate" ? { resetRecoveryCodes: true } : action === "reset" ? { resetSharedKey: true } : { enable: false }
    change.mutate(
      { change: request, currentPassword },
      {
        onSuccess: (result) => {
          setConfirming((current) => ({ ...current, open: false }))
          toast.success(confirmations[action].success)
          setNewCodes(action === "regenerate" ? (result.recoveryCodes ?? null) : null)
        },
        onError,
      },
    )
  }

  const forgetBrowser = () =>
    change.mutate(
      { change: { forgetMachine: true } },
      {
        onSuccess: () => toast.success("This browser will ask for a code next time."),
        onError: (error) => toast.error(errorMessage(error)),
      },
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Two-factor authentication</h2>
        </CardTitle>
        <CardDescription>Ask for a code from an authenticator app when signing in, on top of your password.</CardDescription>
        {state && (
          <CardAction>
            <Badge variant={enabled ? "default" : "outline"}>{enabled ? "On" : "Off"}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {twoFactor.isPending ? (
          <LoadingState className="py-4" />
        ) : twoFactor.isError ? (
          <ErrorState className="py-4" error={twoFactor.error} onRetry={() => twoFactor.refetch()} />
        ) : (
          <>
            {newCodes && <RecoveryCodes codes={newCodes} email={me.email} onDone={() => setNewCodes(null)} />}

            {enabled ? (
              <>
                <div className="flex items-start gap-3">
                  <ShieldCheckIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="space-y-1">
                    <p>Signing in asks for a code from your authenticator app.</p>
                    <p className={codesLeft <= 3 ? "text-destructive" : "text-muted-foreground"}>
                      {codesLeft === 1 ? "1 recovery code left." : `${codesLeft} recovery codes left.`}
                      {codesLeft <= 3 && " Generate new ones before you run out."}
                    </p>
                    {state.isMachineRemembered && (
                      <p className="text-muted-foreground">
                        This browser is remembered and won't ask for a code.{" "}
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto px-0"
                          onClick={forgetBrowser}
                          disabled={change.isPending}
                        >
                          Forget this browser
                        </Button>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setConfirming({ open: true, action: "regenerate" })}>
                    Generate new recovery codes
                  </Button>
                  <Button variant="outline" onClick={() => setConfirming({ open: true, action: "reset" })}>
                    Reset authenticator app
                  </Button>
                  <Button variant="destructive" onClick={() => setConfirming({ open: true, action: "disable" })}>
                    Turn off
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <ShieldIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Two-factor authentication is off. Turn it on so a stolen password alone can't open your account.
                  </p>
                </div>
                <div>
                  <Button onClick={() => setEnabling(true)}>Set up two-factor authentication</Button>
                </div>
              </>
            )}

            {/* Outside the on/off branches: it must stay mounted while it closes after enabling. */}
            <EnableTwoFactorDialog
              open={enabling}
              onOpenChange={setEnabling}
              email={me.email}
              sharedKey={twoFactor.data.sharedKey}
              onEnabled={(codes) => {
                setNewCodes(codes)
                toast.success(
                  codes ? "Two-factor authentication is on." : "Two-factor authentication is on. Your earlier recovery codes still work.",
                )
              }}
            />
          </>
        )}
      </CardContent>

      <PasswordConfirmDialog
        open={confirming.open}
        onOpenChange={(open) => setConfirming((current) => ({ ...current, open }))}
        title={confirmation.title}
        description={confirmation.description}
        confirmLabel={confirmation.confirmLabel}
        destructive={confirmation.destructive}
        pending={change.isPending}
        onConfirm={onConfirm}
      />
    </Card>
  )
}
