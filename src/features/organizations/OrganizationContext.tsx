import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/features/auth/AuthContext'
import type { Organization, OrganizationMember, OrganizationRole } from '@/core/types/auth'

export interface UserOrganizationMembership {
  organization: Organization
  membership: OrganizationMember
}

export interface OrganizationContextType {
  activeOrganization: Organization | null
  activeMembership: OrganizationMember | null
  activeRole: OrganizationRole | null
  organizations: UserOrganizationMembership[]
  isLoading: boolean
  setActiveOrganizationId: (orgId: string) => void
  createOrganization: (name: string, slug: string) => Promise<{ organization?: Organization; error?: string }>
  refreshOrganizations: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

const ACTIVE_ORG_STORAGE_KEY = 'operix_active_org_id'

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [organizations, setOrganizations] = useState<UserOrganizationMembership[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const fetchOrganizations = useCallback(async () => {
    if (!user) {
      setOrganizations([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      // Query memberships join organizations for the current user
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          organization_id,
          user_id,
          role,
          is_active,
          created_at,
          updated_at,
          organizations (
            id,
            slug,
            name,
            logo_url,
            billing_plan,
            subscription_status,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (error) {
        console.error('Failed to load user organizations:', error.message)
        setOrganizations([])
        return
      }

      const list: UserOrganizationMembership[] = (data || [])
        .filter((row) => row.organizations !== null)
        .map((row) => {
          const orgRaw = row.organizations as unknown as Record<string, unknown>
          const organization: Organization = {
            id: orgRaw.id as string,
            slug: orgRaw.slug as string,
            name: orgRaw.name as string,
            logoUrl: (orgRaw.logo_url as string) ?? undefined,
            billingPlan: orgRaw.billing_plan as Organization['billingPlan'],
            subscriptionStatus: orgRaw.subscription_status as Organization['subscriptionStatus'],
            createdAt: orgRaw.created_at as string,
            updatedAt: orgRaw.updated_at as string,
          }

          const membership: OrganizationMember = {
            id: row.id,
            organizationId: row.organization_id,
            userId: row.user_id,
            role: row.role as OrganizationRole,
            isActive: row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }

          return { organization, membership }
        })

      setOrganizations(list)

      // Retain or select default active organization
      if (list.length > 0) {
        const found = list.find((m) => m.organization.id === activeOrgId)
        if (!found) {
          const defaultId = list[0].organization.id
          setActiveOrgId(defaultId)
          localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, defaultId)
        }
      } else {
        setActiveOrgId(null)
        localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY)
      }
    } finally {
      setIsLoading(false)
    }
  }, [user, activeOrgId])

  useEffect(() => {
    fetchOrganizations()
  }, [user])

  const setActiveOrganizationId = (orgId: string) => {
    setActiveOrgId(orgId)
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId)
  }

  const createOrganization = async (name: string, slug: string) => {
    if (!user) return { error: 'No user authenticated' }

    try {
      // 1. Insert organization
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name,
          slug,
          billing_plan: 'free',
          subscription_status: 'active',
        })
        .select('*')
        .single()

      if (orgError) {
        return { error: orgError.message }
      }

      // 2. Add creator as org_admin
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: newOrg.id,
          user_id: user.id,
          role: 'org_admin',
          is_active: true,
        })

      if (memberError) {
        return { error: memberError.message }
      }

      const created: Organization = {
        id: newOrg.id,
        slug: newOrg.slug,
        name: newOrg.name,
        logoUrl: newOrg.logo_url ?? undefined,
        billingPlan: newOrg.billing_plan as Organization['billingPlan'],
        subscriptionStatus: newOrg.subscription_status as Organization['subscriptionStatus'],
        createdAt: newOrg.created_at,
        updatedAt: newOrg.updated_at,
      }

      await fetchOrganizations()
      setActiveOrganizationId(created.id)

      return { organization: created }
    } catch (err: unknown) {
      return { error: (err as Error).message }
    }
  }

  const activeEntry = useMemo(() => {
    return organizations.find((item) => item.organization.id === activeOrgId) ?? null
  }, [organizations, activeOrgId])

  const value = useMemo<OrganizationContextType>(
    () => ({
      activeOrganization: activeEntry?.organization ?? null,
      activeMembership: activeEntry?.membership ?? null,
      activeRole: activeEntry?.membership.role ?? null,
      organizations,
      isLoading,
      setActiveOrganizationId,
      createOrganization,
      refreshOrganizations: fetchOrganizations,
    }),
    [activeEntry, organizations, isLoading, fetchOrganizations]
  )

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}

export function useOrganization(): OrganizationContextType {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}
