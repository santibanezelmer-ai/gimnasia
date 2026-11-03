import React, { useState } from 'react'
import { useOrganization } from '@/features/organizations/OrganizationContext'
import { Building2, Plus, ChevronDown, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const TenantSwitcher: React.FC = () => {
  const { activeOrganization, activeRole, organizations, setActiveOrganizationId, createOrganization } = useOrganization()
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgSlug, setNewOrgSlug] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    const result = await createOrganization(newOrgName, newOrgSlug)
    if (result.error) {
      setErrorMsg(result.error)
    } else {
      setIsCreating(false)
      setNewOrgName('')
      setNewOrgSlug('')
      setIsOpen(false)
    }
  }

  const roleLabels: Record<string, string> = {
    org_admin: 'Administrador Org',
    competition_manager: 'Director de Competición',
    head_judge: 'Juez Árbitro',
    judge: 'Juez',
    club_manager: 'Delegado Club',
    coach: 'Entrenador',
    viewer: 'Observador',
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 transition-colors"
      >
        <Building2 className="h-4 w-4 text-blue-600" />
        <span className="max-w-[150px] truncate">
          {activeOrganization ? activeOrganization.name : 'Sin Organización'}
        </span>
        {activeRole && (
          <Badge variant="default" className="text-[10px] py-0 px-1.5">
            {roleLabels[activeRole] || activeRole}
          </Badge>
        )}
        <ChevronDown className="h-3 w-3 text-slate-500" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tus Organizaciones</p>
          </div>

          <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
            {organizations.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">No perteneces a ninguna organización aún.</p>
            ) : (
              organizations.map(({ organization, membership }) => (
                <button
                  key={organization.id}
                  type="button"
                  onClick={() => {
                    setActiveOrganizationId(organization.id)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
                    activeOrganization?.id === organization.id
                      ? 'bg-blue-50 font-semibold text-blue-900'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-left">
                    <p className="truncate">{organization.name}</p>
                    <p className="text-[10px] text-slate-400 font-normal">{roleLabels[membership.role] || membership.role}</p>
                  </div>
                  {activeOrganization?.id === organization.id && (
                    <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 pt-1 mt-1">
            {!isCreating ? (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Crear Nueva Organización</span>
              </button>
            ) : (
              <form onSubmit={handleCreate} className="p-2 space-y-2 bg-slate-50 rounded-lg">
                <p className="text-xs font-semibold text-slate-800">Nueva Organización</p>
                {errorMsg && <p className="text-[10px] text-rose-600">{errorMsg}</p>}
                <input
                  type="text"
                  required
                  placeholder="Nombre de Org o Federación"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value)
                    setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
                  }}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  required
                  placeholder="slug-unico"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                />
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200 rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-2 py-1 text-[11px] bg-blue-700 text-white rounded hover:bg-blue-800 font-medium"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
