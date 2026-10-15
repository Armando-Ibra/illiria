/**
 * UI preferences remembered in localStorage. Never store credentials or tokens here: auth is an HttpOnly cookie.
 * Storage can be unavailable (private mode, blocked site data), so every access is guarded.
 */
const LAST_ORGANIZATION_KEY = "illiria.lastOrganizationId"

export function getLastOrganizationId(): string | null {
  try {
    return window.localStorage.getItem(LAST_ORGANIZATION_KEY)
  } catch {
    return null
  }
}

export function setLastOrganizationId(organizationId: string) {
  try {
    window.localStorage.setItem(LAST_ORGANIZATION_KEY, organizationId)
  } catch {
    // Not remembering the last organization is fine.
  }
}
