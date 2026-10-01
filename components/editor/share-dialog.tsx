"use client"

import * as React from "react"
import { Check, Copy, Link2, Trash2 } from "lucide-react"
import { cn } from "cn"

import {
  createShareLink,
  revokeShareLink,
} from "@/app/editor/[projectId]/share-actions"
import { DialogPattern } from "@/components/editor/dialog-pattern"
import { Button } from "@/components/ui/button"
import {
  shareUrl,
  type ShareLinkItem,
  type ShareRoleValue,
} from "@/lib/share"

const COPIED_RESET_MS = 1500

const ROLE_OPTIONS: { value: ShareRoleValue; label: string }[] = [
  { value: "VIEW", label: "Can view" },
  { value: "EDIT", label: "Can edit" },
]

const ROLE_LABEL: Record<ShareRoleValue, string> = {
  VIEW: "View",
  EDIT: "Edit",
}

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  initialLinks: ShareLinkItem[]
}

/** Owner-only dialog for minting and revoking `/share/[token]` links. */
export function ShareDialog({
  open,
  onOpenChange,
  projectId,
  initialLinks,
}: ShareDialogProps) {
  const [role, setRole] = React.useState<ShareRoleValue>("EDIT")
  const [links, setLinks] = React.useState<ShareLinkItem[]>(initialLinks)
  const [error, setError] = React.useState<string | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [revokingIds, setRevokingIds] = React.useState<ReadonlySet<string>>(
    new Set()
  )
  const [isCreating, startCreate] = React.useTransition()
  const copiedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    },
    []
  )

  const handleOpenChange = (next: boolean) => {
    if (!next) setError(null)
    onOpenChange(next)
  }

  const handleCreate = () => {
    setError(null)
    startCreate(async () => {
      const result = await createShareLink({ projectId, role })
      if (result.ok) setLinks((current) => [result.link, ...current])
      else setError(result.error)
    })
  }

  const handleRevoke = async (linkId: string) => {
    setError(null)
    setRevokingIds((current) => new Set(current).add(linkId))
    const result = await revokeShareLink({ projectId, linkId })
    setRevokingIds((current) => {
      const next = new Set(current)
      next.delete(linkId)
      return next
    })
    if (result.ok) {
      setLinks((current) => current.filter((link) => link.id !== linkId))
    } else {
      setError(result.error)
    }
  }

  const handleCopy = async (link: ShareLinkItem, input: HTMLInputElement | null) => {
    const url = window.location.origin + shareUrl(link.token)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(link.id)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(
        () => setCopiedId(null),
        COPIED_RESET_MS
      )
    } catch {
      // Clipboard API unavailable or denied: leave the URL selected to copy by hand.
      input?.focus()
      input?.select()
    }
  }

  return (
    <DialogPattern
      open={open}
      onOpenChange={handleOpenChange}
      title="Share this board"
      description="Anyone with the link can view or edit without an account."
    >
      <div className="flex flex-col gap-4">
        {/* Segmented role switcher: a recessed dark track with a raised active
            tab, the dark-theme take on a Public/Private style toggle. */}
        <div
          role="group"
          aria-label="Link permission"
          className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1"
        >
          {ROLE_OPTIONS.map((option) => {
            const active = role === option.value
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setRole(option.value)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-all",
                  active
                    ? "border border-border bg-secondary text-foreground shadow-sm"
                    : "border border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <Button
          type="button"
          className="w-full text-white"
          onClick={handleCreate}
          disabled={isCreating}
        >
          <Link2 className="h-4 w-4" strokeWidth={1.5} />
          {isCreating ? "Creating…" : "Create link"}
        </Button>

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}

        {links.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            No active links yet
          </p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {links.map((link) => (
              <ShareLinkRow
                key={link.id}
                link={link}
                copied={copiedId === link.id}
                revoking={revokingIds.has(link.id)}
                onCopy={handleCopy}
                onRevoke={handleRevoke}
              />
            ))}
          </ul>
        )}
      </div>
    </DialogPattern>
  )
}

interface ShareLinkRowProps {
  link: ShareLinkItem
  copied: boolean
  revoking: boolean
  onCopy: (link: ShareLinkItem, input: HTMLInputElement | null) => void
  onRevoke: (linkId: string) => void
}

function ShareLinkRow({
  link,
  copied,
  revoking,
  onCopy,
  onRevoke,
}: ShareLinkRowProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const path = shareUrl(link.token)

  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
      <span
        className={cn(
          "shrink-0 rounded-sm border px-1.5 py-0.5 text-xs font-medium",
          link.role === "EDIT"
            ? "border-primary/40 text-primary"
            : "border-border text-muted-foreground"
        )}
      >
        {ROLE_LABEL[link.role]}
      </span>
      <input
        ref={inputRef}
        readOnly
        value={path}
        title={path}
        aria-label={`Share link, ${ROLE_LABEL[link.role].toLowerCase()} access`}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 truncate bg-transparent font-mono text-xs text-foreground outline-none"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={copied ? "Link copied" : "Copy link"}
        onClick={() => onCopy(link, inputRef.current)}
      >
        {copied ? (
          <Check className="h-4 w-4 text-state-success" strokeWidth={1.5} />
        ) : (
          <Copy className="h-4 w-4" strokeWidth={1.5} />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="hover:text-state-error"
        aria-label="Revoke link"
        disabled={revoking}
        onClick={() => onRevoke(link.id)}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
      </Button>
    </li>
  )
}
