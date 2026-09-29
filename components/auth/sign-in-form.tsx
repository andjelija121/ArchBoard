"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSignIn } from "@clerk/nextjs"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getClerkErrorMessage } from "@/components/auth/clerk-error"
import { SocialButtons } from "@/components/auth/social-buttons"

export function SignInForm() {
  const { signIn } = useSignIn()
  const router = useRouter()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [keepLoggedIn, setKeepLoggedIn] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: passwordError } = await signIn.password({
        identifier: email,
        password,
      })
      if (passwordError) {
        setError(getClerkErrorMessage(passwordError))
        return
      }
      if (signIn.status === "complete") {
        await signIn.finalize()
        router.push("/editor")
        return
      }
      setError("Additional verification is required to finish signing in.")
    } catch (err) {
      setError(getClerkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOAuth(strategy: "oauth_google" | "oauth_github") {
    if (submitting) return
    setError(null)
    try {
      await signIn.sso({
        strategy,
        redirectUrl: "/editor",
        redirectCallbackUrl: "/sso-callback",
      })
    } catch (err) {
      setError(getClerkErrorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <SocialButtons onSelect={handleOAuth} disabled={submitting} />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-[var(--text-subtle)]">
          Or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
          Email Address <span className="text-primary">*</span>
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="hello@archboard.dev"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-lg pl-9"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-xs font-medium text-muted-foreground"
        >
          Password <span className="text-primary">*</span>
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-lg px-9"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] transition-colors hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={keepLoggedIn}
            onChange={(e) => setKeepLoggedIn(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-card accent-[var(--accent-primary)]"
          />
          Keep me logged in
        </label>
        <button
          type="button"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Forgot password?
        </button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={submitting}
        className="h-11 rounded-lg bg-foreground text-background hover:bg-foreground/90"
      >
        {submitting ? "Signing in…" : "Login"}
      </Button>
    </form>
  )
}
