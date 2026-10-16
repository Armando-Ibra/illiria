import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

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
import { meQueryOptions } from "@/features/auth/api"
import { organizationKeys, useLeaveOrganization } from "@/features/organizations/api"
import { useCurrentOrganization } from "@/features/organizations/use-current-organization"

/** "Danger zone" of the members page: any member can leave (the API keeps the last owner, with a 409). */
export function LeaveOrganization() {
  const organization = useCurrentOrganization()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const leave = useLeaveOrganization(organization.id)
  const [open, setOpen] = useState(false)

  const onConfirm = () =>
    leave.mutate(undefined, {
      onSuccess: async () => {
        setOpen(false)
        toast.success(`You left ${organization.name}.`)
        // Fresh /api/me first: "/" then picks another organization, onboarding (multi-tenant) or "no access".
        await queryClient.fetchQuery({ ...meQueryOptions, staleTime: 0 })
        await navigate("/", { replace: true })
        queryClient.removeQueries({ queryKey: organizationKeys.all(organization.id) })
      },
      // The error itself is a toast (e.g. "Make someone else an owner before leaving.").
      onError: () => setOpen(false),
    })

  return (
    <section aria-labelledby="danger-zone" className="space-y-3">
      <h2 id="danger-zone" className="font-medium">
        Danger zone
      </h2>
      <div className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-destructive/30 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm">
          <p className="font-medium">Leave {organization.name}</p>
          <p className="text-muted-foreground">
            You'll lose access to its projects until someone invites you again.
            {organization.role === "Owner" && " If you're the only owner, make someone else an owner first."}
          </p>
        </div>
        <Button variant="destructive" className="shrink-0" onClick={() => setOpen(true)}>
          Leave organization
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {organization.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll lose access to its projects until someone invites you again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={leave.isPending} onClick={onConfirm}>
              {leave.isPending && <Spinner />}
              Leave
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
