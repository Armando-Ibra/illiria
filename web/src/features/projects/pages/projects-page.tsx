import { useQuery } from "@tanstack/react-query"
import { FolderKanbanIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import type { Project } from "@/api/types"
import { PageHeader } from "@/components/page-header"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCurrentOrganization } from "@/features/organizations/use-current-organization"
import { projectsQueryOptions } from "@/features/projects/api"
import { DeleteProjectDialog } from "@/features/projects/components/delete-project-dialog"
import { ProjectDialog } from "@/features/projects/components/project-dialog"
import { formatDateTime } from "@/lib/format"

/** Dialog state keeps the project while closing, so the content doesn't change mid-animation. */
type DialogState = { open: boolean; project?: Project }

export function ProjectsPage() {
  const organization = useCurrentOrganization()
  const projects = useQuery(projectsQueryOptions(organization.id))
  const [editing, setEditing] = useState<DialogState>({ open: false })
  const [deleting, setDeleting] = useState<DialogState>({ open: false })

  const newProjectButton = (
    <Button onClick={() => setEditing({ open: true })}>
      <PlusIcon data-icon="inline-start" />
      New project
    </Button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description={`Everything ${organization.name} is working on.`}
        actions={projects.data?.length ? newProjectButton : undefined}
      />

      {projects.isPending ? (
        <LoadingState />
      ) : projects.isError ? (
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
      ) : projects.data.length === 0 ? (
        <EmptyState
          icon={FolderKanbanIcon}
          title="No projects yet"
          description="Create the first project for your organization."
          action={newProjectButton}
        />
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead className="hidden md:table-cell">Updated</TableHead>
                <TableHead className="w-0 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.data.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="max-w-0 pl-4 whitespace-normal">
                    <div className="truncate font-medium">{project.name}</div>
                    {project.description && (
                      <div className="truncate text-muted-foreground">{project.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {formatDateTime(project.updatedAt)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${project.name}`} />}
                      >
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => setEditing({ open: true, project })}>
                          <PencilIcon />
                          Edit
                        </DropdownMenuItem>
                        {organization.isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleting({ open: true, project })}>
                              <Trash2Icon />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProjectDialog
        orgId={organization.id}
        project={editing.project}
        open={editing.open}
        onOpenChange={(open) => setEditing((state) => ({ ...state, open }))}
      />
      <DeleteProjectDialog
        orgId={organization.id}
        project={deleting.project}
        open={deleting.open}
        onOpenChange={(open) => setDeleting((state) => ({ ...state, open }))}
      />
    </div>
  )
}
