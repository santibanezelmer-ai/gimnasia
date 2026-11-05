/**
 * Competition Schedule, Subdivisions, Olympic Rotations & Live Marshaling.
 * Ciclo Olímpico FIG 2025-2028.
 * 
 * Desarrollado por Comercial Hels SpA para Operix Gymnastics.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  RotateCw,
  Users,
  Megaphone,
  Play,
  Maximize2,
  Minimize2,
  Plus,
  Printer,
  Shuffle,
  CheckCircle2,
  AlertCircle,
  Activity,
} from 'lucide-react'
import type { Championship, CompetitionScheduleItem } from '@/core/types/championship'
import {
  generateOlympicRotationMatrix,
  getAthletesAtApparatusForRotation,
  computeApparatusMarshalingState,
  advanceApparatusAthlete,
  autoAssignRotationGroups,
  type MarshalingAthlete,
} from './rotationEngine'

export const CompetitionScheduleView: React.FC = () => {
  const { user, profile } = useAuth()
  const [championships, setChampionships] = useState<Championship[]>([])
  const [selectedChampId, setSelectedChampId] = useState<string>('')
  const [viewTab, setViewTab] = useState<'marshaling' | 'rotations' | 'timetable' | 'startlist'>('marshaling')

  // Realtime Marshaling State
  const [currentRotation, setCurrentRotation] = useState<number>(1)
  const [selectedSubdivision, setSelectedSubdivision] = useState<string>('Todas')
  const [athletes, setAthletes] = useState<MarshalingAthlete[]>([])
  const [apparatusLiveMap, setApparatusLiveMap] = useState<Record<string, string>>({}) // apparatusCode -> currentRegistrationId
  const [isTvFullscreen, setIsTvFullscreen] = useState(false)

  // Timetable State
  const [scheduleItems, setScheduleItems] = useState<CompetitionScheduleItem[]>([])
  const [isAddingSchedule, setIsAddingSchedule] = useState(false)
  const [newTimeStart, setNewTimeStart] = useState('09:00')
  const [newTimeEnd, setNewTimeEnd] = useState('11:30')
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategoryNames, setNewCategoryNames] = useState('')
  const [newSubdiv, setNewSubdiv] = useState('Subdivisión 1')

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const isOrganizer = profile?.platformRole === 'platform_admin' || user !== null

  // 1. Load active championships
  useEffect(() => {
    async function loadChamps() {
      const { data } = await supabase
        .from('championships')
        .select('*')
        .order('start_date', { ascending: false })

      if (data && data.length > 0) {
        const mapped: Championship[] = data.map((d) => ({
          id: d.id,
          organizationId: d.organization_id,
          name: d.name,
          slug: d.slug,
          description: d.description || undefined,
          startDate: d.start_date,
          endDate: d.end_date,
          location: d.location || undefined,
          venueName: d.venue_name || undefined,
          visibility: d.visibility as Championship['visibility'],
          status: d.status as Championship['status'],
          rulesetVersion: d.ruleset_version,
          scoringSchemaVersion: d.scoring_schema_version,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }))
        setChampionships(mapped)
        setSelectedChampId(mapped[0].id)
      }
    }
    loadChamps()
  }, [])

  // 2. Load athletes & schedule for selected championship
  const loadChampionshipData = useCallback(async (champId: string) => {
    if (!champId) return

    try {
      // Load registrations with gymnast, club, and category
      const { data: regData } = await supabase
        .from('registrations')
        .select(`
          id,
          bib_number,
          rotation_group,
          subdivision,
          starting_apparatus,
          start_order,
          gymnasts (
            id,
            first_name,
            last_name
          ),
          clubs (
            id,
            name
          ),
          categories (
            name,
            discipline
          )
        `)
        .eq('championship_id', champId)
        .eq('status', 'approved')

      if (regData) {
        const mapped: MarshalingAthlete[] = (regData as unknown as Record<string, unknown>[]).map((r, idx) => {
          const gym = r.gymnasts as { id: string; first_name: string; last_name: string } | null
          const club = r.clubs as { id: string; name: string } | null
          const cat = r.categories as { name: string; discipline?: string } | null

          const defaultApps = ['VT', 'UB', 'BB', 'FX']
          const rotGroup = (r.rotation_group as string) || `Grupo ${String.fromCharCode(65 + (idx % 4))}`
          const startApp = (r.starting_apparatus as string) || defaultApps[idx % 4]

          return {
            registrationId: r.id as string,
            gymnastId: gym?.id || (r.id as string),
            gymnastName: gym ? `${gym.first_name} ${gym.last_name}` : 'Gimnasta',
            clubId: club?.id || 'c-default',
            clubName: club?.name || 'Club Participante',
            bibNumber: (r.bib_number as number) || 101 + idx,
            categoryName: cat?.name || 'General',
            subdivision: (r.subdivision as string) || 'Subdivisión 1',
            rotationGroup: rotGroup,
            startingApparatus: startApp,
            startOrder: (r.start_order as number) || (idx % 6) + 1,
          }
        })
        setAthletes(mapped)
      }

      // Load schedule timetable items
      const { data: schedData } = await supabase
        .from('competition_schedules')
        .select('*')
        .eq('championship_id', champId)
        .order('sort_order', { ascending: true })

      if (schedData) {
        const mappedSched: CompetitionScheduleItem[] = schedData.map((s) => ({
          id: s.id,
          championshipId: s.championship_id,
          timeStart: s.time_start,
          timeEnd: s.time_end,
          title: s.title,
          description: s.description || undefined,
          categoryNames: s.category_names || undefined,
          subdivision: s.subdivision || undefined,
          sortOrder: s.sort_order,
        }))
        setScheduleItems(mappedSched)
      }

      // Load live apparatus status
      const { data: liveData } = await supabase
        .from('apparatus_live_status')
        .select('*')
        .eq('championship_id', champId)

      if (liveData && liveData.length > 0) {
        const liveMap: Record<string, string> = {}
        liveData.forEach((row) => {
          if (row.current_registration_id) {
            liveMap[row.apparatus_code] = row.current_registration_id
          }
          if (row.current_rotation) {
            setCurrentRotation(row.current_rotation)
          }
        })
        setApparatusLiveMap(liveMap)
      }
    } catch (err: unknown) {
      console.error('Error loading schedule:', err)
    }
  }, [])

  useEffect(() => {
    if (selectedChampId) {
      loadChampionshipData(selectedChampId)
    }
  }, [selectedChampId, loadChampionshipData])

  // 3. Listen to Supabase Realtime updates on live calls
  useEffect(() => {
    if (!selectedChampId) return

    const channel = supabase
      .channel(`live-marshaling-${selectedChampId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'apparatus_live_status',
          filter: `championship_id=eq.${selectedChampId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const row = payload.new as { apparatus_code: string; current_registration_id: string; current_rotation: number }
            setApparatusLiveMap((prev) => ({
              ...prev,
              [row.apparatus_code]: row.current_registration_id,
            }))
            if (row.current_rotation) {
              setCurrentRotation(row.current_rotation)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedChampId])

  // Current championship object
  const currentChamp = championships.find((c) => c.id === selectedChampId)

  // Active discipline apparatuses
  const apparatusCodes = useMemo(() => {
    return ['VT', 'UB', 'BB', 'FX']
  }, [])

  const apparatusNames: Record<string, string> = {
    VT: 'Salto de Caballo / Salto',
    UB: 'Barras Asimétricas',
    BB: 'Viga de Equilibrio',
    FX: 'Suelo / Manos Libres',
    PH: 'Caballo con Arzones',
    SR: 'Anillas',
    PB: 'Barras Paralelas',
    HB: 'Barra Fija',
  }

  // Filtered athletes by subdivision
  const filteredAthletes = useMemo(() => {
    if (selectedSubdivision === 'Todas') return athletes
    return athletes.filter((a) => a.subdivision === selectedSubdivision)
  }, [athletes, selectedSubdivision])

  // Unique subdivisions
  const subdivisionsList = useMemo(() => {
    const set = new Set(athletes.map((a) => a.subdivision).filter(Boolean))
    return ['Todas', ...Array.from(set)] as string[]
  }, [athletes])

  // Distinct groups
  const groupNames = useMemo(() => {
    const set = new Set(filteredAthletes.map((a) => a.rotationGroup).filter(Boolean))
    const list = Array.from(set)
    return list.length > 0 ? list : ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D']
  }, [filteredAthletes])

  // Olympic Rotation Matrix for the groups
  const rotationMatrix = useMemo(() => {
    return generateOlympicRotationMatrix(groupNames, apparatusCodes)
  }, [groupNames, apparatusCodes])

  // Advance athlete on an apparatus
  const handleAdvanceAthlete = async (appCode: string) => {
    const athletesAtApp = getAthletesAtApparatusForRotation(filteredAthletes, apparatusCodes, appCode, currentRotation)
    const currentRegId = apparatusLiveMap[appCode]
    const nextRegId = advanceApparatusAthlete(athletesAtApp, currentRegId)

    // Update local state immediately for snappy response
    setApparatusLiveMap((prev) => ({
      ...prev,
      [appCode]: nextRegId || '',
    }))

    // Persist to Supabase and broadcast
    try {
      await supabase.from('apparatus_live_status').upsert(
        {
          championship_id: selectedChampId,
          apparatus_code: appCode,
          apparatus_name: apparatusNames[appCode] || appCode,
          current_rotation: currentRotation,
          current_registration_id: nextRegId || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'championship_id,apparatus_code' }
      )
    } catch (err: unknown) {
      console.error('Failed to sync live status:', err)
    }
  }

  // Auto assign rotation groups
  const handleAutoAssign = async () => {
    if (athletes.length === 0) {
      setNotification({ type: 'error', message: 'No hay atletas inscritos en este campeonato.' })
      return
    }

    const assigned = autoAssignRotationGroups(
      athletes.map((a) => ({
        registrationId: a.registrationId,
        gymnastId: a.gymnastId,
        gymnastName: a.gymnastName,
        clubId: a.clubId,
        clubName: a.clubName,
        categoryName: a.categoryName,
      })),
      apparatusCodes,
      'Grupo',
      selectedSubdivision === 'Todas' ? 'Subdivisión 1' : selectedSubdivision
    )

    setAthletes(assigned)

    // Save to database
    try {
      for (const ath of assigned) {
        await supabase
          .from('registrations')
          .update({
            rotation_group: ath.rotationGroup,
            starting_apparatus: ath.startingApparatus,
            start_order: ath.startOrder,
            bib_number: ath.bibNumber,
            subdivision: ath.subdivision,
          })
          .eq('id', ath.registrationId)
      }
      setNotification({
        type: 'success',
        message: '¡Rotaciones olímpicas y dorsales asignados con balanceo de clubes con éxito!',
      })
    } catch (err: unknown) {
      setNotification({ type: 'error', message: (err as Error).message })
    }
  }

  // Create schedule item
  const handleCreateScheduleItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChampId || !newTitle.trim()) return

    try {
      const { data, error } = await supabase.from('competition_schedules').insert({
        championship_id: selectedChampId,
        time_start: newTimeStart,
        time_end: newTimeEnd,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        category_names: newCategoryNames.trim() || null,
        subdivision: newSubdiv.trim() || null,
        sort_order: scheduleItems.length + 1,
      }).select().single()

      if (error) throw error

      if (data) {
        setScheduleItems((prev) => [
          ...prev,
          {
            id: data.id,
            championshipId: data.championship_id,
            timeStart: data.time_start,
            timeEnd: data.time_end,
            title: data.title,
            description: data.description || undefined,
            categoryNames: data.category_names || undefined,
            subdivision: data.subdivision || undefined,
            sortOrder: data.sort_order,
          },
        ])
      }

      setIsAddingSchedule(false)
      setNewTitle('')
      setNewDescription('')
      setNewCategoryNames('')
      setNotification({ type: 'success', message: '¡Bloque horario agregado al cronograma oficial!' })
    } catch (err: unknown) {
      setNotification({ type: 'error', message: (err as Error).message })
    }
  }

  return (
    <div className={`space-y-6 ${isTvFullscreen ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-6 text-white' : ''}`}>
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <Megaphone className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900">
                Cronograma de Competencia & Llamado a Pista
              </h2>
              {currentChamp && (
                <span className="hidden sm:inline-block text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg truncate max-w-[200px]">
                  {currentChamp.name}
                </span>
              )}
              <Badge variant="default" className="text-[10px] font-bold bg-blue-700">
                Normativa FIG 2025-2028
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Gestión de rotaciones olímpicas, subdivisión, orden de paso y pantalla de llamado para megafonía y calentamiento.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Championship Selector */}
          <select
            value={selectedChampId}
            onChange={(e) => setSelectedChampId(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-2xs focus:border-blue-600 focus:outline-none"
          >
            {championships.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.status === 'in_progress' ? 'En Vivo' : c.status})
              </option>
            ))}
          </select>

          {/* Fullscreen TV Kiosk Toggle */}
          <button
            type="button"
            onClick={() => setIsTvFullscreen(!isTvFullscreen)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-2xs ${
              isTvFullscreen
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isTvFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span>{isTvFullscreen ? 'Salir de Modo TV' : 'Modo Pantalla TV'}</span>
          </button>
        </div>
      </div>

      {notification && (
        <div
          className={`flex items-center justify-between rounded-xl p-3 text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP VIEW TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
        <div className="inline-flex rounded-xl p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setViewTab('marshaling')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 font-bold transition-all ${
              viewTab === 'marshaling' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Megaphone className="h-4 w-4" />
            <span>Llamado a Pista en Vivo</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab('rotations')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 font-bold transition-all ${
              viewTab === 'rotations' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCw className="h-4 w-4" />
            <span>Matriz de Rotaciones</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab('startlist')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 font-bold transition-all ${
              viewTab === 'startlist' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Orden de Paso & Dorsales</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab('timetable')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 font-bold transition-all ${
              viewTab === 'timetable' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Horarios Oficiales</span>
          </button>
        </div>

        {/* Rotation Selector Pills */}
        <div className="flex items-center gap-2 self-start sm:self-auto px-2">
          <span className="text-[11px] font-bold text-slate-500">Rotación Activa:</span>
          {[1, 2, 3, 4].map((rot) => (
            <button
              key={rot}
              type="button"
              onClick={() => setCurrentRotation(rot)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black transition-all ${
                currentRotation === rot
                  ? 'bg-blue-700 text-white shadow-sm ring-2 ring-blue-400'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {rot}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: PANTALLA DE LLAMADO A PISTA EN VIVO (MARSHALING CALL SCREEN)
         ========================================================================= */}
      {viewTab === 'marshaling' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Pista de Competición — Rotación {currentRotation} de {apparatusCodes.length}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pantalla para jueces de aparato, megafonía y zonas de calentamiento. Sincronizada en Realtime.
              </p>
            </div>

            {/* Subdivision Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Subdivisión:</span>
              <select
                value={selectedSubdivision}
                onChange={(e) => setSelectedSubdivision(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-800"
              >
                {subdivisionsList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4 Quadrants for Apparatuses (VT, UB, BB, FX) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {apparatusCodes.map((appCode) => {
              const athletesAtApp = getAthletesAtApparatusForRotation(
                filteredAthletes,
                apparatusCodes,
                appCode,
                currentRotation
              )
              const marshaling = computeApparatusMarshalingState(
                athletesAtApp,
                appCode,
                apparatusNames[appCode] || appCode,
                currentRotation,
                apparatusLiveMap[appCode]
              )

              return (
                <Card
                  key={appCode}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between"
                >
                  {/* Apparatus Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-700 text-xs font-black text-white font-mono">
                        {appCode}
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">
                          {apparatusNames[appCode] || appCode}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          Rotación {currentRotation} • {athletesAtApp.length} atletas en turno
                        </span>
                      </div>
                    </div>

                    {/* Button to advance to next athlete */}
                    {isOrganizer && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceAthlete(appCode)}
                        disabled={!marshaling.nextAthlete && !marshaling.currentAthlete}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Siguiente Atleta</span>
                      </button>
                    )}
                  </div>

                  {/* Body: Current, On Deck, and Waiting */}
                  <div className="p-5 space-y-4">
                    {/* CURRENT ATHLETE IN ARENA */}
                    <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 p-4 relative overflow-hidden">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                          <Activity className="h-3 w-3 animate-pulse" />
                          En Pista / Compitiendo
                        </span>
                        {marshaling.currentAthlete && (
                          <span className="font-mono text-xs font-black text-emerald-900">
                            Dorsal #{marshaling.currentAthlete.bibNumber}
                          </span>
                        )}
                      </div>

                      {marshaling.currentAthlete ? (
                        <div>
                          <h5 className="text-xl font-black text-slate-900 tracking-tight">
                            {marshaling.currentAthlete.gymnastName}
                          </h5>
                          <p className="text-xs font-bold text-emerald-900 mt-0.5">
                            {marshaling.currentAthlete.clubName} • {marshaling.currentAthlete.categoryName}
                          </p>
                          <div className="mt-2 text-[10px] text-slate-500 font-medium">
                            Grupo: <strong>{marshaling.currentAthlete.rotationGroup}</strong> | Orden de paso: #{marshaling.currentAthlete.startOrder}
                          </div>
                        </div>
                      ) : (
                        <div className="py-2 text-center text-xs font-semibold text-slate-400">
                          Rotación finalizada o sin atletas en este aparato.
                        </div>
                      )}
                    </div>

                    {/* NEXT ATHLETE (ON DECK / EN PREPARACIÓN) */}
                    <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          En Preparación / On Deck
                        </span>
                        {marshaling.nextAthlete && (
                          <span className="font-mono text-[11px] font-bold text-amber-900">
                            #{marshaling.nextAthlete.bibNumber}
                          </span>
                        )}
                      </div>

                      {marshaling.nextAthlete ? (
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {marshaling.nextAthlete.gymnastName}
                          </p>
                          <p className="text-xs text-amber-900">
                            {marshaling.nextAthlete.clubName} • {marshaling.nextAthlete.categoryName}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No hay siguiente gimnasta.</p>
                      )}
                    </div>

                    {/* WAITING QUEUE */}
                    {marshaling.waitingAthletes.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          A continuación en esta rotación ({marshaling.waitingAthletes.length})
                        </p>
                        <div className="space-y-1">
                          {marshaling.waitingAthletes.slice(0, 3).map((ath) => (
                            <div
                              key={ath.registrationId}
                              className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600 border border-slate-100"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-slate-400 font-bold">#{ath.startOrder}</span>
                                <span className="font-semibold text-slate-800">{ath.gymnastName}</span>
                              </div>
                              <span className="text-[11px] text-slate-500">{ath.clubName}</span>
                            </div>
                          ))}
                          {marshaling.waitingAthletes.length > 3 && (
                            <p className="text-[10px] text-slate-400 text-center">
                              +{marshaling.waitingAthletes.length - 3} atletas más en espera
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: MATRIZ DE ROTACIONES OLÍMPICAS (FIG ROTATION CYCLE)
         ========================================================================= */}
      {viewTab === 'rotations' && (
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <RotateCw className="h-5 w-5 text-blue-600" />
                Matriz Oficial de Rotación Olímpica
              </h3>
              <p className="text-xs text-slate-500">
                Ciclo olímpico estandarizado FIG: cada grupo avanza secuencialmente por todos los aparatos sin cruzarse.
              </p>
            </div>

            {isOrganizer && (
              <button
                type="button"
                onClick={handleAutoAssign}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition-colors"
              >
                <Shuffle className="h-3.5 w-3.5" />
                <span>Sortear & Balancear Clubes</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3 px-4">Grupo de Rotación</th>
                  <th className="py-3 px-4 text-center">Rotación 1</th>
                  <th className="py-3 px-4 text-center">Rotación 2</th>
                  <th className="py-3 px-4 text-center">Rotación 3</th>
                  <th className="py-3 px-4 text-center">Rotación 4</th>
                  <th className="py-3 px-4 text-right">Gimnastas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {rotationMatrix.map((item) => {
                  const count = filteredAthletes.filter((a) => a.rotationGroup === item.groupName).length

                  return (
                    <tr key={item.groupName} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {item.groupName}
                      </td>
                      {item.rotations.map((r) => {
                        const isCurrent = currentRotation === r.rotationNumber
                        return (
                          <td key={r.rotationNumber} className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono font-bold text-xs ${
                                isCurrent
                                  ? 'bg-blue-700 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {r.apparatusCode} — {apparatusNames[r.apparatusCode]?.split(' ')[0] || r.apparatusCode}
                            </span>
                          </td>
                        )
                      })}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                        {count} atletas
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* =========================================================================
          VIEW 3: ORDEN DE PASO & DORSALES (START LIST)
         ========================================================================= */}
      {viewTab === 'startlist' && (
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Planilla Oficial de Orden de Paso (Start List)
              </h3>
              <p className="text-xs text-slate-500">
                Listado de deportistas con dorsal oficial, grupo asignado y orden de salida en cada aparato.
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir Orden de Paso</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3 px-4">Dorsal</th>
                  <th className="py-3 px-4">Gimnasta</th>
                  <th className="py-3 px-4">Club</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Subdivisión</th>
                  <th className="py-3 px-4">Grupo</th>
                  <th className="py-3 px-4 text-center">Aparato Inicial</th>
                  <th className="py-3 px-4 text-center">Orden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAthletes.map((ath) => (
                  <tr key={ath.registrationId} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-black text-blue-900">
                      #{ath.bibNumber}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {ath.gymnastName}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {ath.clubName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {ath.categoryName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {ath.subdivision}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {ath.rotationGroup}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-bold text-blue-700">
                        {ath.startingApparatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                      #{ath.startOrder}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* =========================================================================
          VIEW 4: CRONOGRAMA & HORARIOS OFICIALES (TIMETABLE)
         ========================================================================= */}
      {viewTab === 'timetable' && (
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Programa Horario del Campeonato
              </h3>
              <p className="text-xs text-slate-500">
                Horario oficial de desfile, calentamientos generales, turnos de competición y ceremonias de premiación.
              </p>
            </div>

            {isOrganizer && (
              <button
                type="button"
                onClick={() => setIsAddingSchedule(!isAddingSchedule)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Agregar Bloque Horario</span>
              </button>
            )}
          </div>

          {isAddingSchedule && (
            <form onSubmit={handleCreateScheduleItem} className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Nuevo Bloque Horario</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Hora Inicio</label>
                  <input
                    type="time"
                    value={newTimeStart}
                    onChange={(e) => setNewTimeStart(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Hora Término</label>
                  <input
                    type="time"
                    value={newTimeEnd}
                    onChange={(e) => setNewTimeEnd(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Título de la Actividad</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="ej. Subdivisión 1: Niveles 3 y 4 GAF"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Categorías / Grupos</label>
                  <input
                    type="text"
                    value={newCategoryNames}
                    onChange={(e) => setNewCategoryNames(e.target.value)}
                    placeholder="ej. Nivel 3 (Infantil A y B)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Subdivisión / Turno</label>
                  <input
                    type="text"
                    value={newSubdiv}
                    onChange={(e) => setNewSubdiv(e.target.value)}
                    placeholder="ej. Subdivisión 1"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Detalles / Indicaciones</label>
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="ej. Calentamiento en sala previa 30 min antes"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingSchedule(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-800"
                >
                  Guardar Bloque
                </button>
              </div>
            </form>
          )}

          {scheduleItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400 space-y-2">
              <Calendar className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-xs">No hay bloques horarios cargados para este campeonato.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduleItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center rounded-xl bg-slate-100 px-3 py-2 text-center min-w-[90px] border border-slate-200">
                      <span className="font-mono text-xs font-black text-blue-900">{item.timeStart}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">a</span>
                      <span className="font-mono text-xs font-bold text-slate-600">{item.timeEnd}</span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      {item.categoryNames && (
                        <p className="text-xs font-semibold text-blue-700 mt-0.5">
                          {item.categoryNames}
                        </p>
                      )}
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {item.subdivision && (
                    <Badge variant="outline" className="self-start sm:self-auto text-xs font-bold">
                      {item.subdivision}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
