import type { Invitation } from "@/api/types"
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

export function RevokeInvitationDialog({
  invitation,
  open,
  pending,
  onConfirm,
  onOpenChange,
}: {
  invitation: Invitation | undefined
  open: boolean
  pending: boolean
  onConfirm: (invitation: Invitation) => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
          <AlertDialogDescription>
            The invitation link sent to {invitation?.email} will stop working. You can invite them again later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={() => invitation && onConfirm(invitation)}>
            {pending && <Spinner />}
            Revoke
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
