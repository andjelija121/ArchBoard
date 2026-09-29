const DEFAULT_REDIRECT = "/editor"

/**
 * Validates a `redirect_url` query value before using it as a post-auth
 * destination, preventing open redirects. Clerk's own `auth.protect()`
 * produces a full absolute URL (e.g. `http://host/editor`), not a bare path,
 * so any parseable absolute URL is reduced to just its path — the host is
 * discarded rather than trusted, so the result is always a same-origin
 * relative path regardless of what host the input named. Protocol-relative
 * values (`//host/...`) and anything unparseable fall back to the default.
 * No `window` access, so this stays safe to call during SSR.
 */
export function getSafeRedirectUrl(value: string | null | undefined): string {
  if (!value) return DEFAULT_REDIRECT

  if (value.includes("://")) {
    try {
      const url = new URL(value)
      return `${url.pathname}${url.search}${url.hash}` || DEFAULT_REDIRECT
    } catch {
      return DEFAULT_REDIRECT
    }
  }

  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_REDIRECT
  return value
}
