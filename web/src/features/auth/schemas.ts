import { z } from "zod"

export const emailSchema = z.string().trim().pipe(z.email("Enter a valid email address."))

/** Client-side hint only: the API's Identity password policy is the authority and its errors land on the field. */
export const newPasswordSchema = z.string().min(10, "Use at least 10 characters.")

export const passwordHint = "At least 10 characters, with upper- and lowercase letters, a digit and a symbol."

/** Maps ASP.NET Core Identity error codes to form fields. */
export function identityErrorField<F extends string>(passwordField: F) {
  return (code: string): "email" | F | null | undefined => {
    if (code.startsWith("Password")) return passwordField
    if (code === "DuplicateEmail" || code === "InvalidEmail") return "email"
    // Usernames are emails here: these repeat DuplicateEmail / InvalidEmail.
    if (code === "DuplicateUserName" || code === "InvalidUserName") return null
    return undefined
  }
}
