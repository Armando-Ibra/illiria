import type { components } from "@/api/schema"

type Schemas = components["schemas"]

export type Me = Schemas["MeResponse"]
export type MyOrganization = Schemas["MyOrganizationDto"]
export type Organization = Schemas["OrganizationDto"]
export type OrganizationRole = Schemas["OrganizationRole"]
export type Member = Schemas["MemberDto"]
export type Invitation = Schemas["InvitationDto"]
export type Project = Schemas["ProjectDto"]
export type SaveProjectRequest = Schemas["SaveProjectRequest"]
