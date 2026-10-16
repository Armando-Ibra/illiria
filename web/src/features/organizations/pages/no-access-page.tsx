import { LockKeyholeIcon } from "lucide-react"

import { CenteredLayout } from "@/components/centered-layout"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { SignedInAs } from "@/features/auth/components/signed-in-as"

/** Single-tenant mode, but the user isn't a member (e.g. they were removed). Nothing to do but ask. */
export function NoAccessPage() {
  return (
    <CenteredLayout>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>No access yet</h1>
          </CardTitle>
          <CardDescription>Your account isn't part of this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-start gap-3 text-muted-foreground">
          <LockKeyholeIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
          <p>Ask an administrator to invite you. The invitation link in their email will bring you right in.</p>
        </CardContent>
        <CardFooter className="justify-center">
          <SignedInAs />
        </CardFooter>
      </Card>
    </CenteredLayout>
  )
}
