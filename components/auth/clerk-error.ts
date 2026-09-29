/** Pull a human-readable message out of a Clerk API error (either shape). */
export function getClerkErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (err && typeof err === "object") {
    const withList = err as {
      errors?: Array<{ message?: string; longMessage?: string }>
    }
    if (Array.isArray(withList.errors) && withList.errors.length > 0) {
      return withList.errors[0].longMessage || withList.errors[0].message || fallback
    }
    const single = err as { message?: string; longMessage?: string }
    if (single.longMessage || single.message) {
      return single.longMessage || single.message || fallback
    }
  }
  return fallback
}
