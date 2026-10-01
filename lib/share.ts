/** Cookie that carries a guest's share token to the Liveblocks auth endpoint. */
export const SHARE_TOKEN_COOKIE = "archboard_share_token"

export type ShareRoleValue = "VIEW" | "EDIT"

/** A link as the dialog sees it (dates serialized for the client). */
export interface ShareLinkItem {
  id: string
  token: string
  role: ShareRoleValue
  createdAt: string
}

const TOKEN_BYTES = 24

/**
 * 24 random bytes as 32 url-safe characters (~192 bits). Uses Web Crypto
 * rather than `node:crypto` so this module stays importable from client code.
 */
export function createShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** Path only; callers prefix `window.location.origin` when copying. */
export function shareUrl(token: string): string {
  return `/share/${token}`
}
