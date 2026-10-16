import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import type { Project } from "@/api/types"
import { FormError } from "@/components/form-error"
import { TextareaField, TextField } from "@/components/form-fields"
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
import { useCreateProject, useUpdateProject } from "@/features/projects/api"
import { applyApiError } from "@/lib/forms"

// Same limits as the API's SaveProjectRequestValidator.
const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200, "Use at most 200 characters."),
  description: z.string().trim().max(2000, "Use at most 2000 characters."),
})

type Values = z.infer<typeof schema>

/** Create (`project` undefined) or edit a project. Controlled: the page owns `open`. */
export function ProjectDialog({
  orgId,
  project,
  open,
  onOpenChange,
}: {
  orgId: string
  project?: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateProject(orgId)
  const update = useUpdateProject(orgId)
  const pending = create.isPending || update.isPending
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", description: "" } })

  // Start from the edited project (or blank) each time the dialog opens.
  useEffect(() => {
    if (open) form.reset({ name: project?.name ?? "", description: project?.description ?? "" })
  }, [open, project, form])

  const onSubmit = form.handleSubmit(({ name, description }) => {
    const body = { name, description: description || null }
    const callbacks = {
      onSuccess: () => {
        toast.success(project ? "Project saved." : `${name} created.`)
        onOpenChange(false)
      },
      onError: (error: Error) => applyApiError(form, error),
    }
    if (project) update.mutate({ id: project.id, ...body }, callbacks)
    else create.mutate(body, callbacks)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription>
              {project ? "Update the project's details." : "Projects are visible to everyone in the organization."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <FormError form={form} />
            <TextField control={form.control} name="name" label="Name" autoComplete="off" />
            <TextareaField control={form.control} name="description" label="Description" rows={3} placeholder="Optional" />
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {project ? "Save" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
