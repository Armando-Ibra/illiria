import { useQuery, useQueryClient } from "@tanstack/react-query"
import { MailIcon } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import type { Member } from "@/api/types"
import { PageHeader } from "@/components/page-header"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMe } from "@/features/auth/api"
import { invitationsQueryOptions, membersQueryOptions, useRemoveMember } from "@/features/organizations/api"
import { InviteDialog } from "@/features/organizations/components/invite-dialog"
import { RemoveMemberDialog } from "@/features/organizations/components/remove-member-dialog"
import { RoleBadge } from "@/features/organizations/components/role-badge"
import { useCurrentOrganization } from "@/features/organizations/use-current-organization"
import { formatDate } from "@/lib/format"
import { meQueryKey } from "@/lib/query-client"

export function MembersPage() {
  const organization = useCurrentOrganization()
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const members = useQuery(membersQueryOptions(organization.id))
  const remove = useRemoveMember(organization.id)
  // Keeps the member while the dialog closes, so its text doesn't change mid-animation.
  const [removing, setRemoving] = useState<{ open: boolean; member?: Member }>({ open: false })

  const ownerCount = members.data?.filter((member) => member.role === "Owner").length ?? 0

  /** Mirrors the API's rules, so we don't offer actions it would refuse. */
  const canRemove = (member: Member) => {
    if (!organization.isAdmin) return false
    if (member.role === "Owner" && organization.role !== "Owner") return false
    if (member.role === "Owner" && ownerCount <= 1) return false // the last owner stays
    return true
  }

  const onConfirmRemove = (member: Member) =>
    remove.mutate(member.userId, {
      onSuccess: async () => {
        setRemoving((state) => ({ ...state, open: false }))
        if (member.userId === me.id) {
          toast.success(`You left ${organization.name}.`)
          await queryClient.invalidateQueries({ queryKey: meQueryKey })
          navigate("/", { replace: true })
        } else {
          toast.success(`${member.email} was removed.`)
        }
      },
    })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Members"
        description={`People with access to ${organization.name}.`}
        actions={organization.isAdmin && <InviteDialog orgId={organization.id} myRole={organization.role} />}
      />

      <section aria-label="Members">
        {members.isPending ? (
          <LoadingState />
        ) : members.isError ? (
          <ErrorState error={members.error} onRetry={() => members.refetch()} />
        ) : (
          <div className="rounded-xl ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Joined</TableHead>
                  <TableHead className="w-0 pr-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.data.map((member) => {
                  const isSelf = member.userId === me.id
                  return (
                    <TableRow key={member.userId}>
                      <TableCell className="pl-4 font-medium">
                        <span className="flex items-center gap-2">
                          {member.email}
                          {isSelf && <Badge variant="secondary">You</Badge>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={member.role} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {formatDate(member.joinedAt)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {canRemove(member) && (
                          <Button variant="ghost" size="sm" onClick={() => setRemoving({ open: true, member })}>
                            {isSelf ? "Leave" : "Remove"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {organization.isAdmin && <PendingInvitations orgId={organization.id} />}

      <RemoveMemberDialog
        member={removing.member}
        open={removing.open}
        isSelf={removing.member?.userId === me.id}
        pending={remove.isPending}
        onConfirm={onConfirmRemove}
        onOpenChange={(open) => setRemoving((state) => ({ ...state, open }))}
      />
    </div>
  )
}

function PendingInvitations({ orgId }: { orgId: string }) {
  const invitations = useQuery(invitationsQueryOptions(orgId))

  return (
    <section aria-labelledby="pending-invitations" className="space-y-3">
      <h2 id="pending-invitations" className="font-medium">
        Pending invitations
      </h2>
      {invitations.isPending ? (
        <LoadingState />
      ) : invitations.isError ? (
        <ErrorState error={invitations.error} onRetry={() => invitations.refetch()} />
      ) : invitations.data.length === 0 ? (
        <EmptyState icon={MailIcon} title="No pending invitations" description="Invitations you send show up here until they're accepted." />
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden pr-4 sm:table-cell">Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.data.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="pl-4">{invitation.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={invitation.role} />
                  </TableCell>
                  <TableCell className="hidden pr-4 text-muted-foreground sm:table-cell">
                    {formatDate(invitation.expiresAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
