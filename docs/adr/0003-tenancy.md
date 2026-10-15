# 0003 — Tenancy: organizations, route-scoped, fail-closed

Status: accepted · 2026-10-15

## Context
Some products are B2B (customers are companies with members), some B2C. In FullStackHero the tenant could be
moved by a request header for any user of the root tenant, and a few handlers dropped all query filters,
which removes tenant isolation too. We want one code path for both product types and isolation that is hard to break.

## Decision
- The tenant is an **Organization**. Users belong to organizations through **Membership** (role Owner/Admin/Member).
- `Tenancy:Mode`:
  - `Multi`: users create organizations and invite members by email (token stored hashed, 7 days, must match
    the invitee's confirmed email, role ≤ inviter's role).
  - `Single`: one implicit organization; every new user joins it, the first as Owner. Same code, same tables.
- **The organization comes only from the route**: `/api/orgs/{orgId}/...` (`MapOrganizationScope()`).
  On every request the caller's membership is read from the database; non-members get **404** (no id probing),
  insufficient role **403** (`RequireOrganizationRole(...)`). No header, claim or cookie can change the organization.
- Org-owned entities implement `IOrganizationScoped`. `AppDbContext`:
  - adds a **named** query filter (`QueryFilters.Organization`); with no organization in scope queries return nothing;
  - on save, stamps new rows with the current organization and throws on writes to another organization's rows.
- Entities that are deliberately not scoped carry `[GlobalEntity("reason")]`.
- Tests: every entity is scoped or global; every scoped entity has the filter; the source never calls a bare
  `IgnoreQueryFilters()` (drop other filters by name only); integration tests prove cross-organization reads,
  updates and deletes by id return 404.

## Consequences
- Background jobs must set `CurrentOrganization` explicitly before touching org data (deliberate).
- Database-per-tenant is out of scope; a shared database with a filter is enough for our scale.
