import { zodResolver } from "@hookform/resolvers/zod"
import { CopyIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { FormError } from "@/components/form-error"
import { TextField } from "@/components/form-fields"
import { Spinner } from "@/components/states"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { useChangeTwoFactor } from "@/features/account/api"
import { QrCode } from "@/features/account/components/qr-code"
import { applyAccountError } from "@/features/account/forms"

const ISSUER = "Illiria"

const schema = z.object({
  // Apps often show the code as "123 456": spaces are fine, they're dropped before sending.
  code: z.string().refine((value) => /^\d{6}$/.test(value.replace(/\s/g, "")), "Enter the 6-digit code from your app."),
  currentPassword: z.string().min(1, "Enter your current password."),
})

type Values = z.infer<typeof schema>

/** The `otpauth://` URI authenticator apps read from the QR code. */
function authenticatorUri(email: string, sharedKey: string): string {
  const label = `${encodeURIComponent(ISSUER)}:${encodeURIComponent(email)}`
  return `otpauth://totp/${label}?secret=${sharedKey}&issuer=${encodeURIComponent(ISSUER)}`
}

/** "ABCD EFGH …": easier to type into an app by hand. */
function groupKey(key: string): string {
  return key.match(/.{1,4}/g)?.join(" ") ?? key
}

/** Set up an authenticator app: scan the QR code (or type the key), then prove it works with a code. */
export function EnableTwoFactorDialog({
  open,
  onOpenChange,
  email,
  sharedKey,
  onEnabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  sharedKey: string
  /** `recoveryCodes` is null when the account still has unused codes from before (the API keeps them). */
  onEnabled: (recoveryCodes: string[] | null) => void
}) {
  const change = useChangeTwoFactor()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", currentPassword: "" },
  })

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) form.reset()
  }

  const onSubmit = form.handleSubmit(({ code, currentPassword }) =>
    change.mutate(
      { change: { enable: true, twoFactorCode: code.replace(/\s/g, "") }, currentPassword },
      {
        onSuccess: (state) => {
          close(false)
          onEnabled(state.recoveryCodes ?? null)
        },
        // InvalidTwoFactorCode (and friends) belong to the code field.
        onError: (error) =>
          applyAccountError(form, error, "currentPassword", (key) => (key.includes("TwoFactor") ? "code" : undefined)),
      },
    ),
  )

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(sharedKey)
      toast.success("Key copied.")
    } catch {
      toast.error("Couldn't copy. Select the key and copy it.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with an authenticator app (1Password, Google Authenticator, Microsoft Authenticator…), then
              enter the 6-digit code it shows.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <QrCode
              value={authenticatorUri(email, sharedKey)}
              label="QR code to add Illiria to your authenticator app"
              className="size-44"
            />
            <div className="w-full space-y-1 text-center">
              <p className="text-muted-foreground" id="setup-key-label">
                Can't scan it? Enter this setup key instead:
              </p>
              <div className="flex items-center justify-center gap-1">
                <code
                  aria-labelledby="setup-key-label"
                  data-testid="two-factor-key"
                  className="rounded-md bg-muted px-2 py-1 font-mono text-sm tracking-wide break-all select-all"
                >
                  {groupKey(sharedKey)}
                </code>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Copy setup key" onClick={copyKey}>
                  <CopyIcon />
                </Button>
              </div>
            </div>
          </div>
          <FieldGroup>
            <FormError form={form} />
            <TextField
              control={form.control}
              name="code"
              label="Code from your app"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
            <TextField
              control={form.control}
              name="currentPassword"
              label="Current password"
              type="password"
              autoComplete="current-password"
            />
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={change.isPending}>
              {change.isPending && <Spinner />}
              Turn on
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
