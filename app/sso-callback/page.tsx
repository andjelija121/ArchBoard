import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"

export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
      Completing sign-in…
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/editor"
        signUpFallbackRedirectUrl="/editor"
      />
      {/* Clerk's bot protection mounts here for OAuth-triggered sign-ups */}
      <div id="clerk-captcha" data-cl-theme="dark" />
    </div>
  )
}
