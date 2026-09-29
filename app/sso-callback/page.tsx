import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"

export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
      Completing sign-in…
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/editor"
        signUpFallbackRedirectUrl="/editor"
      />
    </div>
  )
}
