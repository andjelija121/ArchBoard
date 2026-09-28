"use client"

import { Plus, X } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Renders placeholder project tabs, initially selecting My Projects, and a
 * New Project button with no action yet. When isOpen is false, the panel stays
 * mounted offscreen with aria-hidden set. The close button calls onClose;
 * the parent controls visibility.
 */
export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  return (
    <aside
      aria-hidden={!isOpen}
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-80 flex-col border-r border-border bg-card transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="text-base font-semibold text-foreground">Projects</h2>
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
          className="flex flex-1 items-center justify-center"
        >
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        </TabsContent>

        <TabsContent
          value="shared"
          className="flex flex-1 items-center justify-center"
        >
          <p className="text-sm text-muted-foreground">Nothing shared yet.</p>
        </TabsContent>
      </Tabs>

      <div className="shrink-0 border-t border-border p-3">
        <Button className="w-full">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>
    </aside>
  )
}
