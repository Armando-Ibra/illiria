import type { components } from "@/api/schema"

export type ProblemDetails = components["schemas"]["HttpValidationProblemDetails"]

/** A non-2xx API response. `problem` is the RFC 9457 body (with `errors` for validation failures). */
export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetails

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail ?? problem.title ?? `Request failed with status ${status}`)
    this.name = "ApiError"
    this.status = status
    this.problem = problem
  }

  /** Validation errors keyed by field (FluentValidation) or by Identity error code. */
  get errors(): Record<string, string[]> {
    return this.problem.errors ?? {}
  }
}

export function toProblem(body: unknown): ProblemDetails {
  return body !== null && typeof body === "object" ? (body as ProblemDetails) : {}
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status)
}

/** A short, human message for any error thrown by a request. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 403:
        return error.problem.title && error.problem.title !== "Forbidden"
          ? error.problem.title
          : "You don't have permission to do that."
      case 404:
        return error.problem.title && error.problem.title !== "Not Found" ? error.problem.title : "Not found."
      case 429:
        return "Too many attempts. Wait a minute and try again."
      default:
        if (error.status >= 500) return "Something went wrong on our side. Try again in a moment."
        return firstValidationMessage(error) ?? error.problem.title ?? error.message
    }
  }
  if (error instanceof TypeError) {
    return "Can't reach the server. Check your connection."
  }
  return "Something went wrong."
}

function firstValidationMessage(error: ApiError): string | undefined {
  return Object.values(error.errors).flat()[0]
}
