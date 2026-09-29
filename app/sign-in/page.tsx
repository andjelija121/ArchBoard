import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthLayout } from "@/components/auth/auth-layout"
import { SignInForm } from "@/components/auth/sign-in-form"
import { getSafeRedirectUrl } from "@/components/auth/redirect-url"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>
}) {
  const { isAuthenticated } = await auth()
  if (isAuthenticated) {
    const { redirect_url } = await searchParams
    redirect(getSafeRedirectUrl(redirect_url))
  }

  return (
    <Suspense>
      <AuthLayout
        title="Login to your account"
        subtitle="Enter your details to login."
        altPrompt="Don't have an account?"
        altLabel="Register"
        altHref="/sign-up"
      >
        <SignInForm />
      </AuthLayout>
    </Suspense>
  )
}
