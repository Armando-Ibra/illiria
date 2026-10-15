import { MailOpenIcon } from "lucide-react"
import { useLocation, useNavigate, useSearchParams } from "react-router"
import { toast } from "sonner"

import { errorMessage, isApiError } from "@/api/errors"
import { CenteredLayout } from "@/components/centered-layout"
import { Spinner } from "@/components/states"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useLogout, useMe } from "@/features/auth/api"
import { useAcceptInvitation } from "@/features/organizations/api"

/** Landing page of the invitation email: /invitations/accept?token=… (signed-in users only; see the router). */
export function AcceptInvitationPage() {
  const me = useMe()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")
  const accept = useAcceptInvitation()
  const logout = useLogout()

  const onAccept = () => {
    if (!token) return
    accept.mutate(token, {
      onSuccess: (organization) => {
        toast.success(`Welcome to ${organization.name}.`)
        navigate(`/orgs/${organization.id}/projects`, { replace: true })
      },
    })
  }

  const wrongAccount = isApiError(accept.error, 403)

  return (
    <CenteredLayout>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Join an organization</h1>
          </CardTitle>
          <CardDescription>You've been invited to join an organization on Illiria.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <Alert variant="destructive">
              <AlertTitle>This invitation link is incomplete.</AlertTitle>
              <AlertDescription>Open the link from the invitation email again.</AlertDescription>
            </Alert>
          ) : accept.isError ? (
            <Alert variant="destructive">
              <AlertTitle>
                {isApiError(accept.error, 404)
                  ? "This invitation is invalid, expired, or was already used."
                  : errorMessage(accept.error)}
              </AlertTitle>
              {wrongAccount && (
                <AlertDescription>
                  {me.emailConfirmed
                    ? `You're signed in as ${me.email}. Sign in with the invited address instead.`
                    : "Confirm your email address first, then open this link again."}
                </AlertDescription>
              )}
            </Alert>
          ) : (
            <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3 text-muted-foreground">
              <MailOpenIcon aria-hidden className="size-5 shrink-0" />
              <p>
                You'll join as <span className="font-medium text-foreground">{me.email}</span>.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {token && !accept.isError && (
              <Button onClick={onAccept} disabled={accept.isPending}>
                {accept.isPending && <Spinner />}
                Accept invitation
              </Button>
            )}
            {wrongAccount && me.emailConfirmed && (
              <Button
                variant="outline"
                onClick={() => logout.mutate(location.pathname + location.search)}
                disabled={logout.isPending}
              >
                Sign in with another account
              </Button>
            )}
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <Button variant="link" size="sm" onClick={() => navigate("/")}>
            Not now
          </Button>
        </CardFooter>
      </Card>
    </CenteredLayout>
  )
}
