import type { FieldValues, Path, UseFormReturn } from "react-hook-form"

import { isApiError } from "@/api/errors"
import { applyApiError } from "@/lib/forms"

/**
 * Shows an account-change error on a form. The API answers 403 when the current password (X-Current-Password
 * header) is missing or wrong: that goes on the password field. Everything else goes through `applyApiError`.
 */
export function applyAccountError<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
  currentPasswordField: Path<T>,
  fieldFor?: (key: string) => Path<T> | null | undefined,
): void {
  if (isApiError(error, 403)) {
    const message = error.problem.title && error.problem.title !== "Forbidden" ? error.problem.title : "The current password is incorrect."
    form.setError(currentPasswordField, { type: "server", message }, { shouldFocus: true })
    return
  }
  applyApiError(form, error, fieldFor)
}
