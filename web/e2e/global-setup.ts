import { assertMailpitReachable } from "./helpers/mailpit"
import { tenancyMode } from "./helpers/mode"

/**
 * Fails fast, with a hint, when the e2e prerequisites are missing: Mailpit, and an API running in the tenancy
 * mode the run expects (E2E_TENANCY_MODE, default Multi).
 */
export default async function globalSetup() {
  await assertMailpitReachable()

  const apiUrl = (process.env.E2E_BASE_URL ?? process.env.ILLIRIA_API_URL ?? "http://localhost:5080").replace(/\/$/, "")
  let config: { tenancyMode: string; registrationEnabled: boolean }
  try {
    const response = await fetch(`${apiUrl}/api/config`)
    if (!response.ok) throw new Error(`answered ${response.status}`)
    config = (await response.json()) as typeof config
  } catch (error) {
    throw new Error(`The API isn't reachable at ${apiUrl} (start it first, see README.md).`, { cause: error })
  }
  if (config.tenancyMode !== tenancyMode) {
    throw new Error(`The API runs in ${config.tenancyMode} mode but E2E_TENANCY_MODE is ${tenancyMode}.`)
  }
  if (!config.registrationEnabled) {
    throw new Error("The e2e tests register accounts: start the API with registration enabled.")
  }
}
