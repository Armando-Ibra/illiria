import { AlertCircleIcon } from "lucide-react"
import type * as React from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"

/** The form-level error set by `applyApiError` (anything that couldn't be shown on a field). */
export function FormError<T extends FieldValues>({ form, children }: { form: UseFormReturn<T>; children?: React.ReactNode }) {
  const message = form.formState.errors.root?.server?.message
  if (!message) return null
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertDescription>
        {message}
        {children}
      </AlertDescription>
    </Alert>
  )
}
