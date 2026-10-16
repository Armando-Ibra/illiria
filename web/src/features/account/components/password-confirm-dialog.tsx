import { zodResolver } from "@hookform/resolvers/zod"
import type * as React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { FormError } from "@/components/form-error"
import { TextField } from "@/components/form-fields"
import { Spinner } from "@/components/states"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { applyAccountError } from "@/features/account/forms"

const schema = z.object({ currentPassword: z.string().min(1, "Enter your current password.") })

type Values = z.infer<typeof schema>

/**
 * Confirms a sensitive account change with the current password. The password goes straight to `onConfirm`
 * (and from there into `mutate`); the form is cleared when the dialog closes.
 */
export function PasswordConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  destructive?: boolean
  pending: boolean
  onConfirm: (currentPassword: string, callbacks: { onError: (error: unknown) => void }) => void
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: "" } })

  const onSubmit = form.handleSubmit(({ currentPassword }) =>
    onConfirm(currentPassword, { onError: (error) => applyAccountError(form, error, "currentPassword") }),
  )

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) form.reset()
      }}
    >
      <AlertDialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <FormError form={form} />
            <TextField
              control={form.control}
              name="currentPassword"
              label="Current password"
              type="password"
              autoComplete="current-password"
              autoFocus
            />
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
              {pending && <Spinner />}
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
