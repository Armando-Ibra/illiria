/**
 * Reads the emails the API sent, through Mailpit's HTTP API (https://mailpit.axllent.org/docs/api-v1/).
 * Mailpit is shared by every test (and every run): always look messages up by recipient, and use a unique
 * address per test.
 */
const MAILPIT_URL = (process.env.MAILPIT_URL ?? "http://localhost:8025").replace(/\/$/, "")

type MessageSummary = { ID: string; Subject: string; Created: string; To: { Address: string }[] }
type Message = { ID: string; Subject: string; HTML: string; Text: string }

export type Email = Message & {
  /** The first link whose path starts with `pathPrefix`, as a root-relative URL (path + query) for `page.goto`. */
  link: (pathPrefix: string) => string
}

async function mailpit<T>(path: string): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}${path}`)
  if (!response.ok) throw new Error(`Mailpit ${path} answered ${response.status}`)
  return (await response.json()) as T
}

/** Messages sent to `to`, newest first. */
export async function listEmails(to: string): Promise<MessageSummary[]> {
  const query = new URLSearchParams({ query: `to:"${to}"`, limit: "50" })
  const result = await mailpit<{ messages: MessageSummary[] }>(`/api/v1/search?${query}`)
  return result.messages
}

/**
 * Waits for the newest email to `to` whose subject starts with `subject` (and whose id isn't in `exclude`, to wait
 * for a second email with the same subject).
 */
export async function waitForEmail(
  to: string,
  subject: string,
  { exclude = [], timeout = 15_000 }: { exclude?: string[]; timeout?: number } = {},
): Promise<Email> {
  const deadline = Date.now() + timeout
  for (;;) {
    const match = (await listEmails(to)).find((message) => message.Subject.startsWith(subject) && !exclude.includes(message.ID))
    if (match) {
      const message = await mailpit<Message>(`/api/v1/message/${match.ID}`)
      return { ...message, link: (pathPrefix) => findLink(message, pathPrefix) }
    }
    if (Date.now() > deadline) throw new Error(`No email "${subject}…" to ${to} within ${timeout} ms`)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

function findLink(message: Message, pathPrefix: string): string {
  for (const [, href] of message.HTML.matchAll(/href="([^"]+)"/g)) {
    const url = new URL(decodeHtml(href!))
    // The API builds links from its App:PublicUrl; keep only path + query so they open on the app under test.
    if (url.pathname.startsWith(pathPrefix)) return url.pathname + url.search
  }
  throw new Error(`No ${pathPrefix} link in "${message.Subject}": ${message.HTML}`)
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
}

/** Fails fast with a clear message when Mailpit isn't running (see README: deploy/compose.dev.yml). */
export async function assertMailpitReachable(): Promise<void> {
  try {
    await mailpit("/api/v1/info")
  } catch (error) {
    throw new Error(`Mailpit isn't reachable at ${MAILPIT_URL} (set MAILPIT_URL).`, { cause: error })
  }
}
