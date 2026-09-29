/**
 * Right-hand panel of the auth screens (hidden below `lg`). Replaces the
 * reference design's carousel dots with a standing section title, plus a
 * single fabricated developer testimonial.
 */
export function AuthTestimonial() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden border-l border-border bg-card p-12 lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(var(--border-default) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage:
            "radial-gradient(ellipse at 70% 30%, black, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 70% 30%, black, transparent 75%)",
        }}
      />

      <div className="relative">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-subtle)]">
          Trusted by engineers
        </span>
        <h2 className="mt-4 max-w-md text-2xl font-semibold leading-snug text-foreground">
          Design the system before you build it.
        </h2>
      </div>

      <blockquote className="relative max-w-lg">
        <p className="text-xl font-medium leading-relaxed text-foreground">
          &ldquo;ArchBoard replaced three tools in our design reviews. I
          scaffolded an entire event-driven backend from a single prompt,
          dropped in the API contracts, and shared a live link before standup
          even ended.&rdquo;
        </p>
        <footer className="mt-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background font-mono text-sm text-muted-foreground">
            MR
          </span>
          <div className="leading-tight">
            <div className="text-sm font-medium text-foreground">
              Marcus Reyes
            </div>
            <div className="text-xs text-muted-foreground">
              Staff Engineer, Nimbus Labs
            </div>
          </div>
        </footer>
      </blockquote>
    </aside>
  )
}
