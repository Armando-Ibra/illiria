import { isRouteErrorResponse, Link, useRouteError } from "react-router"

import { errorMessage } from "@/api/errors"
import { CenteredLayout } from "@/components/centered-layout"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** Router error boundary: unknown URLs, organizations the user can't see, and unexpected failures. */
export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <CenteredLayout>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{notFound ? "Page not found" : "Something went wrong"}</h1>
          </CardTitle>
          <CardDescription>
            {notFound ? "This page doesn't exist, or you don't have access to it." : errorMessage(error)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Link className={buttonVariants()} to="/">
            Go home
          </Link>
          {!notFound && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          )}
        </CardContent>
      </Card>
    </CenteredLayout>
  )
}
