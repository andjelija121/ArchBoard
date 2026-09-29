"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSignIn } from "@clerk/nextjs"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getClerkErrorMessage } from "@/components/auth/clerk-error"
import { getSafeRedirectUrl } from "@/components/auth/redirect-url"
import { SocialButtons } from "@/components/auth/social-buttons"

type Mode =
  | "password"
  | "mfa-verify"
  | "reset-request"
  | "reset-verify"
  | "reset-new-password"

export function SignInForm() {
  const { signIn } = useSignIn()
  const router = useRouter()
  const searchParams = useSearchParams()
  const destination = getSafeRedirectUrl(searchParams.get("redirect_url"))

  const [mode, setMode] = React.useState<Mode>("password")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  // Cosmetic only — Clerk has no public "remember me" / session-length
  // toggle on sign-in; session persistence is managed by Clerk itself.
  const [keepLoggedIn, setKeepLoggedIn] = React.useState(true)
  const [code, setCode] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function finalizeAndNavigate() {
    const { error: finalizeError } = await signIn.finalize()
    if (finalizeError) {
      setError(getClerkErrorMessage(finalizeError))
      return
    }
    router.push(destination)
  }

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
        await finalizeAndNavigate()
        return
      }
      if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
        const { error: mfaError } = await signIn.mfa.sendEmailCode()
        if (mfaError) {
          setError(getClerkErrorMessage(mfaError))
          return
        }
        setMode("mfa-verify")
        return
      }
      setError("Additional verification is required to finish signing in.")
    } catch (err) {
      setError(getClerkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMfaVerify(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: verifyError } = await signIn.mfa.verifyEmailCode({ code })
      if (verifyError) {
        setError(getClerkErrorMessage(verifyError))
        return
      }
      if (signIn.status === "complete") {
        await finalizeAndNavigate()
        return
      }
      setError("That code didn't work. Check your email and try again.")
    } catch (err) {
      setError(getClerkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOAuth(strategy: "oauth_google" | "oauth_github") {
    if (submitting) return
    setError(null)
    const { error: ssoError } = await signIn.sso({
      strategy,
      redirectUrl: destination,
      redirectCallbackUrl: "/sso-callback",
    })
    if (ssoError) {
      setError(getClerkErrorMessage(ssoError))
    }
  }

  async function handleResetRequest(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: createError } = await signIn.create({ identifier: email })
      if (createError) {
        setError(getClerkErrorMessage(createError))
        return
      }
      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode()
      if (sendError) {
        setError(getClerkErrorMessage(sendError))
        return
      }
      setMode("reset-verify")
    } catch (err) {
      setError(getClerkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetVerify(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({
        code,
      })
      if (verifyError) {
        setError(getClerkErrorMessage(verifyError))
        return
      }
      setMode("reset-new-password")
    } catch (err) {
      setError(getClerkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: submitError } = await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
      })
      if (submitError) {
        setError(getClerkErrorMessage(submitError))
        return
      }
      if (signIn.status === "complete") {
        await finalizeAndNavigate()
        return
      }
      setError("Couldn't finish resetting your password. Please try again.")
    } catch (err) {
      setError(getClerkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function resetToPasswordMode() {
    setMode("password")
    setCode("")
    setNewPassword("")
    setError(null)
  }

  if (mode === "mfa-verify") {
    return (
      <form onSubmit={handleMfaVerify} className="flex flex-col gap-5">
        <p className="text-center text-sm text-muted-foreground">
          Enter the 6-digit code we sent to{" "}
          <span className="text-foreground">{email}</span> to finish signing in.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="mfa-code" className="text-xs font-medium text-muted-foreground">
            Verification code <span className="text-primary">*</span>
          </label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-11 rounded-lg text-center font-mono tracking-[0.4em]"
          />
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
          {submitting ? "Verifying…" : "Verify"}
        </Button>
        <button
          type="button"
          onClick={resetToPasswordMode}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </button>
      </form>
    )
  }

  if (mode === "reset-request") {
    return (
      <form onSubmit={handleResetRequest} className="flex flex-col gap-5">
        <p className="text-center text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a code to reset your password.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-email" className="text-xs font-medium text-muted-foreground">
            Email Address <span className="text-primary">*</span>
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
            <Input
              id="reset-email"
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
          {submitting ? "Sending…" : "Send reset code"}
        </Button>
        <button
          type="button"
          onClick={resetToPasswordMode}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </button>
      </form>
    )
  }

  if (mode === "reset-verify") {
    return (
      <form onSubmit={handleResetVerify} className="flex flex-col gap-5">
        <p className="text-center text-sm text-muted-foreground">
          Enter the 6-digit code we sent to{" "}
          <span className="text-foreground">{email}</span>.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-code" className="text-xs font-medium text-muted-foreground">
            Reset code <span className="text-primary">*</span>
          </label>
          <Input
            id="reset-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-11 rounded-lg text-center font-mono tracking-[0.4em]"
          />
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
          {submitting ? "Verifying…" : "Verify code"}
        </Button>
      </form>
    )
  }

  if (mode === "reset-new-password") {
    return (
      <form onSubmit={handleResetSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password" className="text-xs font-medium text-muted-foreground">
            New password <span className="text-primary">*</span>
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
            <Input
              id="new-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              placeholder="••••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-11 rounded-lg px-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
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
          {submitting ? "Saving…" : "Set new password"}
        </Button>
      </form>
    )
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
          onClick={() => {
            setMode("reset-request")
            setError(null)
          }}
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
