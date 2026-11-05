/**
 * Operix Awards — Módulo Oficial de Premiación, Podios, Medallero y Ceremonias.
 * Ciclo Olímpico FIG 2025-2028.
 * 
 * Desarrollado por Comercial Hels SpA para Operix Gymnastics.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/features/auth/AuthContext'
import { Badge } from '@/components/ui/badge'
import {
  Award,
  Trophy,
  Medal,
  Crown,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronLeft,
  FileText,
  Sparkles,
  Settings2,
  AlertCircle,
  RotateCcw,
  Layers,
} from 'lucide-react'
import type { Championship, Category } from '@/core/types/championship'
import type {
  AwardCeremonyItem,
  AwardsConfig,
  FewParticipantsRule,
  SpecialAwardEntry,
} from '@/core/types/awards'
import {
  DEFAULT_AWARDS_CONFIG,
  computeExAequoClubMedalTally,
  generateCeremonySchedule,
} from './awardsEngine'
import {
  computeAllAroundStandings,
  computeApparatusStandings,
  type GymnastScoreEntry,
} from '@/features/standings/standingsEngine'
import { filterApprovedScores } from '@/features/reports/reportsEngine'
import type { Json } from '@/core/types/database'

export const AwardsManager: React.FC = () => {
  const { user, profile } = useAuth()
  const [championships, setChampionships] = useState<Championship[]>([])
  const [selectedChampId, setSelectedChampId] = useState<string>('')
  const [categories, setCategories] = useState<Category[]>([])
  const [rawScores, setRawScores] = useState<GymnastScoreEntry[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<'ceremonies' | 'podiums' | 'medal_tally' | 'config'>('ceremonies')

  // Awards Config State
  const [config, setConfig] = useState<AwardsConfig>(DEFAULT_AWARDS_CONFIG)
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false)

  // Saved ceremonies state from database
  const [savedCeremonies, setSavedCeremonies] = useState<
    { ceremonyKey: string; status: 'pending' | 'in_progress' | 'completed'; awardedAt?: string }[]
  >([])

  // Live Ceremony Runner State
  const [activeCeremonyIndex, setActiveCeremonyIndex] = useState<number>(0)
  const [revealedStep, setRevealedStep] = useState<number>(3) // 0: none, 1: 3rd place, 2: 2nd place, 3: 1st place (all)
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  // Special Award Creation modal/form inputs
  const [newSpecialTitle, setNewSpecialTitle] = useState('')
  const [newSpecialRecipient, setNewSpecialRecipient] = useState('')
  const [newSpecialClub, setNewSpecialClub] = useState('')
  const [newSpecialDesc, setNewSpecialDesc] = useState('')

  // 1. Load Championships
  useEffect(() => {
    async function loadChampionships() {
      try {
        const { data, error } = await supabase
          .from('championships')
          .select('*')
          .order('start_date', { ascending: false })

        if (error) throw error
        if (data && data.length > 0) {
          const mapped: Championship[] = (data as unknown as Record<string, unknown>[]).map((d) => ({
            id: String(d.id),
            organizationId: String(d.organization_id),
            name: String(d.name),
            slug: String(d.slug),
            description: d.description ? String(d.description) : undefined,
            startDate: String(d.start_date),
            endDate: String(d.end_date),
            location: d.location ? String(d.location) : undefined,
            venueName: d.venue_name ? String(d.venue_name) : undefined,
            visibility: d.visibility as Championship['visibility'],
            status: d.status as Championship['status'],
            rulesetVersion: String(d.ruleset_version || '2025-2028'),
            scoringSchemaVersion: String(d.scoring_schema_version || '1.0'),
            createdAt: String(d.created_at),
            updatedAt: String(d.updated_at),
          }))
          setChampionships(mapped)
          setSelectedChampId(mapped[0].id)
        }
      } catch (err: unknown) {
        console.error('Error cargando campeonatos:', err)
      }
    }
    loadChampionships()
  }, [])

  // 2. Load Categories, Scores, Awards Config and Ceremonies for selected championship
  const fetchChampionshipData = useCallback(async () => {
    if (!selectedChampId) return
    setIsLoading(true)

    try {
      // Categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('championship_id', selectedChampId)
        .order('sort_order', { ascending: true })

      if (catData) {
        const mappedCats: Category[] = (catData as unknown as Record<string, unknown>[]).map((c) => ({
          id: String(c.id),
          championshipId: String(c.championship_id),
          discipline: c.discipline as Category['discipline'],
          name: String(c.name),
          code: String(c.code),
          gender: c.gender as Category['gender'],
          scoringRegime: c.scoring_regime as Category['scoringRegime'],
          defaultFixedDScore: c.default_fixed_d_score ? Number(c.default_fixed_d_score) : undefined,
          sortOrder: Number(c.sort_order) || 0,
          createdAt: String(c.created_at),
          updatedAt: String(c.updated_at),
        }))
        setCategories(mappedCats)
      }

      // Raw scores
      const { data: scoresData, error: scoresErr } = await supabase
        .from('scores')
        .select(`
          id,
          final_score,
          d_score,
          e_score_avg,
          status,
          attempt_number,
          apparatuses (
            code,
            name
          ),
          registrations (
            gymnast_id,
            category_id,
            gymnasts (
              full_name
            ),
            clubs (
              id,
              name
            ),
            categories (
              id,
              name,
              scoring_regime
            )
          )
        `)
        .eq('championship_id', selectedChampId)

      if (scoresErr) throw scoresErr

      if (scoresData) {
        const transformed: GymnastScoreEntry[] = (scoresData as unknown as Record<string, unknown>[]).map((row) => {
          const app = row.apparatuses as { code: string; name: string } | null
          const reg = row.registrations as {
            gymnast_id: string
            category_id?: string
            gymnasts: { full_name?: string } | null
            clubs: { id: string; name: string } | null
            categories: { id: string; name: string; scoring_regime?: string } | null
          } | null

          const cat = reg?.categories
          const gym = reg?.gymnasts
          const clb = reg?.clubs

          return {
            gymnastId: reg?.gymnast_id || String(row.id),
            gymnastName: gym?.full_name || 'Gimnasta',
            clubId: clb?.id || 'c-default',
            clubName: clb?.name || 'Club Participante',
            categoryId: cat?.id || reg?.category_id || 'general',
            categoryName: cat?.name || 'General',
            scoringRegime: (cat?.scoring_regime === 'obligatory' ? 'obligatory' : 'free') as 'free' | 'obligatory',
            apparatusCode: app?.code || 'VT',
            attemptNumber: row.attempt_number ? Number(row.attempt_number) : 1,
            dScore: Number(row.d_score) || 0,
            eScoreAvg: Number(row.e_score_avg) || 0,
            finalScore: Number(row.final_score) || 0,
            status: String(row.status || 'draft') as GymnastScoreEntry['status'],
          }
        })
        setRawScores(transformed)
      }

      // Config
      const { data: cfgData } = await supabase
        .from('championship_awards_config')
        .select('*')
        .eq('championship_id', selectedChampId)
        .maybeSingle()

      if (cfgData) {
        setConfig({
          placesAwardedCount: cfgData.places_awarded_count ?? 3,
          fewParticipantsRule: (cfgData.few_participants_rule as FewParticipantsRule) ?? 'standard_all',
          includeTrophiesForTeams: cfgData.include_trophies_for_teams ?? true,
          includeClubMedals: cfgData.include_club_medals ?? true,
          specialAwards: (cfgData.special_awards as unknown as SpecialAwardEntry[]) ?? [],
        })
      } else {
        setConfig(DEFAULT_AWARDS_CONFIG)
      }

      // Ceremonies state
      const { data: ceremoniesData } = await supabase
        .from('championship_awards_ceremonies')
        .select('ceremony_key, status, awarded_at')
        .eq('championship_id', selectedChampId)

      if (ceremoniesData) {
        setSavedCeremonies(
          ceremoniesData.map((c) => ({
            ceremonyKey: c.ceremony_key,
            status: c.status as 'pending' | 'in_progress' | 'completed',
            awardedAt: c.awarded_at || undefined,
          }))
        )
      }
    } catch (err: unknown) {
      console.error('Error cargando datos de premiación:', err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedChampId])

  useEffect(() => {
    fetchChampionshipData()
  }, [fetchChampionshipData])

  // Filter approved scores exclusively for official awards
  const approvedScores = useMemo(() => {
    return filterApprovedScores(rawScores, false)
  }, [rawScores])

  const pendingScoresCount = useMemo(() => {
    return rawScores.filter((s) => s.status !== 'official_approved').length
  }, [rawScores])

  // Generate complete sequence of award ceremonies
  const ceremoniesSchedule = useMemo(() => {
    return generateCeremonySchedule({
      categories,
      approvedScores,
      config,
      savedCeremonies,
    })
  }, [categories, approvedScores, config, savedCeremonies])

  // Current active ceremony
  const currentCeremony = ceremoniesSchedule[activeCeremonyIndex] || ceremoniesSchedule[0]

  // Compute Olympic Club Medal Tally
  const allAroundGlobal = useMemo(() => {
    return computeAllAroundStandings(approvedScores)
  }, [approvedScores])

  const apparatusCodesGlobal = useMemo(() => {
    return Array.from(new Set(approvedScores.map((s) => s.apparatusCode))).filter(Boolean)
  }, [approvedScores])

  const apparatusGlobalList = useMemo(() => {
    return apparatusCodesGlobal.map((code) => computeApparatusStandings(approvedScores, code))
  }, [approvedScores, apparatusCodesGlobal])

  const clubMedalTally = useMemo(() => {
    return computeExAequoClubMedalTally(allAroundGlobal, apparatusGlobalList)
  }, [allAroundGlobal, apparatusGlobalList])

  // Save Awards Configuration
  const handleSaveConfig = async () => {
    if (!selectedChampId) return
    setIsSavingConfig(true)
    try {
      const { error } = await supabase.from('championship_awards_config').upsert(
        {
          championship_id: selectedChampId,
          places_awarded_count: config.placesAwardedCount,
          few_participants_rule: config.fewParticipantsRule,
          include_trophies_for_teams: config.includeTrophiesForTeams,
          include_club_medals: config.includeClubMedals,
          special_awards: config.specialAwards as unknown as Json,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'championship_id' }
      )

      if (error) throw error
      setNotification({ type: 'success', message: '¡Configuración de premiación guardada exitosamente!' })
    } catch (err: unknown) {
      console.error(err)
      setNotification({ type: 'error', message: 'Error al guardar la configuración de premiación.' })
    } finally {
      setIsSavingConfig(false)
    }
  }

  // Add Special Award
  const handleAddSpecialAward = () => {
    if (!newSpecialTitle.trim() || !newSpecialRecipient.trim()) {
      setNotification({ type: 'error', message: 'Debe ingresar el título y el nombre del galardonado.' })
      return
    }

    const newAward: SpecialAwardEntry = {
      id: `sp-${Date.now()}`,
      title: newSpecialTitle.trim(),
      recipientName: newSpecialRecipient.trim(),
      clubName: newSpecialClub.trim() || undefined,
      description: newSpecialDesc.trim() || undefined,
    }

    setConfig((prev) => ({
      ...prev,
      specialAwards: [...prev.specialAwards, newAward],
    }))

    setNewSpecialTitle('')
    setNewSpecialRecipient('')
    setNewSpecialClub('')
    setNewSpecialDesc('')
    setNotification({ type: 'success', message: 'Reconocimiento especial agregado. Recuerde guardar la configuración.' })
  }

  // Remove Special Award
  const handleRemoveSpecialAward = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      specialAwards: prev.specialAwards.filter((s) => s.id !== id),
    }))
  }

  // Mark Ceremony as Completed
  const handleCompleteCeremony = async (ceremony: AwardCeremonyItem) => {
    if (!selectedChampId) return

    try {
      const now = new Date().toISOString()
      const { error } = await supabase.from('championship_awards_ceremonies').upsert(
        {
          championship_id: selectedChampId,
          ceremony_key: ceremony.ceremonyKey,
          ceremony_type: ceremony.ceremonyType,
          category_id: ceremony.categoryId || null,
          apparatus_code: ceremony.apparatusCode || null,
          title: ceremony.title,
          sequence_order: ceremony.sequenceOrder,
          status: 'completed',
          podium_data: ceremony.podiumPlaces as unknown as Json,
          awarded_at: now,
          awarded_by_user_id: user?.id || null,
          updated_at: now,
        },
        { onConflict: 'championship_id,ceremony_key' }
      )

      if (error) throw error

      setSavedCeremonies((prev) => {
        const filtered = prev.filter((s) => s.ceremonyKey !== ceremony.ceremonyKey)
        return [...filtered, { ceremonyKey: ceremony.ceremonyKey, status: 'completed', awardedAt: now }]
      })

      setNotification({
        type: 'success',
        message: `¡Ceremonia "${ceremony.title}" marcada como completada oficialmente!`,
      })
    } catch (err: unknown) {
      console.error(err)
      setNotification({ type: 'error', message: 'Error al registrar la finalización de la ceremonia.' })
    }
  }

  // Re-open Ceremony
  const handleReopenCeremony = async (ceremony: AwardCeremonyItem) => {
    if (!selectedChampId) return

    try {
      const now = new Date().toISOString()
      const { error } = await supabase.from('championship_awards_ceremonies').upsert(
        {
          championship_id: selectedChampId,
          ceremony_key: ceremony.ceremonyKey,
          ceremony_type: ceremony.ceremonyType,
          category_id: ceremony.categoryId || null,
          apparatus_code: ceremony.apparatusCode || null,
          title: ceremony.title,
          sequence_order: ceremony.sequenceOrder,
          status: 'pending',
          podium_data: ceremony.podiumPlaces as unknown as Json,
          awarded_at: null,
          awarded_by_user_id: user?.id || null,
          updated_at: now,
        },
        { onConflict: 'championship_id,ceremony_key' }
      )

      if (error) throw error

      setSavedCeremonies((prev) => {
        const filtered = prev.filter((s) => s.ceremonyKey !== ceremony.ceremonyKey)
        return [...filtered, { ceremonyKey: ceremony.ceremonyKey, status: 'pending', awardedAt: undefined }]
      })

      setNotification({
        type: 'info',
        message: `La ceremonia "${ceremony.title}" ha sido reabierta.`,
      })
    } catch (err: unknown) {
      console.error(err)
      setNotification({ type: 'error', message: 'Error al reabrir la ceremonia.' })
    }
  }

  // Integration with Operix Reports: Generate & Log Diplomas for current ceremony
  const handleEmitDiplomasForCeremony = async (ceremony: AwardCeremonyItem) => {
    if (!selectedChampId) return

    try {
      const eligibleAthletes = ceremony.podiumPlaces.filter((p) => p.diplomaEligible && p.gymnastName)
      if (eligibleAthletes.length === 0) {
        setNotification({ type: 'error', message: 'No hay deportistas elegibles para diplomas en esta ceremonia.' })
        return
      }

      // Record generation in championship_documents table
      const title = `Diplomas Oficiales — ${ceremony.title}`
      const { error } = await supabase.from('championship_documents').insert({
        championship_id: selectedChampId,
        document_type: 'diplomas_batch',
        title,
        file_format: 'pdf',
        filters: { ceremonyKey: ceremony.ceremonyKey, ceremonyType: ceremony.ceremonyType },
        metadata: {
          recipientCount: eligibleAthletes.length,
          recipients: eligibleAthletes.map((a) => ({ name: a.gymnastName, rank: a.rank, club: a.clubName })),
          generatedBy: profile?.fullName || user?.email,
          attribution: 'Desarrollado por Comercial Hels SpA',
        },
        generated_by_user_id: user?.id || null,
      })

      if (error) throw error

      setNotification({
        type: 'success',
        message: `¡Se han generado y registrado los diplomas oficiales para los ${eligibleAthletes.length} premiados de ${ceremony.title}!`,
      })
    } catch (err: unknown) {
      console.error(err)
      setNotification({ type: 'error', message: 'Error al generar los diplomas de la ceremonia.' })
    }
  }

  const currentChamp = championships.find((c) => c.id === selectedChampId)
  const completedCeremoniesCount = ceremoniesSchedule.filter((c) => c.status === 'completed').length

  return (
    <div className="space-y-6">
      {/* 1. HEADER & BARRA DE ESTADO */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600 text-white shadow-xs">
                <Crown className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  Operix Awards — Premiación & Medallero
                </h1>
                <p className="text-xs text-slate-500">
                  Sistema Oficial de Podios, Ceremonias y Medallero Olímpico FIG • Ciclo 2025-2028
                </p>
              </div>
            </div>
          </div>

          {/* Championship Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="champ-select" className="text-xs font-semibold text-slate-600">
                Torneo:
              </label>
              <select
                id="champ-select"
                value={selectedChampId}
                onChange={(e) => setSelectedChampId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs focus:border-amber-500 focus:outline-hidden"
              >
                {championships.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick reload */}
            <button
              type="button"
              onClick={fetchChampionshipData}
              title="Actualizar datos"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Puntajes Aprobados</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="font-mono text-sm font-bold text-slate-800">{approvedScores.length}</span>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Puntajes Pendientes</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <AlertCircle className={`h-4 w-4 ${pendingScoresCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
              <span className={`font-mono text-sm font-bold ${pendingScoresCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                {pendingScoresCount}
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ceremonias Totales</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Layers className="h-4 w-4 text-blue-600" />
              <span className="font-mono text-sm font-bold text-slate-800">{ceremoniesSchedule.length}</span>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Progreso Premiaciones</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Award className="h-4 w-4 text-amber-600" />
              <span className="font-mono text-sm font-bold text-slate-800">
                {completedCeremoniesCount} / {ceremoniesSchedule.length}
              </span>
            </div>
          </div>
        </div>

        {pendingScoresCount > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 border border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Aviso de Integridad:</strong> Existen {pendingScoresCount} puntuaciones sin aprobación oficial definitiva. 
              El módulo de premiación excluye notas provisionales o en borrador, protegiendo los podios de resultados no certificados.
            </span>
          </div>
        )}
      </div>

      {/* 2. NOTIFICACIONES */}
      {notification && (
        <div
          className={`flex items-center justify-between rounded-lg p-3 text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : notification.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          <span>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. TABS NAVIGATION */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl">
        <button
          type="button"
          onClick={() => setActiveTab('ceremonies')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'ceremonies'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Crown className="h-4 w-4" />
          <span>Ceremonias en Vivo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('podiums')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'podiums'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="h-4 w-4" />
          <span>Catálogo de Podios</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('medal_tally')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'medal_tally'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Medal className="h-4 w-4" />
          <span>Medallero General de Clubes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'config'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings2 className="h-4 w-4" />
          <span>Configuración & Premios Especiales</span>
        </button>
      </div>

      {/* 4. TAB CONTENT */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl bg-white border border-slate-200">
          <p className="text-xs text-slate-500">Cargando motor de premiación y resultados oficiales...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: CEREMONIAS EN VIVO (RUNNER & MODO ESTADIO / PANTALLA COMPLETA) */}
          {activeTab === 'ceremonies' && (
            <div className="space-y-6">
              {ceremoniesSchedule.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                  <Award className="mx-auto h-8 w-8 text-slate-300" />
                  <h3 className="mt-2 text-sm font-bold text-slate-800">No hay ceremonias disponibles</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Asegúrese de que existan puntuaciones aprobadas por el Director Técnico o Juez General.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                  {/* Sidebar: Lista ordenada de ceremonias */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-1">
                    <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Orden de Ceremonias
                      </h3>
                      <span className="font-mono text-[10px] font-bold text-slate-500">
                        {completedCeremoniesCount}/{ceremoniesSchedule.length}
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-[550px] overflow-y-auto pr-1">
                      {ceremoniesSchedule.map((c, idx) => {
                        const isCurrent = idx === activeCeremonyIndex
                        const isDone = c.status === 'completed'

                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setActiveCeremonyIndex(idx)
                              setRevealedStep(3)
                            }}
                            className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition-all flex items-center justify-between ${
                              isCurrent
                                ? 'bg-amber-500 text-white font-bold shadow-xs'
                                : isDone
                                ? 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <span className="mr-1.5 opacity-70 font-mono text-[10px]">#{c.sequenceOrder}</span>
                              <span>{c.title}</span>
                            </div>
                            {isDone ? (
                              <CheckCircle2 className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-white' : 'text-emerald-600'}`} />
                            ) : (
                              <Clock className={`h-3.5 w-3.5 shrink-0 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Main Ceremony Arena */}
                  <div className="space-y-4 lg:col-span-3">
                    {/* Control Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-600">
                            Ceremonia #{currentCeremony.sequenceOrder} de {ceremoniesSchedule.length}
                          </span>
                          <Badge
                            variant={currentCeremony.status === 'completed' ? 'success' : 'outline'}
                            className="text-[10px]"
                          >
                            {currentCeremony.status === 'completed' ? 'Realizada' : 'Pendiente'}
                          </Badge>
                          {currentCeremony.isFewParticipants && (
                            <Badge variant="warning" className="text-[10px]">
                              Pocos Participantes
                            </Badge>
                          )}
                        </div>
                        <h2 className="text-lg font-black text-slate-900 mt-0.5">{currentCeremony.title}</h2>
                        {currentCeremony.fewParticipantsNote && (
                          <p className="text-xs text-amber-700 mt-0.5 font-medium">
                            {currentCeremony.fewParticipantsNote}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Reveal Controls */}
                        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
                          <button
                            type="button"
                            onClick={() => setRevealedStep(1)}
                            className={`rounded px-2 py-1 font-semibold ${
                              revealedStep === 1 ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Solo 3°
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevealedStep(2)}
                            className={`rounded px-2 py-1 font-semibold ${
                              revealedStep === 2 ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Hasta 2°
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevealedStep(3)}
                            className={`rounded px-2 py-1 font-semibold ${
                              revealedStep === 3 ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            Revelar Todo
                          </button>
                        </div>

                        {/* Full Screen Mode */}
                        <button
                          type="button"
                          onClick={() => setIsFullScreen(true)}
                          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 shadow-xs"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                          <span>Modo Pantalla Completa</span>
                        </button>
                      </div>
                    </div>

                    {/* Interactive Podium Presentation */}
                    <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 p-6 text-white shadow-md">
                      <div className="text-center mb-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                          {currentChamp?.name}
                        </span>
                        <h2 className="text-xl font-black uppercase tracking-wider text-white">
                          {currentCeremony.title}
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                          Resultados Oficiales Homologados • Ciclo FIG 2025-2028
                        </p>
                      </div>

                      {/* The 3 Pedestals (Order: 2nd place on left, 1st place in center, 3rd place on right) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-4 max-w-4xl mx-auto min-h-[340px]">
                        {/* 2ND PLACE (SILVER) */}
                        <div className="order-2 md:order-1 flex flex-col items-center">
                          {currentCeremony.podiumPlaces.find((p) => p.rank === 2) && revealedStep >= 2 ? (
                            <div className="w-full flex flex-col items-center animate-fadeIn">
                              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-slate-800 shadow-lg ring-4 ring-slate-400">
                                <Medal className="h-8 w-8" />
                              </div>
                              <div className="text-center w-full px-2">
                                <span className="rounded-full bg-slate-300 text-slate-900 font-black text-[10px] px-2 py-0.5">
                                  PLATA (2° LUGAR)
                                </span>
                                <h4 className="text-base font-black text-white mt-1 truncate">
                                  {currentCeremony.podiumPlaces.find((p) => p.rank === 2)?.gymnastName ||
                                    currentCeremony.podiumPlaces.find((p) => p.rank === 2)?.clubName}
                                </h4>
                                <p className="text-xs text-slate-300 font-medium truncate">
                                  {currentCeremony.podiumPlaces.find((p) => p.rank === 2)?.clubName}
                                </p>
                                {currentCeremony.podiumPlaces.find((p) => p.rank === 2)?.finalScore !== undefined && (
                                  <p className="font-mono text-sm font-bold text-amber-300 mt-0.5">
                                    {currentCeremony.podiumPlaces.find((p) => p.rank === 2)?.finalScore?.toFixed(3)} pts
                                  </p>
                                )}
                              </div>
                              {/* Pedestal */}
                              <div className="w-full h-32 bg-gradient-to-t from-slate-700 to-slate-500 rounded-t-lg mt-3 flex items-center justify-center border-t border-slate-300">
                                <span className="font-black text-3xl text-slate-200">2</span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-32 bg-slate-800/40 rounded-t-lg flex items-center justify-center border border-slate-700 text-slate-600 text-xs">
                              {currentCeremony.podiumPlaces.find((p) => p.rank === 2) ? 'Oculto' : 'Sin 2° lugar'}
                            </div>
                          )}
                        </div>

                        {/* 1ST PLACE (GOLD / CHAMPION) */}
                        <div className="order-1 md:order-2 flex flex-col items-center">
                          {currentCeremony.podiumPlaces.find((p) => p.rank === 1) && revealedStep >= 3 ? (
                            <div className="w-full flex flex-col items-center animate-fadeIn">
                              <div className="mb-2 flex h-18 w-18 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-xl ring-4 ring-amber-300">
                                <Crown className="h-10 w-10 text-amber-900" />
                              </div>
                              <div className="text-center w-full px-2">
                                <span className="rounded-full bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-0.5 shadow-xs">
                                  CAMPEÓN (ORO)
                                </span>
                                <h3 className="text-lg font-black text-white mt-1 truncate">
                                  {currentCeremony.podiumPlaces.find((p) => p.rank === 1)?.gymnastName ||
                                    currentCeremony.podiumPlaces.find((p) => p.rank === 1)?.clubName}
                                </h3>
                                <p className="text-xs text-amber-200 font-semibold truncate">
                                  {currentCeremony.podiumPlaces.find((p) => p.rank === 1)?.clubName}
                                </p>
                                {currentCeremony.podiumPlaces.find((p) => p.rank === 1)?.finalScore !== undefined && (
                                  <p className="font-mono text-base font-black text-amber-400 mt-0.5">
                                    {currentCeremony.podiumPlaces.find((p) => p.rank === 1)?.finalScore?.toFixed(3)} pts
                                  </p>
                                )}
                              </div>
                              {/* Pedestal (highest) */}
                              <div className="w-full h-44 bg-gradient-to-t from-amber-700 to-amber-500 rounded-t-lg mt-3 flex items-center justify-center border-t-2 border-amber-300 shadow-lg">
                                <span className="font-black text-4xl text-amber-100">1</span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-44 bg-slate-800/40 rounded-t-lg flex items-center justify-center border border-slate-700 text-slate-600 text-xs">
                              {currentCeremony.podiumPlaces.find((p) => p.rank === 1) ? 'Oculto' : 'Sin 1° lugar'}
                            </div>
                          )}
                        </div>

                        {/* 3RD PLACE (BRONZE) */}
                        <div className="order-3 flex flex-col items-center">
                          {currentCeremony.podiumPlaces.find((p) => p.rank === 3) && revealedStep >= 1 ? (
                            <div className="w-full flex flex-col items-center animate-fadeIn">
                              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-700 text-amber-100 shadow-lg ring-4 ring-amber-600">
                                <Medal className="h-8 w-8" />
                              </div>
                              <div className="text-center w-full px-2">
                                <span className="rounded-full bg-amber-800 text-amber-100 font-black text-[10px] px-2 py-0.5">
                                  BRONCE (3° LUGAR)
                                </span>
                                <h4 className="text-base font-black text-white mt-1 truncate">
                                  {currentCeremony.podiumPlaces.find((p) => p.rank === 3)?.gymnastName ||
                                    currentCeremony.podiumPlaces.find((p) => p.rank === 3)?.clubName}
                                </h4>
                                <p className="text-xs text-slate-300 font-medium truncate">
                                  {currentCeremony.podiumPlaces.find((p) => p.rank === 3)?.clubName}
                                </p>
                                {currentCeremony.podiumPlaces.find((p) => p.rank === 3)?.finalScore !== undefined && (
                                  <p className="font-mono text-sm font-bold text-amber-300 mt-0.5">
                                    {currentCeremony.podiumPlaces.find((p) => p.rank === 3)?.finalScore?.toFixed(3)} pts
                                  </p>
                                )}
                              </div>
                              {/* Pedestal */}
                              <div className="w-full h-24 bg-gradient-to-t from-amber-900 to-amber-700 rounded-t-lg mt-3 flex items-center justify-center border-t border-amber-500">
                                <span className="font-black text-2xl text-amber-200">3</span>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-24 bg-slate-800/40 rounded-t-lg flex items-center justify-center border border-slate-700 text-slate-600 text-xs">
                              {currentCeremony.podiumPlaces.find((p) => p.rank === 3) ? 'Oculto' : 'Sin 3° lugar'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ex-Aequo or Additional places (4th..8th) */}
                      {currentCeremony.podiumPlaces.length > 3 && (
                        <div className="mt-6 border-t border-slate-800 pt-4 text-center">
                          <span className="text-[11px] font-bold uppercase text-slate-400">
                            Puestos de Honor y Diplomas Adicionales
                          </span>
                          <div className="mt-2 flex flex-wrap justify-center gap-2">
                            {currentCeremony.podiumPlaces
                              .filter((p) => p.rank > 3)
                              .map((p) => (
                                <div
                                  key={p.gymnastId || p.clubId}
                                  className="rounded-lg bg-slate-800/80 px-3 py-1.5 text-xs border border-slate-700 text-left"
                                >
                                  <span className="font-mono font-bold text-amber-400 mr-1.5">{p.rank}°</span>
                                  <span className="font-semibold text-white">{p.gymnastName || p.clubName}</span>
                                  <span className="text-slate-400 text-[10px] ml-1">({p.clubName})</span>
                                  {p.finalScore !== undefined && (
                                    <span className="font-mono text-slate-300 ml-1.5">{p.finalScore.toFixed(3)}</span>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      <div className="text-center mt-6 text-[10px] text-slate-500">
                        Desarrollado por Comercial Hels SpA para Operix Gymnastics
                      </div>
                    </div>

                    {/* Operational Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <div className="flex items-center gap-2">
                        {/* Previous Ceremony */}
                        <button
                          type="button"
                          disabled={activeCeremonyIndex === 0}
                          onClick={() => {
                            setActiveCeremonyIndex((prev) => Math.max(0, prev - 1))
                            setRevealedStep(3)
                          }}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>Anterior</span>
                        </button>

                        {/* Next Ceremony */}
                        <button
                          type="button"
                          disabled={activeCeremonyIndex >= ceremoniesSchedule.length - 1}
                          onClick={() => {
                            setActiveCeremonyIndex((prev) => Math.min(ceremoniesSchedule.length - 1, prev + 1))
                            setRevealedStep(3)
                          }}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                          <span>Siguiente</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Generate diplomas for this ceremony */}
                        <button
                          type="button"
                          onClick={() => handleEmitDiplomasForCeremony(currentCeremony)}
                          className="flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Emitir Diplomas</span>
                        </button>

                        {/* Mark completed / reopen */}
                        {currentCeremony.status === 'completed' ? (
                          <button
                            type="button"
                            onClick={() => handleReopenCeremony(currentCeremony)}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                          >
                            <RotateCcw className="h-4 w-4" />
                            <span>Reabrir Premiación</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleCompleteCeremony(currentCeremony)}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Marcar como Realizada</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CATÁLOGO DE PODIOS (TODOS LOS RESULTADOS HOMOLOGADOS) */}
          {activeTab === 'podiums' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Catálogo Completo de Podios Homologados</h3>
                  <p className="text-xs text-slate-500">
                    Podios calculados exclusivamente desde el motor deportivo oficial con desempates FIG.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ceremoniesSchedule.map((ceremony) => (
                  <div key={ceremony.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-amber-600">
                          {ceremony.ceremonyType === 'all_around'
                            ? 'All-Around'
                            : ceremony.ceremonyType === 'apparatus'
                            ? `Aparato: ${ceremony.apparatusName}`
                            : ceremony.ceremonyType === 'team'
                            ? 'Equipos'
                            : 'Institucional'}
                        </span>
                        <h4 className="text-xs font-black text-slate-900">{ceremony.title}</h4>
                      </div>
                      <Badge variant={ceremony.status === 'completed' ? 'success' : 'outline'} className="text-[10px]">
                        {ceremony.status === 'completed' ? 'Realizada' : 'Pendiente'}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {ceremony.podiumPlaces.map((p) => (
                        <div
                          key={`${p.gymnastId || p.clubId}-${p.rank}`}
                          className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full font-black text-xs ${
                                p.rank === 1
                                  ? 'bg-amber-400 text-slate-950'
                                  : p.rank === 2
                                  ? 'bg-slate-300 text-slate-900'
                                  : p.rank === 3
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {p.rank}
                            </span>
                            <div>
                              <p className="font-bold text-slate-900">{p.gymnastName || p.clubName}</p>
                              <p className="text-[10px] text-slate-500">{p.clubName}</p>
                            </div>
                          </div>

                          <div className="text-right">
                            {p.finalScore !== undefined && (
                              <p className="font-mono font-bold text-slate-900">{p.finalScore.toFixed(3)}</p>
                            )}
                            {p.isExAequo && (
                              <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-800">
                                Ex-Aequo
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: MEDALLERO GENERAL DE CLUBES */}
          {activeTab === 'medal_tally' && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    Medallero Oficial de Clubes (Ciclo Olímpico)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Criterio de ordenación: Mayor cantidad de Oros $\rightarrow$ Platas $\rightarrow$ Bronces $\rightarrow$ Total de Medallas.
                  </p>
                </div>

                <Badge variant="default" className="text-xs font-mono">
                  {clubMedalTally.length} Clubes en el Medallero
                </Badge>
              </div>

              {clubMedalTally.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No se han registrado medallas oficiales aprobadas en este torneo.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200">
                    <thead className="bg-slate-100 uppercase text-[10px] font-bold text-slate-700 border-b border-slate-300">
                      <tr>
                        <th className="py-2.5 px-3 text-center">Posición</th>
                        <th className="py-2.5 px-3">Club / Institución</th>
                        <th className="py-2.5 px-3 text-center bg-amber-100/60 font-mono text-amber-950">Oro (🥇)</th>
                        <th className="py-2.5 px-3 text-center bg-slate-200/60 font-mono text-slate-900">Plata (🥈)</th>
                        <th className="py-2.5 px-3 text-center bg-amber-200/40 font-mono text-amber-900">Bronce (🥉)</th>
                        <th className="py-2.5 px-3 text-center font-mono font-black text-slate-900">Total Medallas</th>
                        <th className="py-2.5 px-3 text-center font-mono text-slate-600">Atletas Premiados</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {clubMedalTally.map((club) => (
                        <tr key={club.clubId} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            <span className="flex items-center justify-center gap-1">
                              {club.rank}°
                              {club.isExAequo && (
                                <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-800">
                                  =
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{club.clubName}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-amber-700 bg-amber-50/30">
                            {club.gold}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-slate-700 bg-slate-100/30">
                            {club.silver}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-amber-900 bg-amber-50/20">
                            {club.bronze}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-sm text-slate-900">
                            {club.total}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                            {club.awardedAthletesCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CONFIGURACIÓN & PREMIOS ESPECIALES */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="border-b border-slate-200 pb-3 mb-4">
                  <h3 className="text-base font-bold text-slate-900">Parámetros del Sistema de Premiación</h3>
                  <p className="text-xs text-slate-500">
                    Configuración de lugares premiados, políticas para categorías pequeñas y reconocimientos especiales.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Places Count */}
                  <div>
                    <label htmlFor="places-count" className="block text-xs font-bold text-slate-700">Lugares Premiados con Podio / Mención</label>
                    <select
                      id="places-count"
                      value={config.placesAwardedCount}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, placesAwardedCount: Number(e.target.value) }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold"
                    >
                      <option value={3}>Top 3 (Oro, Plata, Bronce - Estándar Olímpico)</option>
                      <option value={5}>Top 5 (Top 3 Medallas + 4° y 5° Diplomas de Honor)</option>
                      <option value={8}>Top 8 (Norma FIG de Diplomas para Finalistas)</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Determina hasta qué puesto se revelan deportistas en la ceremonia y diplomas masivos.
                    </p>
                  </div>

                  {/* Few Participants Rule */}
                  <div>
                    <label htmlFor="few-rule" className="block text-xs font-bold text-slate-700">Criterio para Categorías con Pocos Atletas</label>
                    <select
                      id="few-rule"
                      value={config.fewParticipantsRule}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          fewParticipantsRule: e.target.value as FewParticipantsRule,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold"
                    >
                      <option value="standard_all">
                        Estándar Inclusivo (Premia todos los lugares disponibles: 1 atleta = Oro directo)
                      </option>
                      <option value="strict_n_minus_one">
                        Norma FIG Estricta N-1 (1 atleta recibe Reconocimiento; mínimo 2 para Oro oficial)
                      </option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Aplica para subdivisiones formativas o niveles con baja convocatoria.
                    </p>
                  </div>

                  {/* Team Trophies Toggle */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="team-trophies"
                      checked={config.includeTrophiesForTeams}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, includeTrophiesForTeams: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="team-trophies" className="text-xs font-semibold text-slate-700">
                      Entregar Trofeos de Oro, Plata y Bronce en la modalidad por Equipos
                    </label>
                  </div>

                  {/* Club Medals Toggle */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="club-medals"
                      checked={config.includeClubMedals}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, includeClubMedals: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="club-medals" className="text-xs font-semibold text-slate-700">
                      Incluir Ceremonia de Premiación para el Medallero Institucional de Clubes
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    disabled={isSavingConfig}
                    onClick={handleSaveConfig}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 shadow-xs"
                  >
                    {isSavingConfig ? 'Guardando...' : 'Guardar Configuración'}
                  </button>
                </div>
              </div>

              {/* Special Awards Manager */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="border-b border-slate-200 pb-3 mb-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Reconocimientos Especiales
                  </h3>
                  <p className="text-xs text-slate-500">
                    Agregue distinciones honoríficas (Espíritu Deportivo, Mejor Ejecución, Gimnasta Revelación, etc.).
                  </p>
                </div>

                {/* Form to add */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg mb-4 border border-slate-200">
                  <div>
                    <label htmlFor="special-title" className="block text-[11px] font-bold text-slate-600">Título Distinción</label>
                    <input
                      id="special-title"
                      type="text"
                      placeholder="Ej. Espíritu Deportivo"
                      value={newSpecialTitle}
                      onChange={(e) => setNewSpecialTitle(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 p-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="special-recipient" className="block text-[11px] font-bold text-slate-600">Galardonado(a)</label>
                    <input
                      id="special-recipient"
                      type="text"
                      placeholder="Nombre del atleta o juez"
                      value={newSpecialRecipient}
                      onChange={(e) => setNewSpecialRecipient(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 p-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="special-club" className="block text-[11px] font-bold text-slate-600">Club / Institución</label>
                    <input
                      id="special-club"
                      type="text"
                      placeholder="Ej. Club Gimnástico Sur"
                      value={newSpecialClub}
                      onChange={(e) => setNewSpecialClub(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 p-1.5 text-xs"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddSpecialAward}
                      className="w-full rounded bg-slate-900 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                {/* Current Special Awards List */}
                {config.specialAwards.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No hay reconocimientos especiales configurados.</p>
                ) : (
                  <div className="space-y-2">
                    {config.specialAwards.map((sp) => (
                      <div
                        key={sp.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs bg-white"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{sp.title}</p>
                          <p className="text-slate-600">
                            Para: <strong>{sp.recipientName}</strong> {sp.clubName && `• ${sp.clubName}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecialAward(sp.id)}
                          className="text-red-600 hover:text-red-800 font-bold"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 5. FULL SCREEN ARENA MODAL */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-8 text-white animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <Crown className="h-8 w-8 text-amber-400" />
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                  {currentChamp?.name} • Ceremonia #{currentCeremony.sequenceOrder}
                </span>
                <h1 className="text-2xl font-black uppercase text-white">{currentCeremony.title}</h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsFullScreen(false)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700"
            >
              <Minimize2 className="h-4 w-4" />
              <span>Cerrar Pantalla Completa (ESC)</span>
            </button>
          </div>

          {/* Full Screen Arena Pedestals */}
          <div className="grid grid-cols-3 gap-6 items-end max-w-5xl mx-auto w-full my-auto">
            {/* 2nd Place */}
            <div className="flex flex-col items-center">
              {currentCeremony.podiumPlaces.find((p) => p.rank === 2) && revealedStep >= 2 ? (
                <div className="w-full flex flex-col items-center">
                  <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-slate-900 shadow-2xl ring-4 ring-slate-400">
                    <Medal className="h-10 w-10" />
                  </div>
                  <span className="rounded-full bg-slate-300 text-slate-900 font-black text-xs px-3 py-1">
                    2° LUGAR — PLATA
                  </span>
                  <h3 className="text-2xl font-black text-white mt-2 text-center">
                    {currentCeremony.podiumPlaces.find((p) => p.rank === 2)?.gymnastName ||
                      currentCeremony.podiumPlaces.find((p) => p.rank === 2)?.clubName}
                  </h3>
                  <p className="text-sm text-slate-300 font-semibold">
                    {currentCeremony.podiumPlaces.find((p) => p.rank === 2)?.clubName}
                  </p>
                  {currentCeremony.podiumPlaces.find((p) => p.rank === 2)?.finalScore !== undefined && (
                    <p className="font-mono text-xl font-bold text-amber-400 mt-1">
                      {currentCeremony.podiumPlaces.find((p) => p.rank === 2)?.finalScore?.toFixed(3)}
                    </p>
                  )}
                  <div className="w-full h-44 bg-gradient-to-t from-slate-700 to-slate-500 rounded-t-xl mt-4 flex items-center justify-center border-t-2 border-slate-300 shadow-2xl">
                    <span className="font-black text-6xl text-slate-200">2</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-44 bg-slate-900/60 rounded-t-xl flex items-center justify-center border border-slate-800 text-slate-600">
                  2° Lugar
                </div>
              )}
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center">
              {currentCeremony.podiumPlaces.find((p) => p.rank === 1) && revealedStep >= 3 ? (
                <div className="w-full flex flex-col items-center">
                  <div className="mb-3 flex h-28 w-28 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-2xl ring-8 ring-amber-300 animate-pulse">
                    <Crown className="h-14 w-14 text-amber-950" />
                  </div>
                  <span className="rounded-full bg-amber-400 text-slate-950 font-black text-sm px-4 py-1.5 shadow-md">
                    1° LUGAR — ORO
                  </span>
                  <h2 className="text-3xl font-black text-white mt-2 text-center">
                    {currentCeremony.podiumPlaces.find((p) => p.rank === 1)?.gymnastName ||
                      currentCeremony.podiumPlaces.find((p) => p.rank === 1)?.clubName}
                  </h2>
                  <p className="text-base text-amber-200 font-bold">
                    {currentCeremony.podiumPlaces.find((p) => p.rank === 1)?.clubName}
                  </p>
                  {currentCeremony.podiumPlaces.find((p) => p.rank === 1)?.finalScore !== undefined && (
                    <p className="font-mono text-2xl font-black text-amber-400 mt-1">
                      {currentCeremony.podiumPlaces.find((p) => p.rank === 1)?.finalScore?.toFixed(3)}
                    </p>
                  )}
                  <div className="w-full h-60 bg-gradient-to-t from-amber-700 to-amber-500 rounded-t-xl mt-4 flex items-center justify-center border-t-4 border-amber-300 shadow-2xl">
                    <span className="font-black text-7xl text-amber-100">1</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-60 bg-slate-900/60 rounded-t-xl flex items-center justify-center border border-slate-800 text-slate-600">
                  1° Lugar
                </div>
              )}
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center">
              {currentCeremony.podiumPlaces.find((p) => p.rank === 3) && revealedStep >= 1 ? (
                <div className="w-full flex flex-col items-center">
                  <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-amber-700 text-amber-100 shadow-2xl ring-4 ring-amber-600">
                    <Medal className="h-10 w-10" />
                  </div>
                  <span className="rounded-full bg-amber-800 text-amber-100 font-black text-xs px-3 py-1">
                    3° LUGAR — BRONCE
                  </span>
                  <h3 className="text-2xl font-black text-white mt-2 text-center">
                    {currentCeremony.podiumPlaces.find((p) => p.rank === 3)?.gymnastName ||
                      currentCeremony.podiumPlaces.find((p) => p.rank === 3)?.clubName}
                  </h3>
                  <p className="text-sm text-slate-300 font-semibold">
                    {currentCeremony.podiumPlaces.find((p) => p.rank === 3)?.clubName}
                  </p>
                  {currentCeremony.podiumPlaces.find((p) => p.rank === 3)?.finalScore !== undefined && (
                    <p className="font-mono text-xl font-bold text-amber-400 mt-1">
                      {currentCeremony.podiumPlaces.find((p) => p.rank === 3)?.finalScore?.toFixed(3)}
                    </p>
                  )}
                  <div className="w-full h-32 bg-gradient-to-t from-amber-900 to-amber-700 rounded-t-xl mt-4 flex items-center justify-center border-t-2 border-amber-500 shadow-2xl">
                    <span className="font-black text-5xl text-amber-200">3</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-32 bg-slate-900/60 rounded-t-xl flex items-center justify-center border border-slate-800 text-slate-600">
                  3° Lugar
                </div>
              )}
            </div>
          </div>

          {/* Footer Controls in Full Screen */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-400 font-mono">
              Operix Awards • Desarrollado por Comercial Hels SpA
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRevealedStep(1)}
                className={`rounded px-3 py-1.5 text-xs font-bold ${
                  revealedStep === 1 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}
              >
                1. Revelar 3°
              </button>
              <button
                type="button"
                onClick={() => setRevealedStep(2)}
                className={`rounded px-3 py-1.5 text-xs font-bold ${
                  revealedStep === 2 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}
              >
                2. Revelar 2°
              </button>
              <button
                type="button"
                onClick={() => setRevealedStep(3)}
                className={`rounded px-3 py-1.5 text-xs font-bold ${
                  revealedStep === 3 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}
              >
                3. Revelar Campeón (1°)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
