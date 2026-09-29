import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import { AuthLayout } from "@/components/auth/auth-layout"
import { SignUpForm } from "@/components/auth/sign-up-form"
import { getSafeRedirectUrl } from "@/components/auth/redirect-url"

export default async function SignUpPage({
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
        title="Create your account"
        subtitle="Enter your details to get started."
        altPrompt="Already have an account?"
        altLabel="Login"
        altHref="/sign-in"
      >
        <SignUpForm />
      </AuthLayout>
    </Suspense>
  )
}
