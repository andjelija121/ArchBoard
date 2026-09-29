import { Suspense } from "react"

import { AuthLayout } from "@/components/auth/auth-layout"
import { SignUpForm } from "@/components/auth/sign-up-form"

export default function SignUpPage() {
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
