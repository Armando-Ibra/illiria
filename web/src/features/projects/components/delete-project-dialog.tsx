import { toast } from "sonner"

import type { Project } from "@/api/types"
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
import { useDeleteProject } from "@/features/projects/api"

export function DeleteProjectDialog({
  orgId,
  project,
  open,
  onOpenChange,
}: {
  orgId: string
  project: Project | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const remove = useDeleteProject(orgId)

  const onConfirm = () => {
    if (!project) return
    remove.mutate(project.id, {
      onSuccess: () => {
        toast.success(`${project.name} deleted.`)
        onOpenChange(false)
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>
            “{project?.name}” will be permanently deleted. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={remove.isPending}>
            {remove.isPending && <Spinner />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
