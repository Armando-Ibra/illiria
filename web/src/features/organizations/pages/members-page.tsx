import { useQuery } from "@tanstack/react-query"
import { MailIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { Invitation, Member, OrganizationRole } from "@/api/types"
import { PageHeader } from "@/components/page-header"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMe } from "@/features/auth/api"
import {
  invitationsQueryOptions,
  membersQueryOptions,
  useChangeMemberRole,
  useRemoveMember,
  useRevokeInvitation,
} from "@/features/organizations/api"
import { InviteDialog } from "@/features/organizations/components/invite-dialog"
import { LeaveOrganization } from "@/features/organizations/components/leave-organization"
import { MemberRoleSelect } from "@/features/organizations/components/member-role-select"
import { RemoveMemberDialog } from "@/features/organizations/components/remove-member-dialog"
import { RevokeInvitationDialog } from "@/features/organizations/components/revoke-invitation-dialog"
import { RoleBadge } from "@/features/organizations/components/role-badge"
import { useCurrentOrganization } from "@/features/organizations/use-current-organization"
import { formatDate } from "@/lib/format"
import { grantableRoles } from "@/lib/roles"

export function MembersPage() {
  const organization = useCurrentOrganization()
  const me = useMe()
  const members = useQuery(membersQueryOptions(organization.id))
  const remove = useRemoveMember(organization.id)
  const changeRole = useChangeMemberRole(organization.id)
  // Keeps the member while the dialog closes, so its text doesn't change mid-animation.
  const [removing, setRemoving] = useState<{ open: boolean; member?: Member }>({ open: false })

  const isOwner = organization.role === "Owner"
  const roleOptions = grantableRoles(organization.role)

  /*
   * Mirrors the API's rules, so we don't offer actions it would refuse: admins manage members, nobody grants a
   * role above their own, only owners touch owners. The API also keeps the last owner (409, shown as a toast).
   */
  const canChangeRole = (member: Member) => organization.isAdmin && (member.role !== "Owner" || isOwner)
  const canRemove = (member: Member) => canChangeRole(member) && member.userId !== me.id

  const onChangeRole = (member: Member, role: OrganizationRole) =>
    changeRole.mutate(
      { userId: member.userId, role },
      { onSuccess: (updated) => toast.success(`${updated.email} is now ${updated.role === "Admin" ? "an" : "a"} ${updated.role}.`) },
    )

  const onConfirmRemove = (member: Member) =>
    remove.mutate(member.userId, {
      onSuccess: () => {
        setRemoving((state) => ({ ...state, open: false }))
        toast.success(`${member.email} was removed.`)
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
                {members.data.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell className="pl-4 font-medium">
                      <span className="flex items-center gap-2">
                        {member.email}
                        {member.userId === me.id && <Badge variant="secondary">You</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>
                      {canChangeRole(member) ? (
                        <MemberRoleSelect
                          member={member}
                          options={roleOptions}
                          pending={changeRole.isPending && changeRole.variables.userId === member.userId}
                          onChange={(role) => onChangeRole(member, role)}
                        />
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(member.joinedAt)}</TableCell>
                    <TableCell className="pr-4 text-right">
                      {canRemove(member) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove ${member.email}`}
                          onClick={() => setRemoving({ open: true, member })}
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {organization.isAdmin && <PendingInvitations orgId={organization.id} />}

      <LeaveOrganization />

      <RemoveMemberDialog
        member={removing.member}
        open={removing.open}
        pending={remove.isPending}
        onConfirm={onConfirmRemove}
        onOpenChange={(open) => setRemoving((state) => ({ ...state, open }))}
      />
    </div>
  )
}

function PendingInvitations({ orgId }: { orgId: string }) {
  const invitations = useQuery(invitationsQueryOptions(orgId))
  const revoke = useRevokeInvitation(orgId)
  const [revoking, setRevoking] = useState<{ open: boolean; invitation?: Invitation }>({ open: false })

  const onConfirmRevoke = (invitation: Invitation) =>
    revoke.mutate(invitation.id, {
      onSuccess: () => {
        setRevoking((state) => ({ ...state, open: false }))
        toast.success(`Invitation to ${invitation.email} revoked.`)
      },
    })

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
          <Table aria-labelledby="pending-invitations">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden sm:table-cell">Expires</TableHead>
                <TableHead className="w-0 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.data.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="pl-4">{invitation.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={invitation.role} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(invitation.expiresAt)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Revoke invitation for ${invitation.email}`}
                      onClick={() => setRevoking({ open: true, invitation })}
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RevokeInvitationDialog
        invitation={revoking.invitation}
        open={revoking.open}
        pending={revoke.isPending}
        onConfirm={onConfirmRevoke}
        onOpenChange={(open) => setRevoking((state) => ({ ...state, open }))}
      />
    </section>
  )
}
