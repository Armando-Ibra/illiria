import type * as React from "react"

import type { Member } from "@/api/types"
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
import { Spinner } from "@/components/states"

export function RemoveMemberDialog({
  member,
  open,
  isSelf,
  pending,
  onConfirm,
  onOpenChange,
}: {
  member: Member | undefined
  open: boolean
  isSelf: boolean
  pending: boolean
  onConfirm: (member: Member) => void
  onOpenChange: (open: boolean) => void
}): React.ReactElement {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isSelf ? "Leave this organization?" : "Remove member?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isSelf
              ? "You'll lose access to its projects until someone invites you again."
              : `${member?.email} will lose access to this organization and its projects.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={() => member && onConfirm(member)}>
            {pending && <Spinner />}
            {isSelf ? "Leave" : "Remove"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
