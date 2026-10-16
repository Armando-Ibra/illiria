# 0005 — Web app: React + Vite, shadcn/ui on Base UI, generated API client

Status: accepted · 2026-10-15

## Decision
- One SPA in `web/`: React 19, Vite, TypeScript strict, Tailwind CSS v4.
- **pnpm 12** as package manager, version pinned with `packageManager` in `package.json` (Corepack). Strict
  `node_modules` (no phantom dependencies) and supply-chain settings in `pnpm-workspace.yaml`: dependency install
  scripts only when approved (`allowBuilds`, `strictDepBuilds`), and new versions only after a day
  (`minimumReleaseAge`). pnpm 12 fails on unknown settings in that file, so a typo can't silently drop a policy.
  `trustPolicy: no-downgrade` was evaluated and left off: it rejects long-standing packages (old `semver` and
  `undici-types` majors published before provenance existed), which would make frozen installs fail on false positives.
- **shadcn/ui on Base UI** (`@base-ui/react`, style `base-nova`): components live in our code; Base UI is actively
  maintained by the MUI team. `components.json` lets `npx shadcn@latest add <name>` work on developer machines.
- TanStack Query for server state, React Router for routing, react-hook-form + zod for forms.
- **Contract-first client**: the API's OpenAPI document (`src/Illiria.Api/openapi/illiria.json`) generates
  `web/src/api/schema.d.ts` (openapi-typescript); calls go through `openapi-fetch`. CI fails if either drifts.
- Features mirror the API: `web/src/features/<feature>/`.
- Svelte stays possible later: the generated contract works the same from any frontend.

## Consequences
The typed client catches API changes at compile time. The shadcn registry wasn't reachable from the build
sandbox when v0.1 was written, so the first components were hand-written in shadcn style; replace them with
`npx shadcn@latest add <name> --overwrite` when convenient.
