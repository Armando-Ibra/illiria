import type * as React from "react"

import { CenteredLayout } from "@/components/centered-layout"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

/** The card every sign-in screen uses: a title, an optional description, content and footer links. */
export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string
  description?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <CenteredLayout>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{title}</h1>
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {children && <CardContent>{children}</CardContent>}
        {footer && <CardFooter className="justify-center text-center text-muted-foreground">{footer}</CardFooter>}
      </Card>
    </CenteredLayout>
  )
}
