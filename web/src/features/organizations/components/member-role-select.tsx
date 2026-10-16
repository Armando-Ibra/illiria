import type { Member, OrganizationRole } from "@/api/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** A member's role, editable in place. `options` are the roles the current user may grant. */
export function MemberRoleSelect({
  member,
  options,
  pending,
  onChange,
}: {
  member: Member
  options: OrganizationRole[]
  pending: boolean
  onChange: (role: OrganizationRole) => void
}) {
  return (
    <Select
      items={options.map((role) => ({ value: role, label: role }))}
      value={member.role}
      disabled={pending}
      onValueChange={(role) => {
        if (role && role !== member.role) onChange(role)
      }}
    >
      <SelectTrigger size="sm" className="w-28" aria-label={`Role for ${member.email}`}>
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
  )
}
