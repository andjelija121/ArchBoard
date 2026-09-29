import { AuthLayout } from "@/components/auth/auth-layout"
import { SignInForm } from "@/components/auth/sign-in-form"

export default function SignInPage() {
  return (
    <AuthLayout
      title="Login to your account"
      subtitle="Enter your details to login."
      altPrompt="Don't have an account?"
      altLabel="Register"
      altHref="/sign-up"
    >
      <SignInForm />
    </AuthLayout>
  )
}
