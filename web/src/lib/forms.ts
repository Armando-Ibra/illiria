import type { FieldValues, Path, UseFormReturn } from "react-hook-form"

import { ApiError, errorMessage } from "@/api/errors"

/**
 * Shows an API error on a react-hook-form form. ValidationProblem `errors` keys are matched to fields:
 * FluentValidation keys by name (`Name` → `name`), anything else through `fieldFor` (e.g. Identity codes like
 * `PasswordTooShort` → `password`; `null` drops a key). Whatever can't be placed on a field becomes the form-level error
 * (`errors.root.server`).
 */
export function applyApiError<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
  fieldFor?: (key: string) => Path<T> | null | undefined,
): void {
  const fields = new Set(Object.keys(form.getValues()))
  const byField = new Map<Path<T>, string[]>()
  const unplaced: string[] = []

  if (error instanceof ApiError) {
    for (const [key, messages] of Object.entries(error.errors)) {
      const mapped = fieldFor?.(key)
      if (mapped === null) continue // the caller chose to drop this key (e.g. a duplicate of another one)
      const field = mapped ?? (fields.has(camelCase(key)) ? (camelCase(key) as Path<T>) : undefined)
      if (field) {
        byField.set(field, [...(byField.get(field) ?? []), ...messages])
      } else {
        unplaced.push(...messages)
      }
    }
  }

  for (const [field, messages] of byField) {
    form.setError(field, { type: "server", message: messages.join(" ") }, { shouldFocus: true })
  }
  if (unplaced.length > 0 || byField.size === 0) {
    form.setError("root.server", { type: "server", message: unplaced.length > 0 ? unplaced.join(" ") : errorMessage(error) })
  }
}

function camelCase(key: string): string {
  return key.charAt(0).toLowerCase() + key.slice(1)
}
