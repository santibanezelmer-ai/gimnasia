import React from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { useOrganization } from '@/features/organizations/OrganizationContext'
import type { OrganizationRole } from '@/core/types/auth'
import { ShieldAlert } from 'lucide-react'

export interface RequireRoleProps {
  roles: OrganizationRole[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Enforces in-memory organization role guards in addition to Postgres RLS.
 */
export const RequireRole: React.FC<RequireRoleProps> = ({ roles, children, fallback }) => {
  const { profile } = useAuth()
  const { activeRole } = useOrganization()

  // Platform admin bypasses org role restrictions for platform ops
  if (profile?.platformRole === 'platform_admin') {
    return <>{children}</>
  }

  if (!activeRole || !roles.includes(activeRole)) {
    if (fallback) return <>{fallback}</>

    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 text-xs">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold">Acceso Restringido</p>
          <p className="mt-0.5 text-amber-700">
            Tu rol actual ({activeRole || 'ninguno'}) no tiene permisos para esta acción. Requiere:{' '}
            {roles.join(', ')}.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
