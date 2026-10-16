/** The API's tenancy mode this run expects (E2E_TENANCY_MODE=Single|Multi, default Multi). */
export const tenancyMode = process.env.E2E_TENANCY_MODE === "Single" ? "Single" : "Multi"
