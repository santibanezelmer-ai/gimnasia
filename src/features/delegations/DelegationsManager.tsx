import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useOrganization } from '@/features/organizations/OrganizationContext'
import type { Club, Gymnast } from '@/core/types/delegation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Plus, Users, UserCheck, AlertCircle } from 'lucide-react'

export const DelegationsManager: React.FC = () => {
  const { activeOrganization, activeRole } = useOrganization()
  const [clubs, setClubs] = useState<Club[]>([])
  const [gymnasts, setGymnasts] = useState<Gymnast[]>([])
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingClub, setIsCreatingClub] = useState(false)
  const [isCreatingGymnast, setIsCreatingGymnast] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Club form fields
  const [clubName, setClubName] = useState('')
  const [clubCode, setClubCode] = useState('')
  const [clubCity, setClubCity] = useState('')

  // Gymnast form fields
  const [gymnastFirstName, setGymnastFirstName] = useState('')
  const [gymnastLastName, setGymnastLastName] = useState('')
  const [gymnastBirthDate, setGymnastBirthDate] = useState('')
  const [gymnastGender, setGymnastGender] = useState<'female' | 'male'>('female')
  const [gymnastLicense, setGymnastLicense] = useState('')

  const canManageClubs = activeRole === 'org_admin' || activeRole === 'competition_manager'

  const loadData = useCallback(async () => {
    if (!activeOrganization) {
      setClubs([])
      setGymnasts([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMsg(null)

      // 1. Fetch Clubs
      const { data: clubsData, error: clubsError } = await supabase
        .from('clubs')
        .select('*')
        .eq('organization_id', activeOrganization.id)
        .order('name', { ascending: true })

      if (clubsError) throw clubsError

      const mappedClubs: Club[] = (clubsData || []).map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        shortName: row.short_name ?? undefined,
        code: row.code,
        logoUrl: row.logo_url ?? undefined,
        city: row.city ?? undefined,
        stateOrRegion: row.state_or_region ?? undefined,
        country: row.country,
        contactEmail: row.contact_email ?? undefined,
        contactPhone: row.contact_phone ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      setClubs(mappedClubs)

      if (mappedClubs.length > 0 && !selectedClubId) {
        setSelectedClubId(mappedClubs[0].id)
      }

      // 2. Fetch Gymnasts
      const { data: gymnastsData, error: gymnastsError } = await supabase
        .from('gymnasts')
        .select('*')
        .eq('organization_id', activeOrganization.id)
        .order('last_name', { ascending: true })

      if (gymnastsError) throw gymnastsError

      const mappedGymnasts: Gymnast[] = (gymnastsData || []).map((row) => ({
        id: row.id,
        clubId: row.club_id,
        organizationId: row.organization_id,
        firstName: row.first_name,
        lastName: row.last_name,
        rutOrId: row.rut_or_id ?? undefined,
        licenseNumber: row.license_number ?? undefined,
        birthDate: row.birth_date,
        gender: row.gender,
        medicalClearanceDate: row.medical_clearance_date ?? undefined,
        notes: row.notes ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      setGymnasts(mappedGymnasts)
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [activeOrganization, selectedClubId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrganization) return

    try {
      setErrorMsg(null)
      const { error } = await supabase.from('clubs').insert({
        organization_id: activeOrganization.id,
        name: clubName,
        code: clubCode.toUpperCase(),
        city: clubCity || null,
        country: 'Chile',
      })

      if (error) throw error

      setIsCreatingClub(false)
      setClubName('')
      setClubCode('')
      setClubCity('')
      await loadData()
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    }
  }

  const handleCreateGymnast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrganization || !selectedClubId) return

    try {
      setErrorMsg(null)
      const { error } = await supabase.from('gymnasts').insert({
        organization_id: activeOrganization.id,
        club_id: selectedClubId,
        first_name: gymnastFirstName,
        last_name: gymnastLastName,
        birth_date: gymnastBirthDate,
        gender: gymnastGender,
        license_number: gymnastLicense || null,
      })

      if (error) throw error

      setIsCreatingGymnast(false)
      setGymnastFirstName('')
      setGymnastLastName('')
      setGymnastBirthDate('')
      setGymnastLicense('')
      await loadData()
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    }
  }

  const activeClubGymnasts = selectedClubId
    ? gymnasts.filter((g) => g.clubId === selectedClubId)
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-700" />
            Clubes & Padrón de Deportistas
          </h3>
          <p className="text-xs text-slate-500">
            Registro y gestión de delegaciones, gimnastas y licencias con aislamiento estricto de datos.
          </p>
        </div>

        {canManageClubs && !isCreatingClub && (
          <button
            type="button"
            onClick={() => setIsCreatingClub(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Club / Delegación
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isCreatingClub && (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <h4 className="text-sm font-bold text-slate-900 mb-3">Registrar Nuevo Club</h4>
          <form onSubmit={handleCreateClub} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nombre Oficial</label>
              <input
                type="text"
                required
                placeholder="Ej. Club Deportivo Manquehue"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Código / Sigla</label>
              <input
                type="text"
                required
                placeholder="Ej. CDM"
                maxLength={6}
                value={clubCode}
                onChange={(e) => setClubCode(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono uppercase focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ciudad</label>
              <input
                type="text"
                placeholder="Ej. Santiago"
                value={clubCity}
                onChange={(e) => setClubCity(e.target.value)}
                className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-3 flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreatingClub(false)}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded bg-indigo-700 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-800"
              >
                Guardar Club
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Main Grid: Clubs list on left, Gymnasts on right */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Clubes Inscritos</h4>
            <Badge variant="outline">{clubs.length}</Badge>
          </div>

          {isLoading ? (
            <p className="text-xs text-slate-400">Cargando clubes...</p>
          ) : clubs.length === 0 ? (
            <Card className="text-center py-6">
              <p className="text-xs text-slate-500">No hay clubes registrados.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {clubs.map((club) => {
                const count = gymnasts.filter((g) => g.clubId === club.id).length
                const isSelected = selectedClubId === club.id
                return (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => setSelectedClubId(club.id)}
                    className={`flex w-full items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-slate-900 text-xs">{club.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Sigla: {club.code} {club.city ? `• ${club.city}` : ''}
                      </p>
                    </div>
                    <Badge variant={isSelected ? 'default' : 'outline'} className="text-[10px]">
                      {count} gimnastas
                    </Badge>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Gimnastas del Club Seleccionado
            </h4>
            {selectedClubId && !isCreatingGymnast && (
              <button
                type="button"
                onClick={() => setIsCreatingGymnast(true)}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Inscribir Deportista
              </button>
            )}
          </div>

          {isCreatingGymnast && (
            <Card className="border-emerald-200 bg-emerald-50/30">
              <h5 className="text-xs font-bold text-slate-900 mb-3">Registrar Gimnasta en Club</h5>
              <form onSubmit={handleCreateGymnast} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Nombres</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Valentina"
                    value={gymnastFirstName}
                    onChange={(e) => setGymnastFirstName(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Apellidos</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Soto Moraga"
                    value={gymnastLastName}
                    onChange={(e) => setGymnastLastName(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Fecha de Nacimiento</label>
                  <input
                    type="date"
                    required
                    value={gymnastBirthDate}
                    onChange={(e) => setGymnastBirthDate(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Rama / Género</label>
                  <select
                    value={gymnastGender}
                    onChange={(e) => setGymnastGender(e.target.value as 'female' | 'male')}
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="female">Femenino (GAF / GR)</option>
                    <option value="male">Masculino (GAM)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">N° Licencia Federativa</label>
                  <input
                    type="text"
                    placeholder="Ej. FED-GAF-2026-089"
                    value={gymnastLicense}
                    onChange={(e) => setGymnastLicense(e.target.value)}
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingGymnast(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    Guardar Gimnasta
                  </button>
                </div>
              </form>
            </Card>
          )}

          {!selectedClubId ? (
            <Card className="text-center py-8">
              <Users className="mx-auto h-7 w-7 text-slate-300 mb-2" />
              <p className="text-xs text-slate-500">Selecciona un club para ver sus deportistas.</p>
            </Card>
          ) : activeClubGymnasts.length === 0 ? (
            <Card className="text-center py-8">
              <UserCheck className="mx-auto h-7 w-7 text-slate-300 mb-2" />
              <p className="text-xs text-slate-500">Este club no tiene gimnastas registradas aún.</p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Gimnasta</th>
                    <th className="px-4 py-2.5 font-semibold">Rama</th>
                    <th className="px-4 py-2.5 font-semibold">Fecha Nac.</th>
                    <th className="px-4 py-2.5 font-semibold">Licencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {activeClubGymnasts.map((gymnast) => (
                    <tr key={gymnast.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {gymnast.lastName}, {gymnast.firstName}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={gymnast.gender === 'female' ? 'default' : 'success'} className="text-[10px]">
                          {gymnast.gender === 'female' ? 'Femenino' : 'Masculino'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">{gymnast.birthDate}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px]">
                        {gymnast.licenseNumber || <span className="text-slate-400">Sin licencia</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
