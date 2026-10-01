"use client"

import * as React from "react"
import {
  Boxes,
  Cable,
  CircleHelp,
  Hand,
  ListPlus,
  MousePointerClick,
  PanelRightClose,
  Pencil,
  Search,
  SearchX,
  SquareDashedMousePointer,
  Trash2,
  Ungroup,
  ZoomIn,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface HelpItem {
  icon: LucideIcon
  title: string
  description: string
  // Printed as keycaps on the right; omitted when the action has no gesture.
  keys?: string[]
}

interface HelpSection {
  title: string
  items: HelpItem[]
}

// "Ctrl/⌘": React Flow accepts whichever modifier the OS uses.
const SECTIONS: HelpSection[] = [
  {
    title: "Select",
    items: [
      {
        icon: MousePointerClick,
        title: "Select",
        description: "Pick a node, box or edge",
        keys: ["Click"],
      },
      {
        icon: ListPlus,
        title: "Add to selection",
        description: "Select several nodes one by one",
        keys: ["Ctrl/⌘", "Click"],
      },
      {
        icon: SquareDashedMousePointer,
        title: "Select an area",
        description: "Drag a rectangle around the nodes",
        keys: ["Shift", "Drag"],
      },
      {
        icon: MousePointerClick,
        title: "Deselect",
        description: "Click an empty spot on the canvas",
        keys: ["Click"],
      },
    ],
  },
  {
    title: "Group",
    items: [
      {
        icon: Boxes,
        title: "Group nodes",
        description: "Select 2 or more nodes, then press Group in the toolbar",
      },
      {
        icon: Boxes,
        title: "Move a box",
        description: "Everything inside the box moves with it",
        keys: ["Drag"],
      },
      {
        icon: Ungroup,
        title: "Ungroup",
        description: "Select the box, then Ungroup in the side panel. The nodes stay",
      },
    ],
  },
  {
    title: "Connect",
    items: [
      {
        icon: Cable,
        title: "Connect nodes",
        description: "Pull from a right-hand dot to a left-hand dot. Boxes have dots too",
        keys: ["Drag"],
      },
      {
        icon: Pencil,
        title: "Edit a connection",
        description: "Set protocol, sync or async, API route and load",
        keys: ["Click"],
      },
    ],
  },
  {
    title: "Canvas",
    items: [
      {
        icon: Hand,
        title: "Pan",
        description: "Drag an empty spot on the canvas",
        keys: ["Drag"],
      },
      {
        icon: ZoomIn,
        title: "Zoom",
        description: "Scroll or pinch",
        keys: ["Scroll"],
      },
    ],
  },
  {
    title: "Delete and close",
    items: [
      {
        icon: Trash2,
        title: "Delete selected",
        description: "Deleting a box keeps the nodes inside it",
        keys: ["Backspace"],
      },
      {
        icon: PanelRightClose,
        title: "Close the side panel",
        description: "Same as the X in its corner",
        keys: ["Esc"],
      },
    ],
  },
]

const TOTAL_ITEMS = SECTIONS.reduce((sum, s) => sum + s.items.length, 0)

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-sm border border-border bg-background px-1.5 font-mono text-xs text-muted-foreground">
      {children}
    </kbd>
  )
}

function HelpRow({ item }: { item: HelpItem }) {
  const Icon = item.icon
  return (
    <li className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">
          {item.title}
        </span>
        <span className="text-xs text-muted-foreground">
          {item.description}
        </span>
      </div>
      {item.keys && (
        <span className="flex shrink-0 items-center gap-1">
          {item.keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </span>
      )}
    </li>
  )
}

function matches(section: HelpSection, item: HelpItem, query: string) {
  const haystack = [
    section.title,
    item.title,
    item.description,
    ...(item.keys ?? []),
  ]
    .join(" ")
    .toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term))
}

/** Top-bar help button that opens a searchable list of canvas gestures. */
export function HelpButton() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const visible = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => matches(section, item, query)),
  })).filter((section) => section.items.length > 0)
  const visibleCount = visible.reduce((sum, s) => sum + s.items.length, 0)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setQuery("")
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Help and shortcuts"
        title="Help and shortcuts"
        onClick={() => setOpen(true)}
      >
        <CircleHelp className="h-4 w-4" strokeWidth={1.5} />
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden bg-card p-0 sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Help and shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            Searchable list of canvas gestures and keyboard shortcuts.
          </DialogDescription>

          <div className="flex h-14 items-center gap-3 border-b border-border px-4">
            <Search
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search help and shortcuts…"
              aria-label="Search help and shortcuts"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ScrollArea className="h-96 max-h-[55vh]">
            {visibleCount === 0 ? (
              <div className="flex h-80 flex-col items-center justify-center gap-2 px-6 text-center">
                <SearchX
                  className="h-8 w-8 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <p className="text-sm font-medium text-foreground">
                  No results for &ldquo;{query.trim()}&rdquo;
                </p>
                <p className="text-xs text-muted-foreground">
                  Try &ldquo;group&rdquo;, &ldquo;delete&rdquo; or
                  &ldquo;zoom&rdquo;.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-2">
                {visible.map((section) => (
                  <section key={section.title}>
                    <h3 className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                      {section.title}
                    </h3>
                    <ul className="flex flex-col">
                      {section.items.map((item) => (
                        <HelpRow key={item.title} item={item} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              {query.trim()
                ? `${visibleCount} of ${TOTAL_ITEMS}`
                : `${TOTAL_ITEMS} tips`}
            </span>
            <span className="flex items-center gap-2">
              <Kbd>Esc</Kbd>
              Close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
