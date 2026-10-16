import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router"
import { toast } from "sonner"
import { z } from "zod"

import { CenteredLayout } from "@/components/centered-layout"
import { FormError } from "@/components/form-error"
import { TextField } from "@/components/form-fields"
import { Spinner } from "@/components/states"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { useMe } from "@/features/auth/api"
import { SignedInAs } from "@/features/auth/components/signed-in-as"
import { useCreateOrganization } from "@/features/organizations/api"
import { applyApiError } from "@/lib/forms"

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(100, "Use at most 100 characters."),
})

/** Create an organization: the first one after sign-up, or another one from the organization switcher. */
export function OnboardingPage() {
  const me = useMe()
  const navigate = useNavigate()
  const create = useCreateOrganization()
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: "" } })
  const first = me.organizations.length === 0

  const onSubmit = form.handleSubmit(({ name }) =>
    create.mutate(name, {
      onSuccess: (organization) => {
        toast.success(`${organization.name} is ready.`)
        navigate(`/orgs/${organization.id}/projects`)
      },
      onError: (error) => applyApiError(form, error),
    }),
  )

  return (
    <CenteredLayout>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>{first ? "Create your organization" : "New organization"}</h1>
          </CardTitle>
          <CardDescription>
            {first
              ? "Organizations hold your projects and team. You can invite people once it's created."
              : "You'll be its owner. Switch between organizations from the top bar."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <FormError form={form} />
              <TextField control={form.control} name="name" label="Organization name" autoComplete="organization" autoFocus />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {!first && (
                  <Link className={buttonVariants({ variant: "outline" })} to="/">
                    Cancel
                  </Link>
                )}
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending && <Spinner />}
                  Create organization
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <SignedInAs />
        </CardFooter>
      </Card>
    </CenteredLayout>
  )
}
