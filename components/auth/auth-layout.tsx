"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Boxes, Globe, User } from "lucide-react"

import { AuthTestimonial } from "@/components/auth/auth-testimonial"
import { getSafeRedirectUrl } from "@/components/auth/redirect-url"

interface AuthLayoutProps {
  /** Centered heading above the form, e.g. "Login to your account". */
  title: string
  /** Muted line under the heading, e.g. "Enter your details to login.". */
  subtitle: string
  /** Top-bar prompt, e.g. "Don't have an account?". */
  altPrompt: string
  /** Top-bar link label, e.g. "Register". */
  altLabel: string
  /** Where the top-bar link points, e.g. "/sign-up". */
  altHref: string
  /** The Clerk `<SignIn />` / `<SignUp />` element. */
  children: React.ReactNode
}

/**
 * Two-panel auth shell: form column on the left (always visible), testimonial
 * on the right (hidden below `lg`). Mirrors the reference layout — logo and a
 * secondary auth link in the top bar, avatar + title + form centered, footer
 * chrome pinned to the bottom.
 */
export function AuthLayout({
  title,
  subtitle,
  altPrompt,
  altLabel,
  altHref,
  children,
}: AuthLayoutProps) {
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get("redirect_url")
  // Carry a validated return destination across the sign-in/sign-up switch
  // link, so a guest bounced here from a protected route (e.g. /editor) ends
  // up back there after using the other form.
  const switchHref = redirectUrl
    ? `${altHref}?redirect_url=${encodeURIComponent(getSafeRedirectUrl(redirectUrl))}`
    : altHref

  return (
    <div className="grid h-svh overflow-hidden lg:grid-cols-2">
      <div className="flex flex-col overflow-y-auto px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground"
            aria-label="ArchBoard home"
          >
            <Boxes className="h-6 w-6 text-primary" />
            <span className="text-sm font-semibold">ArchBoard</span>
          </Link>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">
              {altPrompt}
            </span>
            <Link
              href={switchHref}
              className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground transition-colors hover:bg-accent"
            >
              {altLabel}
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex flex-col items-center text-center">
              <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card ring-1 ring-border/40">
                <User className="h-6 w-6 text-muted-foreground" />
              </span>
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>

            {children}
          </div>
        </main>

        <footer className="flex items-center justify-between text-xs text-[var(--text-subtle)]">
          <span>© {new Date().getFullYear()} ArchBoard</span>
          <span className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            ENG
          </span>
        </footer>
      </div>

      <AuthTestimonial />
    </div>
  )
}
