import { CopyIcon, DownloadIcon, TriangleAlertIcon } from "lucide-react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

/**
 * Freshly generated recovery codes. The API returns them once: after "Done" (or leaving the page) they can't be
 * shown again, only replaced.
 */
export function RecoveryCodes({ codes, email, onDone }: { codes: string[]; email: string; onDone: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const text = [
    `Illiria recovery codes for ${email}`,
    `Generated ${new Date().toISOString().slice(0, 10)}. Each code signs you in once.`,
    "",
    ...codes,
    "",
  ].join("\n")

  // The dialog that produced the codes has closed: move focus here so screen reader users hear them next.
  useEffect(() => headingRef.current?.focus(), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"))
      toast.success("Recovery codes copied.")
    } catch {
      toast.error("Couldn't copy. Select the codes and copy them, or download them.")
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "illiria-recovery-codes.txt"
    link.click()
    // Revoking right away can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section aria-labelledby="recovery-codes-heading" className="space-y-3 rounded-lg border p-4">
      <h3 id="recovery-codes-heading" ref={headingRef} tabIndex={-1} className="font-medium outline-none">
        Your recovery codes
      </h3>
      <Alert>
        <TriangleAlertIcon className="text-amber-600 dark:text-amber-400" />
        <AlertTitle>Store them now: you won't see them again.</AlertTitle>
        <AlertDescription>
          If you lose your authenticator app, each code signs you in once. Keep them somewhere safe, like a password
          manager.
        </AlertDescription>
      </Alert>
      <ul aria-label="Recovery codes" className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg bg-muted p-3 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={copy}>
          <CopyIcon data-icon="inline-start" />
          Copy
        </Button>
        <Button variant="outline" onClick={download}>
          <DownloadIcon data-icon="inline-start" />
          Download .txt
        </Button>
        <Button className="sm:ml-auto" onClick={onDone}>
          I've saved them
        </Button>
      </div>
    </section>
  )
}
