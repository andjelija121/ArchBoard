"use client"

import Link from "next/link"
import { Pencil, Plus, Trash2, X } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import type { ProjectListItem } from "@/lib/projects"

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
  ownedProjects: ProjectListItem[]
  sharedProjects: ProjectListItem[]
  onCreateProject: () => void
  onRenameProject: (project: ProjectListItem) => void
  onDeleteProject: (project: ProjectListItem) => void
}

export function ProjectSidebar({
  isOpen,
  onClose,
  ownedProjects,
  sharedProjects,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
}: ProjectSidebarProps) {
  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 ease-in-out lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        inert={!isOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-border bg-card transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
          <h2 className="text-base font-semibold text-foreground">
            Projects
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close projects panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs
          defaultValue="my-projects"
          className="flex flex-1 flex-col overflow-hidden px-3 pt-3"
        >
          <TabsList className="w-full">
            <TabsTrigger value="my-projects" className="flex-1">
              My Projects
            </TabsTrigger>
            <TabsTrigger value="shared" className="flex-1">
              Shared
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="my-projects"
            className="flex flex-1 flex-col overflow-hidden"
          >
            {ownedProjects.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  No projects yet.
                </p>
              </div>
            ) : (
              <ul className="flex flex-1 flex-col gap-1 overflow-y-auto py-2">
                {ownedProjects.map((project) => (
                  <li
                    key={project.id}
                    className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-muted"
                  >
                    <Link
                      href={`/editor/${project.id}`}
                      onClick={onClose}
                      className="flex-1 truncate rounded-sm text-sm text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {project.name}
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Rename ${project.name}`}
                      onClick={() => onRenameProject(project)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Delete ${project.name}`}
                      onClick={() => onDeleteProject(project)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent
            value="shared"
            className="flex flex-1 flex-col overflow-hidden"
          >
            {sharedProjects.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Nothing shared yet.
                </p>
              </div>
            ) : (
              <ul className="flex flex-1 flex-col gap-1 overflow-y-auto py-2">
                {sharedProjects.map((project) => (
                  <li
                    key={project.id}
                    className="flex items-center rounded-lg px-2 py-1.5 hover:bg-muted"
                  >
                    <span className="flex-1 truncate text-sm text-foreground">
                      {project.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        <div className="shrink-0 border-t border-border p-3">
          <Button className="w-full" onClick={onCreateProject}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </aside>
    </>
  )
}
