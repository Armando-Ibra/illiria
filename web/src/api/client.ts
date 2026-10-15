import createClient, { type Middleware } from "openapi-fetch"

import { ApiError, toProblem } from "@/api/errors"
import type { paths } from "@/api/schema"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

/**
 * The API rejects state-changing requests without `X-CSRF: 1` (403). Only same-origin script can add a
 * custom header without a CORS preflight, which the API never grants.
 */
const csrf: Middleware = {
  onRequest({ request }) {
    if (!SAFE_METHODS.has(request.method)) {
      request.headers.set("X-CSRF", "1")
    }
    return request
  },
}

/**
 * Typed client for the Illiria API, generated from its OpenAPI document (`pnpm run api:gen`).
 * Auth is an HttpOnly cookie on the same origin: no token ever touches JavaScript.
 */
export const api = createClient<paths>({ baseUrl: "/", credentials: "same-origin" })
api.use(csrf)

type ApiResult<T> = { data?: T; error?: unknown; response: Response }

/** Awaits an `api.*` call and returns its data, or throws an {@link ApiError} for any non-2xx response. */
export async function unwrap<T>(request: Promise<ApiResult<T>>): Promise<T> {
  const { data, error, response } = await request
  if (!response.ok) {
    throw new ApiError(response.status, toProblem(error))
  }
  return data as T
}
