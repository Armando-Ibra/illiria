/**
 * `returnTo` comes from the URL, so anyone can craft it: only same-origin, root-relative paths are honored.
 * Anything else (`https://evil.com`, `//evil.com`, `/\evil.com`, `javascript:`) falls back to null.
 */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null
  }
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null
  } catch {
    return null
  }
}

/** `/login`, carrying where to go back to once signed in. */
export function loginPath(returnTo?: string | null): string {
  const target = safeReturnTo(returnTo)
  return target && target !== "/" ? `/login?${new URLSearchParams({ returnTo: target })}` : "/login"
}
