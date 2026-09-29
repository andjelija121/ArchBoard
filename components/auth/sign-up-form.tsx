"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSignUp } from "@clerk/nextjs"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getClerkErrorMessage } from "@/components/auth/clerk-error"
import { getSafeRedirectUrl } from "@/components/auth/redirect-url"
import { SocialButtons } from "@/components/auth/social-buttons"

export function SignUpForm() {
  const { signUp } = useSignUp()
  const router = useRouter()
  const searchParams = useSearchParams()
  const destination = getSafeRedirectUrl(searchParams.get("redirect_url"))

  const [step, setStep] = React.useState<"details" | "verify">("details")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [code, setCode] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleDetails(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: passwordError } = await signUp.password({
        emailAddress: email,
        password,
      })
      if (passwordError) {
        setError(getClerkErrorMessage(passwordError))
        return
      }
      const { error: sendError } = await signUp.verifications.sendEmailCode()
      if (sendError) {
        setError(getClerkErrorMessage(sendError))
        return
      }
      setStep("verify")
    } catch (err) {
      setError(getClerkErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function finalizeAndNavigate() {
    const { error: finalizeError } = await signUp.finalize()
    if (finalizeError) {
      setError(getClerkErrorMessage(finalizeError))
      return
    }
    router.push(destination)
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({
        code,
      })
      if (verifyError) {
        setError(getClerkErrorMessage(verifyError))
        return
      }
      if (signUp.status === "complete") {
        await finalizeAndNavigate()
        return
      }
      if (signUp.status === "missing_requirements") {
        // The code was valid — the account just needs more info than this
        // form collects (e.g. name fields required in the Clerk dashboard).
        setError(
          `Your email is verified, but a few more details are needed to finish: ${signUp.missingFields.join(", ")}.`
        )
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
    const { error: ssoError } = await signUp.sso({
      strategy,
      redirectUrl: destination,
      redirectCallbackUrl: "/sso-callback",
    })
    if (ssoError) {
      setError(getClerkErrorMessage(ssoError))
    }
  }

  if (step === "verify") {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-5">
        <p className="text-center text-sm text-muted-foreground">
          Enter the 6-digit code we sent to{" "}
          <span className="text-foreground">{email}</span>.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="text-xs font-medium text-muted-foreground">
            Verification code <span className="text-primary">*</span>
          </label>
          <Input
            id="code"
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
          {submitting ? "Verifying…" : "Verify email"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep("details")
            setCode("")
            setError(null)
          }}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Use a different email
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleDetails} className="flex flex-col gap-5">
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
            autoComplete="new-password"
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

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Clerk's bot protection mounts here (enabled by default). */}
      <div id="clerk-captcha" />

      <Button
        type="submit"
        disabled={submitting}
        className="h-11 rounded-lg bg-foreground text-background hover:bg-foreground/90"
      >
        {submitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  )
}
