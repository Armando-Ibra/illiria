import { zodResolver } from "@hookform/resolvers/zod"
import { useId, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { errorMessage, isApiError } from "@/api/errors"
import type { OrganizationRole } from "@/api/types"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { emailSchema } from "@/features/auth/schemas"
import { useCreateInvitation } from "@/features/organizations/api"
import { applyApiError } from "@/lib/forms"
import { grantableRoles, roles } from "@/lib/roles"

const roleDescriptions: Record<OrganizationRole, string> = {
  Member: "Works on projects.",
  Admin: "Also manages members, invitations and deletions.",
  Owner: "Full control, including other owners.",
}

const schema = z.object({
  email: emailSchema,
  role: z.enum(roles),
})

type Values = z.infer<typeof schema>

export function InviteDialog({ orgId, myRole }: { orgId: string; myRole: OrganizationRole }) {
  const [open, setOpen] = useState(false)
  const roleId = useId()
  const invite = useCreateInvitation(orgId)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", role: "Member" } })
  // Nobody can grant a role above their own; the API rejects it too.
  const options = grantableRoles(myRole)

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) form.reset()
  }

  const onSubmit = form.handleSubmit((values) =>
    invite.mutate(values, {
      onSuccess: (invitation) => {
        toast.success(`Invitation sent to ${invitation.email}.`)
        onOpenChange(false)
      },
      onError: (error) => {
        // 409: already a member, or already invited (the API's title says which).
        if (isApiError(error, 409)) {
          form.setError("email", { message: error.problem.title ?? "This person can't be invited again." }, { shouldFocus: true })
        } else if (isApiError(error, 429)) {
          toast.error(errorMessage(error)) // e.g. too many invitations in the last hour
        } else {
          applyApiError(form, error)
        }
      },
    }),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>Invite member</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>We'll email them a link to join. It's valid for 7 days.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <FormError form={form} />
            <TextField control={form.control} name="email" label="Email" type="email" autoComplete="off" />
            <Controller
              control={form.control}
              name="role"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={roleId}>Role</FieldLabel>
                  <Select
                    items={options.map((role) => ({ value: role, label: role }))}
                    value={field.value}
                    onValueChange={(value) => value && field.onChange(value)}
                  >
                    <SelectTrigger id={roleId} className="w-full" aria-invalid={fieldState.invalid} onBlur={field.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>{roleDescriptions[field.value]}</FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending && <Spinner />}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
