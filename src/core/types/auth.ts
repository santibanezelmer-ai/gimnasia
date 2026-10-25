/**
 * Multi-tenant Role-Based Access Control (RBAC) definition.
 * 
 * Rules:
 * 1. Platform roles (e.g. platform_admin) can NEVER be assigned from tenant-level UI.
 * 2. Organization roles are scoped strictly to an organization_id.
 * 3. A user can belong to multiple organizations with different roles in each.
 */

export type PlatformRole = 'platform_admin' | 'platform_support' | 'none'

export type OrganizationRole = 
  | 'org_admin'              // Can manage organization settings, championships, members, and billing
  | 'competition_manager'    // Can manage championship setup, schedules, rotations, categories
  | 'head_judge'             // Can review/approve scores, handle appeals, view audit logs
  | 'judge'                  // Can ONLY score assigned apparatuses/rotations
  | 'club_manager'           // Can manage club profile, enroll gymnasts/coaches into championships
  | 'coach'                  // Can view assigned gymnasts' scores, schedules, and entries
  | 'viewer'                 // Read-only member within the organization

export interface UserProfile {
  id: string
  email: string
  fullName: string
  avatarUrl?: string
  platformRole: PlatformRole
  createdAt: string
  updatedAt: string
}

export interface Organization {
  id: string
  slug: string
  name: string
  logoUrl?: string
  billingPlan: 'free' | 'starter' | 'pro' | 'enterprise'
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled'
  createdAt: string
  updatedAt: string
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: OrganizationRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ActiveTenantContext {
  organization: Organization | null
  membership: OrganizationMember | null
  role: OrganizationRole | null
  isPlatformAdmin: boolean
}
