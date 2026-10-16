import { createBrowserRouter, data, redirect, type LoaderFunctionArgs } from "react-router"

import { AccountLayout } from "@/app/account-layout"
import { AppLayout } from "@/app/app-layout"
import { RouteError } from "@/app/route-error"
import { LoadingState } from "@/components/states"
import { AccountPage } from "@/features/account/pages/account-page"
import { CheckEmailPage } from "@/features/auth/pages/check-email-page"
import { ConfirmEmailPage } from "@/features/auth/pages/confirm-email-page"
import { ForgotPasswordPage } from "@/features/auth/pages/forgot-password-page"
import { LoginPage } from "@/features/auth/pages/login-page"
import { RegisterPage } from "@/features/auth/pages/register-page"
import { ResetPasswordPage } from "@/features/auth/pages/reset-password-page"
import { requireMe } from "@/features/auth/session"
import { homeLoader, noAccessLoader, onboardingLoader, organizationLoader } from "@/features/organizations/loaders"
import { AcceptInvitationPage } from "@/features/organizations/pages/accept-invitation-page"
import { MembersPage } from "@/features/organizations/pages/members-page"
import { NoAccessPage } from "@/features/organizations/pages/no-access-page"
import { OnboardingPage } from "@/features/organizations/pages/onboarding-page"
import { ORGANIZATION_ROUTE_ID } from "@/features/organizations/use-current-organization"
import { ProjectsPage } from "@/features/projects/pages/projects-page"
import { queryClient, setSessionExpiredHandler } from "@/lib/query-client"
import { loginPath } from "@/lib/return-to"

/** Signed-in only: loads /api/me before rendering, or redirects to /login?returnTo=… */
const signedIn = ({ request }: LoaderFunctionArgs) => requireMe(request).then(() => null)

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    // Shown while the first page's loaders run (e.g. /api/me on a hard refresh).
    hydrateFallbackElement: <LoadingState className="min-h-svh" />,
    children: [
      // Public: sign-in flows and the pages emails link to.
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/check-email", element: <CheckEmailPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
      { path: "/confirm-email", element: <ConfirmEmailPage /> },

      // Signed in, outside any organization.
      { path: "/", loader: homeLoader },
      { path: "/invitations/accept", loader: signedIn, element: <AcceptInvitationPage /> },
      { path: "/onboarding", loader: onboardingLoader, element: <OnboardingPage /> },
      { path: "/no-access", loader: noAccessLoader, element: <NoAccessPage /> },
      { path: "/account", loader: signedIn, element: <AccountLayout />, children: [{ index: true, element: <AccountPage /> }] },

      // Signed in, inside an organization the user is a member of.
      {
        id: ORGANIZATION_ROUTE_ID,
        path: "/orgs/:orgId",
        loader: organizationLoader,
        element: <AppLayout />,
        children: [
          { index: true, loader: ({ params }) => redirect(`/orgs/${params.orgId}/projects`) },
          { path: "projects", element: <ProjectsPage /> },
          { path: "members", element: <MembersPage /> },
        ],
      },

      {
        path: "*",
        loader: () => {
          throw data("Not found", { status: 404 })
        },
      },
    ],
  },
])

// A signed-in user's session ended (expired, signed out elsewhere): start over at /login, then come back.
setSessionExpiredHandler(() => {
  const { pathname, search } = router.state.location
  void router.navigate(loginPath(pathname + search), { replace: true }).then(() => queryClient.clear())
})
