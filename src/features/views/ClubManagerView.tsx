import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useOrganization } from '@/features/organizations/OrganizationContext'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trophy,
  UserPlus,
  ClipboardList,
  FileSpreadsheet,
} from 'lucide-react'

export interface ClubRegistrationRow {
  id: string
  championshipId: string
  championshipName: string
  gymnastId: string
  gymnastName: string
  rutOrId?: string
  licenseNumber?: string
  categoryName: string
  scoringRegime: 'free' | 'obligatory'
  rotationGroup?: string
  bibNumber?: number
  status: 'pending_approval' | 'approved' | 'rejected' | 'withdrawn'
  scoresByApparatus: Record<string, number>
  totalScore: number
}

export interface ClubGymnastRecord {
  id: string
  firstName: string
  lastName: string
  birthDate: string
  gender: 'female' | 'male'
  rutOrId?: string
  licenseNumber?: string
  createdAt: string
}

interface AvailableCategoryOption {
  id: string
  name: string
  championshipId: string
  scoringRegime: 'free' | 'obligatory'
}

interface AvailableChampionshipOption {
  id: string
  name: string
}

export interface ClubManagerViewProps {
  onCreateChampionship?: () => void
}

export const ClubManagerView: React.FC<ClubManagerViewProps> = ({ onCreateChampionship }) => {
  const { activeOrganization } = useOrganization()
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'registrations'>('roster')
  const [registrations, setRegistrations] = useState<ClubRegistrationRow[]>([])
  const [gymnastsRoster, setGymnastsRoster] = useState<ClubGymnastRecord[]>([])
  const [clubName, setClubName] = useState<string>('Mi Club')
  const [clubId, setClubId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Roster: Create single gymnast
  const [isCreatingGymnast, setIsCreatingGymnast] = useState(false)
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newBirthDate, setNewBirthDate] = useState('')
  const [newGender, setNewGender] = useState<'female' | 'male'>('female')
  const [newRut, setNewRut] = useState('')
  const [newLicense, setNewLicense] = useState('')
  const [isSavingGymnast, setIsSavingGymnast] = useState(false)

  // Roster: Bulk paste list
  const [isBulkAdding, setIsBulkAdding] = useState(false)
  const [bulkText, setBulkText] = useState('')

  // Enrollment: Inscribe to championship
  const [isRegistering, setIsRegistering] = useState(false)
  const [availableChamps, setAvailableChamps] = useState<AvailableChampionshipOption[]>([])
  const [availableCategories, setAvailableCategories] = useState<AvailableCategoryOption[]>([])
  const [formGymnastId, setFormGymnastId] = useState('')
  const [formChampId, setFormChampId] = useState('')
  const [formCatId, setFormCatId] = useState('')
  const [formBib, setFormBib] = useState('')
  const [formRotation, setFormRotation] = useState('')
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false)

  const loadClubData = useCallback(async () => {
    if (!activeOrganization) {
      setRegistrations([])
      setGymnastsRoster([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMsg(null)

      // 1. Resolve Club for current organization
      const { data: clubsData, error: clubErr } = await supabase
        .from('clubs')
        .select('id, name, code')
        .eq('organization_id', activeOrganization.id)
        .limit(1)

      if (clubErr) throw clubErr

      let activeClubId = clubId
      if (clubsData && clubsData.length > 0) {
        setClubName(clubsData[0].name)
        setClubId(clubsData[0].id)
        activeClubId = clubsData[0].id
      }

      // 2. Fetch full roster of gymnasts for this club
      if (activeClubId) {
        const { data: rosterData, error: rosterErr } = await supabase
          .from('gymnasts')
          .select('*')
          .eq('club_id', activeClubId)
          .order('last_name', { ascending: true })

        if (rosterErr) throw rosterErr

        if (rosterData) {
          const mappedRoster: ClubGymnastRecord[] = rosterData.map((g) => ({
            id: g.id,
            firstName: g.first_name,
            lastName: g.last_name,
            birthDate: g.birth_date,
            gender: g.gender as 'female' | 'male',
            rutOrId: g.rut_or_id ?? undefined,
            licenseNumber: g.license_number ?? undefined,
            createdAt: g.created_at,
          }))
          setGymnastsRoster(mappedRoster)

          if (mappedRoster.length > 0 && !formGymnastId) {
            setFormGymnastId(mappedRoster[0].id)
          }
        }
      }

      // 3. Fetch registrations for this club
      let query = supabase
        .from('registrations')
        .select(`
          id,
          championship_id,
          gymnast_id,
          category_id,
          club_id,
          bib_number,
          rotation_group,
          status,
          championships (
            id,
            name
          ),
          gymnasts (
            id,
            first_name,
            last_name,
            rut_or_id,
            license_number
          ),
          categories (
            name,
            scoring_regime
          ),
          scores (
            final_score,
            status,
            apparatuses (
              code
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (activeClubId) {
        query = query.eq('club_id', activeClubId)
      }

      const { data: regsData, error: regsErr } = await query
      if (regsErr) throw regsErr

      if (regsData) {
        const mapped: ClubRegistrationRow[] = (regsData as unknown as Record<string, unknown>[]).map((row) => {
          const gym = row.gymnasts as {
            id: string
            first_name: string
            last_name: string
            rut_or_id?: string
            license_number?: string
          } | null
          const champ = row.championships as { id: string; name: string } | null
          const cat = row.categories as { name: string; scoring_regime?: string } | null
          const scoresRaw = (row.scores as {
            final_score: number
            status: string
            apparatuses: { code: string } | null
          }[]) || []

          const scoresByApp: Record<string, number> = {}
          let sumTotal = 0

          for (const sc of scoresRaw) {
            if (sc.status === 'official_approved' || sc.status === 'provisional') {
              const code = sc.apparatuses?.code || 'APP'
              scoresByApp[code] = Number(sc.final_score)
              sumTotal += Number(sc.final_score)
            }
          }

          return {
            id: row.id as string,
            championshipId: (champ?.id || row.championship_id) as string,
            championshipName: champ?.name || 'Campeonato Oficial',
            gymnastId: (gym?.id || row.gymnast_id) as string,
            gymnastName: gym ? `${gym.first_name} ${gym.last_name}` : 'Gimnasta',
            rutOrId: gym?.rut_or_id,
            licenseNumber: gym?.license_number,
            categoryName: cat?.name || 'General',
            scoringRegime: (cat?.scoring_regime === 'obligatory' ? 'obligatory' : 'free') as 'free' | 'obligatory',
            rotationGroup: (row.rotation_group as string) ?? undefined,
            bibNumber: (row.bib_number as number) ?? undefined,
            status: row.status as ClubRegistrationRow['status'],
            scoresByApparatus: scoresByApp,
            totalScore: Math.round(sumTotal * 1000) / 1000,
          }
        })
        setRegistrations(mapped)
      }

      // 4. Load championships & categories for enrollment dropdown
      const { data: champsData } = await supabase
        .from('championships')
        .select('id, name')
        .eq('organization_id', activeOrganization.id)
        .order('start_date', { ascending: false })

      if (champsData && champsData.length > 0) {
        setAvailableChamps(champsData)
        if (!formChampId) setFormChampId(champsData[0].id)

        const { data: catsData } = await supabase
          .from('categories')
          .select('id, name, championship_id, scoring_regime')
          .eq('championship_id', champsData[0].id)
          .order('sort_order', { ascending: true })

        if (catsData) {
          setAvailableCategories(
            catsData.map((c) => ({
              id: c.id,
              name: c.name,
              championshipId: c.championship_id,
              scoringRegime: (c.scoring_regime || 'free') as 'free' | 'obligatory',
            }))
          )
          if (catsData.length > 0 && !formCatId) {
            setFormCatId(catsData[0].id)
          }
        }
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [activeOrganization, clubId, formGymnastId, formChampId, formCatId])

  useEffect(() => {
    loadClubData()
  }, [loadClubData])

  // Create single gymnast in the club roster
  const handleCreateGymnast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clubId || !activeOrganization) {
      setErrorMsg('No se detectó el club para asociar la gimnasta.')
      return
    }

    setIsSavingGymnast(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const { error } = await supabase.from('gymnasts').insert({
        organization_id: activeOrganization.id,
        club_id: clubId,
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        birth_date: newBirthDate,
        gender: newGender,
        rut_or_id: newRut.trim() || null,
        license_number: newLicense.trim() || null,
      })

      if (error) throw error

      setSuccessMsg(`¡${newFirstName} ${newLastName} agregada exitosamente al plantel del club!`)
      setIsCreatingGymnast(false)
      setNewFirstName('')
      setNewLastName('')
      setNewBirthDate('')
      setNewRut('')
      setNewLicense('')
      await loadClubData()
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    } finally {
      setIsSavingGymnast(false)
    }
  }

  // Bulk add gymnasts from multiline text
  const handleBulkAddGymnasts = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clubId || !activeOrganization || !bulkText.trim()) return

    setIsSavingGymnast(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const lines = bulkText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
      const toInsert = []

      for (const line of lines) {
        // Expected format: Nombre, Apellido, Fecha (YYYY-MM-DD), Licencia/RUT
        const parts = line.split(',').map((p) => p.trim())
        if (parts.length < 2) continue

        const firstName = parts[0]
        const lastName = parts[1]
        const birthDate = parts[2] && parts[2].match(/^\d{4}-\d{2}-\d{2}$/) ? parts[2] : '2012-01-01'
        const licenseOrRut = parts[3] || `FED-${Math.floor(Math.random() * 9000 + 1000)}`

        toInsert.push({
          organization_id: activeOrganization.id,
          club_id: clubId,
          first_name: firstName,
          last_name: lastName,
          birth_date: birthDate,
          gender: 'female' as const,
          license_number: licenseOrRut,
        })
      }

      if (toInsert.length === 0) {
        throw new Error('No se reconocieron registros válidos en las líneas ingresadas.')
      }

      const { error } = await supabase.from('gymnasts').insert(toInsert)
      if (error) throw error

      setSuccessMsg(`¡Se han importado ${toInsert.length} gimnastas exitosamente al plantel!`)
      setIsBulkAdding(false)
      setBulkText('')
      await loadClubData()
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    } finally {
      setIsSavingGymnast(false)
    }
  }

  // Handle championship change in enrollment form
  const handleChampChange = async (champId: string) => {
    setFormChampId(champId)
    const { data: catsData } = await supabase
      .from('categories')
      .select('id, name, championship_id, scoring_regime')
      .eq('championship_id', champId)
      .order('sort_order', { ascending: true })

    if (catsData) {
      setAvailableCategories(
        catsData.map((c) => ({
          id: c.id,
          name: c.name,
          championshipId: c.championship_id,
          scoringRegime: (c.scoring_regime || 'free') as 'free' | 'obligatory',
        }))
      )
      if (catsData.length > 0) {
        setFormCatId(catsData[0].id)
      }
    }
  }

  // Enroll selected gymnast to championship
  const handleEnrollGymnast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clubId || !formGymnastId || !formChampId || !formCatId) {
      setErrorMsg('Selecciona gimnasta, campeonato y categoría para inscribir.')
      return
    }

    setIsSubmittingEnrollment(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const { error } = await supabase.from('registrations').insert({
        club_id: clubId,
        gymnast_id: formGymnastId,
        championship_id: formChampId,
        category_id: formCatId,
        bib_number: formBib ? parseInt(formBib, 10) : null,
        rotation_group: formRotation || 'Subdivisión 1',
        status: 'approved',
      })

      if (error) throw error

      setSuccessMsg('¡Gimnasta inscrita y habilitada exitosamente en el campeonato!')
      setIsRegistering(false)
      setFormBib('')
      setFormRotation('')
      await loadClubData()
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    } finally {
      setIsSubmittingEnrollment(false)
    }
  }

  const calculateAge = (birthDateString: string) => {
    const today = new Date()
    const birth = new Date(birthDateString)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return isNaN(age) ? '-' : `${age} años`
  }

  return (
    <div className="space-y-6">
      {/* Header with Title, Club Badge & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 shadow-2xs">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black tracking-tight text-slate-900">
                Portal Autónomo del Club: Plantel & Delegaciones
              </h3>
              <Badge variant="default" className="bg-emerald-700 text-white font-bold text-[10px]">
                {clubName}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Gestiona el plantel oficial de gimnastas, licencias federativas e inscripciones a torneos activos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadClubData}
            title="Refrescar datos del club"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Banner de Invitación a Organizar Torneo Propio */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
              SaaS de Gimnasia para tu Club
            </span>
            <Badge variant="outline" className="text-[10px]">Cero Costo Inicial</Badge>
          </div>
          <h4 className="text-sm font-bold text-slate-900">
            ¿Tu club quiere organizar su propio campeonato o copa interclubes?
          </h4>
          <p className="text-xs text-slate-600 mt-0.5">
            Crea tu torneo, publica las bases técnicas, genera códigos PIN para jurados y abre inscripciones online para recibir a otros clubes invitados.
          </p>
        </div>

        {onCreateChampionship && (
          <button
            type="button"
            onClick={onCreateChampionship}
            className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition-colors shrink-0 flex items-center gap-2"
          >
            <Trophy className="h-4 w-4 text-amber-300" />
            Crear mi propio Campeonato →
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* SUB-TABS: Plantel de Deportistas vs Inscripciones a Torneos */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('roster')}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'roster'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Plantel de Deportistas del Club
            <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.2 text-[10px]">
              {gymnastsRoster.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('registrations')}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'registrations'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Inscripciones a Campeonatos
            <span className="ml-1 rounded-full bg-white/25 px-1.5 py-0.2 text-[10px]">
              {registrations.length}
            </span>
          </button>
        </div>

        {activeSubTab === 'roster' && (
          <div className="flex items-center gap-2">
            {!isCreatingGymnast && !isBulkAdding && (
              <>
                <button
                  type="button"
                  onClick={() => setIsBulkAdding(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  Cargar Nómina / Pegar Lista
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingGymnast(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Nueva Gimnasta
                </button>
              </>
            )}
          </div>
        )}

        {activeSubTab === 'registrations' && (
          <div>
            {!isRegistering && (
              <button
                type="button"
                onClick={() => setIsRegistering(true)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Inscribir Atleta a Torneo
              </button>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: PLANTEL DE DEPORTISTAS DEL CLUB */}
      {activeSubTab === 'roster' && (
        <div className="space-y-4">
          {/* Formulario de Alta Individual */}
          {isCreatingGymnast && (
            <Card className="border-emerald-200 bg-emerald-50/20 shadow-xs p-5">
              <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-emerald-700" />
                Dar de Alta Nueva Gimnasta en {clubName}
              </h4>
              <form onSubmit={handleCreateGymnast} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nombre</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Martina"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Apellido</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Rojas"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Fecha de Nacimiento</label>
                    <input
                      type="date"
                      required
                      value={newBirthDate}
                      onChange={(e) => setNewBirthDate(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">RUT / Identificación</label>
                    <input
                      type="text"
                      placeholder="Ej. 22.345.678-9"
                      value={newRut}
                      onChange={(e) => setNewRut(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Licencia Deportiva (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej. FED-GAF-2026-104"
                      value={newLicense}
                      onChange={(e) => setNewLicense(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono uppercase focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Rama / Género</label>
                    <select
                      value={newGender}
                      onChange={(e) => setNewGender(e.target.value as 'female' | 'male')}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="female">Femenino (GAF / GR)</option>
                      <option value="male">Masculino (GAM)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingGymnast(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingGymnast}
                    className="rounded bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {isSavingGymnast ? 'Guardando...' : 'Guardar Gimnasta'}
                  </button>
                </div>
              </form>
            </Card>
          )}

          {/* Formulario de Carga Rápida / Nómina Pegada */}
          {isBulkAdding && (
            <Card className="border-indigo-200 bg-indigo-50/20 shadow-xs p-5">
              <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-indigo-700" />
                Carga Masiva de Nómina
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                Pega la lista de gimnastas de tu club separadas por comas. Un registro por cada línea:
                <br />
                <code className="text-[11px] font-mono bg-white px-1.5 py-0.5 rounded text-indigo-900 border border-indigo-100">
                  Nombre, Apellido, FechaNacimiento (YYYY-MM-DD), Licencia/RUT
                </code>
              </p>

              <form onSubmit={handleBulkAddGymnasts} className="space-y-4">
                <textarea
                  rows={5}
                  required
                  placeholder={`Isidora, Castro, 2012-05-14, FED-GAF-101\nFlorencia, Araya, 2013-08-22, FED-GAF-102\nSofia, Mendez, 2011-11-03, FED-GAF-103`}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs font-mono focus:border-indigo-600 focus:outline-none"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkAdding(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingGymnast}
                    className="rounded bg-indigo-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                  >
                    {isSavingGymnast ? 'Importando...' : 'Importar Todas las Gimnastas'}
                  </button>
                </div>
              </form>
            </Card>
          )}

          {/* Tabla del Plantel */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Gimnastas Registradas en el Club ({gymnastsRoster.length})
              </h4>
              <span className="text-xs text-slate-500">Pertenecientes a: {clubName}</span>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">Cargando plantel del club...</div>
            ) : gymnastsRoster.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No hay gimnastas registradas aún en tu club</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Utiliza los botones de arriba para registrar a tus atletas individualmente o pegar la nómina completa de tu club.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Gimnasta</th>
                    <th className="px-4 py-3 font-semibold">Fecha Nac. / Edad</th>
                    <th className="px-4 py-3 font-semibold">RUT / Identificación</th>
                    <th className="px-4 py-3 font-semibold">Licencia Federativa</th>
                    <th className="px-4 py-3 font-semibold">Rama</th>
                    <th className="px-4 py-3 font-semibold text-right">Inscrita en Torneos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {gymnastsRoster.map((gym) => {
                    const enrolledCount = registrations.filter((r) => r.gymnastId === gym.id).length
                    return (
                      <tr key={gym.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {gym.firstName} {gym.lastName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {gym.birthDate} <span className="text-[10px] text-slate-400">({calculateAge(gym.birthDate)})</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                          {gym.rutOrId || 'Sin registrar'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-800">
                          {gym.licenseNumber || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]">
                            {gym.gender === 'female' ? 'GAF' : 'GAM'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {enrolledCount > 0 ? (
                            <Badge variant="success" className="text-[10px]">
                              {enrolledCount} campeonato(s)
                            </Badge>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">No inscrita</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INSCRIPCIONES A CAMPEONATOS */}
      {activeSubTab === 'registrations' && (
        <div className="space-y-4">
          {/* Modal / Formulario de Inscripción */}
          {isRegistering && (
            <Card className="border-blue-200 bg-blue-50/30 shadow-xs p-5">
              <h4 className="text-sm font-bold text-slate-900 mb-3">
                Inscribir Gimnasta de {clubName} a Campeonato Oficial
              </h4>
              <form onSubmit={handleEnrollGymnast} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gimnasta del Club</label>
                    {gymnastsRoster.length === 0 ? (
                      <p className="text-xs text-amber-700 font-medium">
                        Primero da de alta gimnastas en la pestaña "Plantel de Deportistas".
                      </p>
                    ) : (
                      <select
                        value={formGymnastId}
                        onChange={(e) => setFormGymnastId(e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-blue-600 focus:outline-none"
                      >
                        {gymnastsRoster.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.firstName} {g.lastName} {g.licenseNumber ? `(${g.licenseNumber})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Campeonato Destino</label>
                    <select
                      value={formChampId}
                      onChange={(e) => handleChampChange(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-blue-600 focus:outline-none"
                    >
                      {availableChamps.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Categoría / Nivel Técnico</label>
                    {availableCategories.length === 0 ? (
                      <p className="text-xs text-amber-700 font-medium">No hay categorías configuradas en este torneo.</p>
                    ) : (
                      <select
                        value={formCatId}
                        onChange={(e) => setFormCatId(e.target.value)}
                        className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-blue-600 focus:outline-none"
                      >
                        {availableCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({cat.scoringRegime === 'obligatory' ? 'Rutina Establecida' : 'Nivel Libre'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Dorsal / N° Competición (Opcional)</label>
                    <input
                      type="number"
                      placeholder="Ej. 102"
                      value={formBib}
                      onChange={(e) => setFormBib(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Subdivisión / Rotación Solicitada</label>
                    <input
                      type="text"
                      placeholder="Ej. Subdivisión 1 • Rotación B"
                      value={formRotation}
                      onChange={(e) => setFormRotation(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEnrollment || gymnastsRoster.length === 0 || availableCategories.length === 0}
                    className="rounded bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {isSubmittingEnrollment ? 'Inscribiendo...' : 'Confirmar Inscripción'}
                  </button>
                </div>
              </form>
            </Card>
          )}

          {/* Tabla de Inscripciones */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Gimnastas del Club Inscritas en Competición Oficial
              </h4>
              <span className="text-xs text-slate-500">Total: {registrations.length} inscritas</span>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">Cargando inscripciones...</div>
            ) : registrations.length === 0 ? (
              <div className="py-12 text-center">
                <Trophy className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No hay inscripciones registradas para este club</p>
                <p className="text-xs text-slate-400 mt-1">Usa el botón "Inscribir Atleta a Torneo" para inscribir a tus gimnastas.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Gimnasta</th>
                    <th className="px-4 py-3 font-semibold">Campeonato</th>
                    <th className="px-4 py-3 font-semibold">Categoría / Nivel</th>
                    <th className="px-4 py-3 font-semibold">Subdivisión / Rotación</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold text-right">Puntaje AA Oficial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {registrations.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{reg.gymnastName}</span>
                          {reg.bibNumber && (
                            <span className="font-mono text-[10px] bg-slate-100 px-1 rounded text-slate-600">
                              #{reg.bibNumber}
                            </span>
                          )}
                        </div>
                        {reg.licenseNumber && (
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Licencia: {reg.licenseNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{reg.championshipName}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900">{reg.categoryName}</span>
                        <Badge variant={reg.scoringRegime === 'obligatory' ? 'default' : 'outline'} className="ml-2 text-[9px]">
                          {reg.scoringRegime === 'obligatory' ? 'Rutina Establecida' : 'Libre'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                        {reg.rotationGroup || 'Por programar'}
                      </td>
                      <td className="px-4 py-3">
                        {reg.status === 'approved' ? (
                          <Badge variant="success" className="text-[10px]">Aprobada / Habilitada</Badge>
                        ) : reg.status === 'pending_approval' ? (
                          <Badge variant="warning" className="text-[10px]">Pendiente de Visado</Badge>
                        ) : (
                          <Badge variant="danger" className="text-[10px]">{reg.status}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {reg.totalScore > 0 ? (
                          <div>
                            <span className="font-mono font-black text-blue-900 text-sm">
                              {reg.totalScore.toFixed(3)}
                            </span>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {Object.entries(reg.scoresByApparatus)
                                .map(([app, s]) => `${app}:${s.toFixed(2)}`)
                                .join(' ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">Sin competir aún</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
