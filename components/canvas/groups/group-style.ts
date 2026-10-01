import type { GroupColor } from "@/lib/canvas"

// Spelled out per color so Tailwind's scanner emits every class. Shared by the
// box node and the property panel's color picker so the two never fork.
export const GROUP_STYLE: Record<
  GroupColor,
  { border: string; bg: string; icon: string; swatch: string }
> = {
  slate: {
    border: "border-group-slate",
    bg: "bg-group-slate-bg",
    icon: "text-group-slate",
    swatch: "bg-group-slate",
  },
  cyan: {
    border: "border-group-cyan",
    bg: "bg-group-cyan-bg",
    icon: "text-group-cyan",
    swatch: "bg-group-cyan",
  },
  amber: {
    border: "border-group-amber",
    bg: "bg-group-amber-bg",
    icon: "text-group-amber",
    swatch: "bg-group-amber",
  },
  green: {
    border: "border-group-green",
    bg: "bg-group-green-bg",
    icon: "text-group-green",
    swatch: "bg-group-green",
  },
  purple: {
    border: "border-group-purple",
    bg: "bg-group-purple-bg",
    icon: "text-group-purple",
    swatch: "bg-group-purple",
  },
}
