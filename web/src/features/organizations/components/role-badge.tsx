import type { OrganizationRole } from "@/api/types"
import { Badge } from "@/components/ui/badge"

const variants = { Owner: "default", Admin: "secondary", Member: "outline" } as const

export function RoleBadge({ role }: { role: OrganizationRole }) {
  return <Badge variant={variants[role]}>{role}</Badge>
}
