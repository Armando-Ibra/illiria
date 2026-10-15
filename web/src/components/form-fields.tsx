import { useId } from "react"
import type * as React from "react"
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type BaseProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: React.ReactNode
}

/** A labelled input bound to react-hook-form, with its validation message (shadcn Field + Controller). */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  ...inputProps
}: BaseProps<T> & Omit<React.ComponentProps<"input">, "name" | "value" | "onChange" | "onBlur" | "ref">) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            {...inputProps}
            {...field}
            value={field.value ?? ""}
            id={id}
            aria-invalid={fieldState.invalid}
            aria-describedby={describedBy(id, description, fieldState.invalid)}
          />
          {description && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
          <FieldError id={`${id}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  ...textareaProps
}: BaseProps<T> & Omit<React.ComponentProps<"textarea">, "name" | "value" | "onChange" | "onBlur" | "ref">) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Textarea
            {...textareaProps}
            {...field}
            value={field.value ?? ""}
            id={id}
            aria-invalid={fieldState.invalid}
            aria-describedby={describedBy(id, description, fieldState.invalid)}
          />
          {description && <FieldDescription id={`${id}-description`}>{description}</FieldDescription>}
          <FieldError id={`${id}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}

function describedBy(id: string, description: React.ReactNode, invalid: boolean): string | undefined {
  const ids = [description ? `${id}-description` : null, invalid ? `${id}-error` : null].filter(Boolean)
  return ids.length > 0 ? ids.join(" ") : undefined
}
