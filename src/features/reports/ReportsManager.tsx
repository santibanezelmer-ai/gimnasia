/**
 * Operix Reports — Official Championship Documentation & Result Books.
 * Ciclo Olímpico FIG 2025-2028.
 * 
 * Desarrollado por Comercial Hels SpA para Operix Gymnastics.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/features/auth/AuthContext'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen,
  Printer,
  FileSpreadsheet,
  Award,
  Medal,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
  History,
  Layers,
  Settings2,
  Trophy,
  Users,
} from 'lucide-react'
import type { Championship, Category } from '@/core/types/championship'
import type {
  ReportDocumentType,
  ChampionshipDocumentRecord,
  DiplomaTemplateConfig,
  DiplomaAwardType,
} from '@/core/types/reports'
import {
  computeAllAroundStandings,
  computeApparatusStandings,
  computeTeamStandings,
  type GymnastScoreEntry,
} from '@/features/standings/standingsEngine'
import {
  filterApprovedScores,
  computeClubMedalTally,
  generateDiplomaAwardItems,
  exportAllAroundToCsv,
  exportApparatusToCsv,
  compileOfficialMinutes,
} from './reportsEngine'
import type { MarshalingAthlete } from '@/features/schedule/rotationEngine'

export const ReportsManager: React.FC = () => {
  const { user, profile } = useAuth()
  const [championships, setChampionships] = useState<Championship[]>([])
  const [selectedChampId, setSelectedChampId] = useState<string>('')
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')

  // Document Type Selection
  const [documentType, setDocumentType] = useState<ReportDocumentType>('result_book')
  const [allowProvisional, setAllowProvisional] = useState(false)

  // Data
  const [rawScores, setRawScores] = useState<GymnastScoreEntry[]>([])
  const [athletes, setAthletes] = useState<MarshalingAthlete[]>([])
  const [generatedHistory, setGeneratedHistory] = useState<ChampionshipDocumentRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Diploma Template Configuration
  const [diplomaConfig, setDiplomaConfig] = useState<DiplomaTemplateConfig>({
    institutionTitle: 'Federación Nacional de Gimnasia & Comité Organizador',
    tournamentSubtitle: 'Por su destacada participación en el Campeonato Oficial',
    tournamentDate: 'Noviembre 2026',
    tournamentLocation: 'Santiago, Chile',
    directorName: 'Director de Torneo',
    directorTitle: 'Comisión Técnica Operix',
    headJudgeName: 'Juez Árbitro General FIG',
    headJudgeTitle: 'Panel Superior de Arbitraje',
    accentColor: 'gold',
  })
  const [diplomaFilter, setDiplomaFilter] = useState<'all' | DiplomaAwardType>('all')
  const [showDiplomaCustomizer, setShowDiplomaCustomizer] = useState(false)

  // 1. Load championships
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

  // 2. Load championship categories, scores, and athletes
  const loadChampionshipData = useCallback(async (champId: string) => {
    if (!champId) return

    try {
      // Categories
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('championship_id', champId)
        .order('sort_order', { ascending: true })

      if (catData) {
        const mappedCats: Category[] = catData.map((c) => ({
          id: c.id,
          championshipId: c.championship_id,
          discipline: c.discipline as Category['discipline'],
          name: c.name,
          code: c.code,
          gender: c.gender as Category['gender'],
          scoringRegime: c.scoring_regime as Category['scoringRegime'],
          defaultFixedDScore: c.default_fixed_d_score || undefined,
          sortOrder: c.sort_order,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }))
        setCategories(mappedCats)
      }

      // Scores
      const { data: scoresData } = await supabase
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
              first_name,
              last_name
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
        .eq('championship_id', champId)

      if (scoresData) {
        const mappedScores: GymnastScoreEntry[] = (scoresData as unknown as Record<string, unknown>[]).map((row) => {
          const app = row.apparatuses as { code: string; name: string } | null
          const reg = row.registrations as {
            gymnast_id: string
            category_id?: string
            gymnasts: { first_name: string; last_name: string } | null
            clubs: { id: string; name: string } | null
            categories: { id: string; name: string; scoring_regime?: string } | null
          } | null

          const cat = reg?.categories
          const gym = reg?.gymnasts
          const club = reg?.clubs

          return {
            gymnastId: reg?.gymnast_id || (row.id as string),
            gymnastName: gym ? `${gym.first_name} ${gym.last_name}` : 'Gimnasta',
            clubId: club?.id || 'c-default',
            clubName: club?.name || 'Club Participante',
            categoryId: cat?.id || reg?.category_id || 'general',
            categoryName: cat?.name || 'General',
            scoringRegime: (cat?.scoring_regime === 'obligatory' ? 'obligatory' : 'free') as 'free' | 'obligatory',
            apparatusCode: app?.code || 'VT',
            attemptNumber: row.attempt_number ? Number(row.attempt_number) : 1,
            dScore: Number(row.d_score),
            eScoreAvg: Number(row.e_score_avg),
            finalScore: Number(row.final_score),
            status: row.status as GymnastScoreEntry['status'],
          }
        })
        setRawScores(mappedScores)
      }

      // Athletes (for rosters and diplomas)
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
            name
          )
        `)
        .eq('championship_id', champId)
        .eq('status', 'approved')

      if (regData) {
        const mappedAthletes: MarshalingAthlete[] = (regData as unknown as Record<string, unknown>[]).map((r, idx) => {
          const gym = r.gymnasts as { id: string; first_name: string; last_name: string } | null
          const club = r.clubs as { id: string; name: string } | null
          const cat = r.categories as { name: string } | null

          return {
            registrationId: r.id as string,
            gymnastId: gym?.id || (r.id as string),
            gymnastName: gym ? `${gym.first_name} ${gym.last_name}` : 'Gimnasta',
            clubId: club?.id || 'c-default',
            clubName: club?.name || 'Club Participante',
            bibNumber: (r.bib_number as number) || 101 + idx,
            categoryName: cat?.name || 'General',
            subdivision: (r.subdivision as string) || 'Subdivisión 1',
            rotationGroup: (r.rotation_group as string) || 'Grupo A',
            startingApparatus: (r.starting_apparatus as string) || 'VT',
            startOrder: (r.start_order as number) || idx + 1,
          }
        })
        setAthletes(mappedAthletes)
      }

      // Generated Documents History
      const { data: docData } = await supabase
        .from('championship_documents')
        .select('*')
        .eq('championship_id', champId)
        .order('created_at', { ascending: false })

      if (docData) {
        const mappedDocs: ChampionshipDocumentRecord[] = docData.map((d) => ({
          id: d.id,
          championshipId: d.championship_id,
          documentType: d.document_type as ReportDocumentType,
          title: d.title,
          fileFormat: d.file_format as ChampionshipDocumentRecord['fileFormat'],
          filters: (d.filters as Record<string, unknown>) || {},
          metadata: (d.metadata as Record<string, unknown>) || {},
          generatedByUserId: d.generated_by_user_id || undefined,
          createdAt: d.created_at,
        }))
        setGeneratedHistory(mappedDocs)
      }
    } catch (err: unknown) {
      console.error('Error loading report data:', err)
    }
  }, [])

  useEffect(() => {
    if (selectedChampId) {
      loadChampionshipData(selectedChampId)
    }
  }, [selectedChampId, loadChampionshipData])

  const currentChamp = championships.find((c) => c.id === selectedChampId)

  // 3. Computed Official Results according to Integrity Rules
  const validScores = useMemo(() => {
    return filterApprovedScores(rawScores, allowProvisional)
  }, [rawScores, allowProvisional])

  const categoryFilter = selectedCategoryId === 'all' ? undefined : selectedCategoryId

  const allAroundStandings = useMemo(() => {
    return computeAllAroundStandings(validScores, { categoryId: categoryFilter })
  }, [validScores, categoryFilter])

  const apparatusCodes = useMemo(() => {
    const list = Array.from(new Set(validScores.map((s) => s.apparatusCode))).filter(Boolean)
    return list.length > 0 ? list : ['VT', 'UB', 'BB', 'FX']
  }, [validScores])

  const apparatusNames: Record<string, string> = {
    VT: 'Salto de Caballo / Salto',
    UB: 'Barras Asimétricas',
    BB: 'Viga de Equilibrio',
    FX: 'Suelo / Manos Libres',
    PH: 'Caballo con Arzones',
    SR: 'Anillas',
    PB: 'Barras Paralelas',
    HB: 'Barra Fija',
    HOOP: 'Aro',
    BALL: 'Pelota',
    CLUBS: 'Mazas',
    RIBBON: 'Cinta',
    FREE: 'Manos Libres',
    TRA: 'Trampolín Individual',
    DMT: 'Doble Minitramp',
    SPD: 'Parkour Velocidad',
    FR: 'Parkour Estilo Libre',
  }

  const apparatusStandingsList = useMemo(() => {
    return apparatusCodes.map((code) => ({
      apparatusCode: code,
      apparatusName: apparatusNames[code] || code,
      standings: computeApparatusStandings(validScores, code, categoryFilter),
    }))
  }, [validScores, apparatusCodes, categoryFilter])

  const teamStandings = useMemo(() => {
    return computeTeamStandings(validScores)
  }, [validScores])

  // Official Club Medal Tally
  const clubMedals = useMemo(() => {
    return computeClubMedalTally(
      allAroundStandings,
      apparatusStandingsList.map((a) => a.standings)
    )
  }, [allAroundStandings, apparatusStandingsList])

  // Diplomas List
  const diplomaAwards = useMemo(() => {
    const items = generateDiplomaAwardItems({
      allAroundStandings,
      apparatusStandingsList,
      teamStandings,
      allAthletes: athletes,
      includeParticipation: true,
      includePodiums: true,
    })

    if (diplomaFilter === 'all') return items
    return items.filter((d) => d.awardType === diplomaFilter)
  }, [allAroundStandings, apparatusStandingsList, teamStandings, athletes, diplomaFilter])

  // Official Minutes Data
  const officialMinutes = useMemo(() => {
    if (!currentChamp) return null
    const uniqueClubsCount = new Set(athletes.map((a) => a.clubId)).size
    return compileOfficialMinutes(currentChamp, {
      totalGymnasts: athletes.length,
      totalClubs: uniqueClubsCount,
      totalScores: validScores.length,
      inquiriesCount: 0,
      inquiriesResolvedCount: 0,
    })
  }, [currentChamp, athletes, validScores])

  // 4. ACTION: Native Print Trigger
  const handlePrint = () => {
    window.print()
  }

  // 5. ACTION: CSV / Excel Export
  const handleExportCsv = () => {
    if (allAroundStandings.length === 0) {
      setNotification({ type: 'error', message: 'No hay puntuaciones aprobadas para exportar.' })
      return
    }

    let csvContent = ''
    let fileName = ''

    if (documentType === 'result_book' || documentType === 'category_results') {
      const aaCsv = exportAllAroundToCsv(allAroundStandings, apparatusCodes)
      const appChunks = apparatusStandingsList.map((app) =>
        exportApparatusToCsv(app.standings, app.apparatusCode, app.apparatusName)
      )
      csvContent = [aaCsv, ...appChunks].join('\r\n\r\n')
      fileName = `Resultados_Oficiales_${currentChamp?.slug || 'torneo'}.csv`
    } else if (documentType === 'start_list') {
      const headers = ['Dorsal', 'Gimnasta', 'Club', 'Categoría', 'Subdivisión', 'Grupo', 'Aparato Inicial', 'Orden']
      const rows = athletes.map((a) => [
        a.bibNumber,
        `"${a.gymnastName.replace(/"/g, '""')}"`,
        `"${a.clubName.replace(/"/g, '""')}"`,
        `"${(a.categoryName || 'General').replace(/"/g, '""')}"`,
        `"${(a.subdivision || '').replace(/"/g, '""')}"`,
        `"${(a.rotationGroup || '').replace(/"/g, '""')}"`,
        a.startingApparatus,
        a.startOrder,
      ])
      csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n')
      fileName = `StartList_${currentChamp?.slug || 'torneo'}.csv`
    } else {
      csvContent = exportAllAroundToCsv(allAroundStandings, apparatusCodes)
      fileName = `Documento_${documentType}_${currentChamp?.slug || 'torneo'}.csv`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setNotification({ type: 'success', message: `¡Archivo ${fileName} exportado con formato compatible para Microsoft Excel!` })
  }

  // 6. ACTION: Log Generated Document into Database History
  const handleLogDocument = async () => {
    if (!selectedChampId) return

    try {
      const titleMap: Record<ReportDocumentType, string> = {
        result_book: `Libro Oficial de Resultados (Result Book) — ${currentChamp?.name}`,
        category_results: `Resultados Oficiales por Categoría — ${selectedCategoryId === 'all' ? 'Todas' : selectedCategoryId}`,
        official_minutes: `Acta de Cierre de Competencia y Arbitraje — ${currentChamp?.name}`,
        diplomas_batch: `Lote de Diplomas de Premiación (${diplomaAwards.length} certificados)`,
        start_list: `Orden de Paso & Planilla de Partida (Start List)`,
        judging_sheets: `Planillas Técnicas para Mesa de Jurados`,
      }

      const { data, error } = await supabase.from('championship_documents').insert({
        championship_id: selectedChampId,
        document_type: documentType,
        title: titleMap[documentType] || 'Documento Oficial',
        file_format: 'pdf',
        filters: {
          category_id: selectedCategoryId,
          allow_provisional: allowProvisional,
          diploma_filter: diplomaFilter,
        },
        metadata: {
          total_scores: validScores.length,
          total_gymnasts: athletes.length,
          generated_by: profile?.fullName || user?.email || 'Secretaría Técnica',
          version: 'FIG_2025_2028',
        },
        generated_by_user_id: user?.id || null,
      }).select().single()

      if (error) throw error

      if (data) {
        setGeneratedHistory((prev) => [
          {
            id: data.id,
            championshipId: data.championship_id,
            documentType: data.document_type as ReportDocumentType,
            title: data.title,
            fileFormat: data.file_format as ChampionshipDocumentRecord['fileFormat'],
            filters: (data.filters as Record<string, unknown>) || {},
            metadata: (data.metadata as Record<string, unknown>) || {},
            generatedByUserId: data.generated_by_user_id || undefined,
            createdAt: data.created_at,
          },
          ...prev,
        ])
      }

      setNotification({
        type: 'success',
        message: '¡Documento registrado en el historial inmutable de la plataforma con sello de auditoría!',
      })
    } catch (err: unknown) {
      setNotification({ type: 'error', message: (err as Error).message })
    }
  }

  return (
    <div className="space-y-6">
      {/* ----------------- TOP CONTROLS (NO PRINT) ----------------- */}
      <div className="no-print space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-800 text-white shadow-sm">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-slate-900">
                  Operix Reports — Documentación Oficial & Result Book
                </h2>
                <Badge variant="default" className="text-[10px] font-bold bg-slate-900 text-white">
                  FIG 2025-2028
                </Badge>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Generación y certificación de libros de resultados, actas oficiales, diplomas en lote y planillas de secretaría técnica.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition-colors"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir / Guardar PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar Excel (.csv)</span>
            </button>

            <button
              type="button"
              onClick={handleLogDocument}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <History className="h-3.5 w-3.5 text-slate-500" />
              <span>Registrar en Historial</span>
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

        {/* SELECTORS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 bg-slate-100/80 p-3 rounded-2xl border border-slate-200 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Campeonato</label>
            <select
              value={selectedChampId}
              onChange={(e) => setSelectedChampId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              {championships.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Filtrar por Categoría</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">Todas las Categorías (Completo)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.discipline})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Régimen de Validez</label>
            <div className="flex items-center gap-2 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowProvisional}
                  onChange={(e) => setAllowProvisional(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Incluir Provisionales (Borrador)</span>
              </label>
            </div>
          </div>

          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1.5 py-1.5"
            >
              <History className="h-4 w-4" />
              <span>Historial ({generatedHistory.length})</span>
            </button>
          </div>
        </div>

        {/* DOCUMENT TYPE TABS */}
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { id: 'result_book', label: 'Libro de Resultados (Result Book)', icon: BookOpen },
            { id: 'category_results', label: 'Resultados por Categoría', icon: Layers },
            { id: 'official_minutes', label: 'Actas Oficiales & Cierre', icon: FileText },
            { id: 'diplomas_batch', label: 'Diplomas en Lote', icon: Award },
            { id: 'start_list', label: 'Start List & Orden de Paso', icon: Users },
            { id: 'judging_sheets', label: 'Planillas para Jurados', icon: FileSpreadsheet },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = documentType === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDocumentType(tab.id as ReportDocumentType)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* DIPLOMA CUSTOMIZER PANEL (WHEN DIPLOMA TAB IS ACTIVE) */}
        {documentType === 'diplomas_batch' && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <span>Personalizador de Diplomas Oficiales ({diplomaAwards.length} listos para imprimir)</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={diplomaFilter}
                  onChange={(e) => setDiplomaFilter(e.target.value as 'all' | DiplomaAwardType)}
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-900"
                >
                  <option value="all">Todos los Diplomas</option>
                  <option value="gold">Solo 1° Lugares (Oro)</option>
                  <option value="silver">Solo 2° Lugares (Plata)</option>
                  <option value="bronze">Solo 3° Lugares (Bronce)</option>
                  <option value="participation">Solo Participación</option>
                  <option value="team_champion">Solo Premiación Equipos</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowDiplomaCustomizer(!showDiplomaCustomizer)}
                  className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100/50 flex items-center gap-1"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>{showDiplomaCustomizer ? 'Ocultar Config' : 'Editar Firmas & Textos'}</span>
                </button>
              </div>
            </div>

            {showDiplomaCustomizer && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs border-t border-amber-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Institución / Federación</label>
                  <input
                    type="text"
                    value={diplomaConfig.institutionTitle}
                    onChange={(e) => setDiplomaConfig({ ...diplomaConfig, institutionTitle: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Director del Torneo (Firma)</label>
                  <input
                    type="text"
                    value={diplomaConfig.directorName}
                    onChange={(e) => setDiplomaConfig({ ...diplomaConfig, directorName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Juez Árbitro General (Firma)</label>
                  <input
                    type="text"
                    value={diplomaConfig.headJudgeName}
                    onChange={(e) => setDiplomaConfig({ ...diplomaConfig, headJudgeName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Lugar y Fecha</label>
                  <input
                    type="text"
                    value={`${diplomaConfig.tournamentLocation} • ${diplomaConfig.tournamentDate}`}
                    onChange={(e) => {
                      const [loc, date] = e.target.value.split('•')
                      setDiplomaConfig({
                        ...diplomaConfig,
                        tournamentLocation: loc ? loc.trim() : diplomaConfig.tournamentLocation,
                        tournamentDate: date ? date.trim() : diplomaConfig.tournamentDate,
                      })
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* AUDIT LOG HISTORY TABLE (COLLAPSIBLE) */}
        {showHistory && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <History className="h-4 w-4 text-blue-600" />
              <span>Historial de Documentos Generados & Certificados</span>
            </h4>
            {generatedHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay registros históricos previos en este torneo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-2 px-3">Fecha</th>
                      <th className="py-2 px-3">Tipo</th>
                      <th className="py-2 px-3">Título</th>
                      <th className="py-2 px-3">Formato</th>
                      <th className="py-2 px-3">Responsable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {generatedHistory.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-500">
                          {new Date(doc.createdAt).toLocaleString('es-CL')}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-800 uppercase text-[10px]">
                          {doc.documentType}
                        </td>
                        <td className="py-2 px-3 text-slate-900 font-medium">{doc.title}</td>
                        <td className="py-2 px-3 font-mono text-[10px] uppercase text-blue-700">
                          {doc.fileFormat}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {String(doc.metadata?.generated_by || 'Operix')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ----------------- OFFICIAL PRINT-READY DOCUMENT CANVAS ----------------- */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-sm text-slate-900 space-y-12">
        {/* =========================================================================
            DOCUMENT VIEW 1: COMPLETE RESULT BOOK
           ========================================================================= */}
        {documentType === 'result_book' && (
          <div className="space-y-12">
            {/* PORTADA OFICIAL DEL RESULT BOOK */}
            <div className="text-center py-12 px-6 border-4 border-double border-slate-300 rounded-3xl space-y-6 relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-900 text-white shadow-md">
                  <BookOpen className="h-8 w-8" />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-blue-800">
                  Documento Oficial de Competición • FIG Ciclo 2025-2028
                </span>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-950">
                  LIBRO DE RESULTADOS
                </h1>
                <h2 className="text-xl sm:text-2xl font-bold text-blue-900 mt-2">
                  {currentChamp?.name || 'Campeonato Oficial'}
                </h2>
              </div>

              <div className="max-w-xl mx-auto pt-4 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                <p><strong>Organizador:</strong> {currentChamp?.venueName || 'Federación / Club Anfitrión'}</p>
                <p><strong>Sede:</strong> {currentChamp?.location || 'Gimnasio Central'}</p>
                <p><strong>Fechas de Competencia:</strong> {currentChamp?.startDate} al {currentChamp?.endDate}</p>
                <p><strong>Reglamento Técnico:</strong> {currentChamp?.rulesetVersion || 'FIG 2025-2028'} • Sistema Operix Reports</p>
              </div>

              <div className="pt-6 text-[10px] text-slate-400 font-mono">
                Emitido el {new Date().toLocaleDateString('es-CL')} • Desarrollado por Comercial Hels SpA
              </div>
            </div>

            {/* SECCIÓN 1: MEDALLERO OLÍMPICO POR CLUBES */}
            <div className="page-break-before space-y-4">
              <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Medal className="h-5 w-5 text-amber-500" />
                    1. Cuadro de Honor & Medallero Oficial por Clubes
                  </h3>
                  <p className="text-xs text-slate-500">
                    Clasificación según criterio olímpico FIG (mayor cantidad de oros, platas y bronces).
                  </p>
                </div>
              </div>

              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 font-bold uppercase text-[10px] text-slate-700 border-b border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 text-center">Lugar</th>
                    <th className="py-2.5 px-3">Club / Institución</th>
                    <th className="py-2.5 px-3 text-center bg-amber-50 text-amber-900">🥇 Oro</th>
                    <th className="py-2.5 px-3 text-center bg-slate-100 text-slate-800">🥈 Plata</th>
                    <th className="py-2.5 px-3 text-center bg-orange-50 text-orange-900">🥉 Bronce</th>
                    <th className="py-2.5 px-3 text-center font-bold">Total Medallas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {clubMedals.map((m) => (
                    <tr key={m.clubId}>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                        {m.rank}°
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {m.clubName}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold bg-amber-50/50">
                        {m.gold}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold bg-slate-50">
                        {m.silver}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold bg-orange-50/50">
                        {m.bronze}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 text-sm">
                        {m.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SECCIÓN 2: RESULTADOS ALL-AROUND (GENERAL INDIVIDUAL) */}
            <div className="page-break-before space-y-4">
              <div className="border-b-2 border-slate-900 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-blue-700" />
                    2. Resultados All-Around (General Individual)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Conforme al Artículo 5.3 del Reglamento Técnico FIG (Suma de aparatos y desempate por ejecución/aparatos).
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-slate-500">
                  {allAroundStandings.length} Gimnastas Clasificados
                </span>
              </div>

              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 font-bold uppercase text-[10px] text-slate-700 border-b border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 text-center">Lugar</th>
                    <th className="py-2.5 px-3">Gimnasta</th>
                    <th className="py-2.5 px-3">Club</th>
                    <th className="py-2.5 px-3">Categoría</th>
                    {apparatusCodes.map((code) => (
                      <th key={code} className="py-2.5 px-2 text-center font-mono">
                        {code}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right">TOTAL AA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {allAroundStandings.map((row) => (
                    <tr key={row.gymnastId}>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        {row.medal ? (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${
                              row.medal === 'gold'
                                ? 'bg-amber-100 text-amber-900'
                                : row.medal === 'silver'
                                ? 'bg-slate-200 text-slate-900'
                                : 'bg-orange-100 text-orange-900'
                            }`}
                          >
                            {row.rank}° {row.medal.toUpperCase()}
                          </span>
                        ) : (
                          `${row.rank}°`
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{row.gymnastName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{row.clubName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{row.categoryName}</td>
                      {apparatusCodes.map((code) => (
                        <td key={code} className="py-2.5 px-2 text-center font-mono tabular-nums">
                          {row.apparatusScores[code]?.toFixed(3) || '-'}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right font-mono font-black text-blue-900 text-sm tabular-nums">
                        {row.totalScore.toFixed(3)}
                        {row.tieBreakInfo && (
                          <div className="text-[9px] font-normal text-slate-500 italic">
                            {row.tieBreakInfo}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SECCIÓN 3: RESULTADOS POR APARATO */}
            <div className="page-break-before space-y-6">
              <div className="border-b-2 border-slate-900 pb-2">
                <h3 className="text-lg font-black uppercase tracking-wider text-slate-900">
                  3. Clasificación Final por Aparatos
                </h3>
                <p className="text-xs text-slate-500">
                  Puntuaciones oficiales con desglose de Dificultad (D), Ejecución (E) y deducciones neutras.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {apparatusStandingsList.map(({ apparatusCode, apparatusName, standings }) => (
                  <div key={apparatusCode} className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-900">{apparatusName} ({apparatusCode})</span>
                      <span className="text-[10px] font-mono text-slate-500">{standings.length} competidores</span>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-1.5 px-2 text-center">Lugar</th>
                          <th className="py-1.5 px-2">Gimnasta</th>
                          <th className="py-1.5 px-2 text-center">D</th>
                          <th className="py-1.5 px-2 text-center">E</th>
                          <th className="py-1.5 px-2 text-right">Nota Final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {standings.slice(0, 8).map((app) => (
                          <tr key={app.gymnastId}>
                            <td className="py-1.5 px-2 text-center font-mono font-bold text-[11px]">
                              {app.rank}°
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="font-bold text-slate-900 truncate max-w-[140px]">{app.gymnastName}</div>
                              <div className="text-[9px] text-slate-500 truncate max-w-[140px]">{app.clubName}</div>
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono text-[11px]">{app.dScore.toFixed(3)}</td>
                            <td className="py-1.5 px-2 text-center font-mono text-[11px]">{app.eScoreAvg.toFixed(3)}</td>
                            <td className="py-1.5 px-2 text-right font-mono font-black text-blue-900">
                              {app.finalScore.toFixed(3)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN 4: RESULTADOS POR EQUIPOS */}
            <div className="page-break-before space-y-4">
              <div className="border-b-2 border-slate-900 pb-2">
                <h3 className="text-lg font-black uppercase tracking-wider text-slate-900">
                  4. Clasificación General por Equipos
                </h3>
                <p className="text-xs text-slate-500">
                  Cómputo federativo de clubes participantes según formato oficial de mejores notas.
                </p>
              </div>

              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 font-bold uppercase text-[10px] text-slate-700 border-b border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 text-center">Lugar</th>
                    <th className="py-2.5 px-3">Club</th>
                    <th className="py-2.5 px-3 text-center">Gimnastas</th>
                    <th className="py-2.5 px-3 text-right">Puntaje Total Equipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {teamStandings.map((team) => (
                    <tr key={team.clubId}>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-sm">
                        {team.rank}° {team.rank <= 3 ? '🏆' : ''}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{team.clubName}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{team.participatingGymnastsCount} gimnastas</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-blue-900 text-sm">
                        {team.totalScore.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SECCIÓN 5: ACTA DE CIERRE & FIRMAS DE AUTORIDADES */}
            {officialMinutes && (
              <div className="page-break-before space-y-8 pt-6">
                <div className="border-b-2 border-slate-900 pb-2">
                  <h3 className="text-lg font-black uppercase tracking-wider text-slate-900">
                    5. Acta Oficial de Cierre & Homologación de Resultados
                  </h3>
                  <p className="text-xs text-slate-500">
                    Certificación de conformidad técnica y jurídica del torneo.
                  </p>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-xs space-y-3 leading-relaxed">
                  <p>
                    En la ciudad de <strong>{officialMinutes.venueName}</strong>, con fecha{' '}
                    <strong>{officialMinutes.closingDate}</strong>, se da por finalizada oficialmente la competencia{' '}
                    <strong>{officialMinutes.championshipName}</strong>.
                  </p>
                  <p>
                    Se certifica la participación de <strong>{officialMinutes.totalGymnasts} gimnastas</strong>{' '}
                    pertenecientes a <strong>{officialMinutes.totalClubs} clubes federados</strong>, con un total de{' '}
                    <strong>{officialMinutes.totalScoresSubmitted} rutinas evaluadas</strong> y visadas por el cuerpo de jueces
                    conforme a la normativa <strong>{officialMinutes.rulesetVersion}</strong>.
                  </p>
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <p className="font-bold text-slate-800 mb-1">Observaciones del Jurado Superior:</p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600">
                      {officialMinutes.observations.map((obs, idx) => (
                        <li key={idx}>{obs}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* FIRMAS OFICIALES */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-12 text-center text-xs">
                  <div className="border-t border-slate-400 pt-2 space-y-0.5">
                    <p className="font-bold text-slate-900">{officialMinutes.technicalDirectorName}</p>
                    <p className="text-[10px] text-slate-500">Director de Competición</p>
                  </div>
                  <div className="border-t border-slate-400 pt-2 space-y-0.5">
                    <p className="font-bold text-slate-900">{officialMinutes.headJudgeName}</p>
                    <p className="text-[10px] text-slate-500">Juez Árbitro General FIG</p>
                  </div>
                  <div className="border-t border-slate-400 pt-2 space-y-0.5">
                    <p className="font-bold text-slate-900">{officialMinutes.presidentName}</p>
                    <p className="text-[10px] text-slate-500">Presidente Mesa de Control</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            DOCUMENT VIEW 2: CATEGORY RESULTS BULLETIN
           ========================================================================= */}
        {documentType === 'category_results' && (
          <div className="space-y-6">
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Boletín Oficial</span>
                <h2 className="text-2xl font-black text-slate-950">
                  Resultados por Categoría — {selectedCategoryId === 'all' ? 'Todas las Categorías' : categories.find((c) => c.id === selectedCategoryId)?.name}
                </h2>
                <p className="text-xs text-slate-500">{currentChamp?.name}</p>
              </div>
              <span className="font-mono text-xs font-bold text-slate-400">
                Puntuaciones Aprobadas FIG
              </span>
            </div>

            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 font-bold uppercase text-[10px] text-slate-700 border-b border-slate-300">
                <tr>
                  <th className="py-2.5 px-3 text-center">Lugar</th>
                  <th className="py-2.5 px-3">Gimnasta</th>
                  <th className="py-2.5 px-3">Club</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  {apparatusCodes.map((c) => (
                    <th key={c} className="py-2.5 px-2 text-center font-mono">{c}</th>
                  ))}
                  <th className="py-2.5 px-3 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {allAroundStandings.map((row) => (
                  <tr key={row.gymnastId}>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">
                      {row.rank}° {row.medal ? `(${row.medal.toUpperCase()})` : ''}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{row.gymnastName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{row.clubName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{row.categoryName}</td>
                    {apparatusCodes.map((c) => (
                      <td key={c} className="py-2.5 px-2 text-center font-mono">{row.apparatusScores[c]?.toFixed(3) || '-'}</td>
                    ))}
                    <td className="py-2.5 px-3 text-right font-mono font-black text-blue-900 text-sm">
                      {row.totalScore.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* =========================================================================
            DOCUMENT VIEW 3: OFFICIAL MINUTES (ACTAS)
           ========================================================================= */}
        {documentType === 'official_minutes' && officialMinutes && (
          <div className="space-y-8 max-w-3xl mx-auto py-6">
            <div className="text-center space-y-2 border-b-2 border-slate-900 pb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                FEDERACIÓN DE GIMNASIA • COMISIÓN TÉCNICA
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 uppercase">
                Acta de Cierre de Competencia y Validación Técnica
              </h1>
              <p className="text-xs text-slate-600 font-semibold">{officialMinutes.championshipName}</p>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-800">
              <p>
                Siendo las 18:00 horas del día <strong>{officialMinutes.closingDate}</strong>, en las dependencias de{' '}
                <strong>{officialMinutes.venueName}</strong>, se reúne el Comité Técnico y el Panel Superior de Arbitraje
                para homologar los resultados oficiales del certamen.
              </p>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 font-mono text-[11px]">
                <div>Total Deportistas Inscritos: <strong>{officialMinutes.totalGymnasts}</strong></div>
                <div>Clubes Participantes: <strong>{officialMinutes.totalClubs}</strong></div>
                <div>Puntuaciones Validadas: <strong>{officialMinutes.totalScoresSubmitted}</strong></div>
                <div>Código de Puntos: <strong>{officialMinutes.rulesetVersion}</strong></div>
              </div>

              <div className="space-y-2 pt-2">
                <p className="font-bold text-slate-900">Dictamen y Resoluciones de la Mesa de Arbitraje:</p>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-700">
                  <li>Se aprueban todas las puntuaciones oficiales que constan en la base de datos Operix.</li>
                  <li>Se confirma la aplicación estricta de las normas de desempate FIG Art. 5.3 para podios oficiales.</li>
                  <li>Se procede a la firma de las actas de resultados finales para archivo federativo y premiación.</li>
                </ol>
              </div>
            </div>

            {/* FIRMAS */}
            <div className="grid grid-cols-2 gap-12 pt-16 text-center text-xs">
              <div className="border-t border-slate-400 pt-2 space-y-0.5">
                <p className="font-bold text-slate-900">{officialMinutes.technicalDirectorName}</p>
                <p className="text-[10px] text-slate-500">Director de Torneo</p>
              </div>
              <div className="border-t border-slate-400 pt-2 space-y-0.5">
                <p className="font-bold text-slate-900">{officialMinutes.headJudgeName}</p>
                <p className="text-[10px] text-slate-500">Juez Árbitro General FIG</p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            DOCUMENT VIEW 4: DIPLOMAS BATCH (GRID OF CERTIFICATES)
           ========================================================================= */}
        {documentType === 'diplomas_batch' && (
          <div className="space-y-12">
            <div className="no-print border-b border-slate-200 pb-3 flex justify-between items-center text-xs text-slate-500">
              <span>{diplomaAwards.length} diplomas listos para imprimir en formato A4 / Carta apaisado.</span>
              <button
                type="button"
                onClick={handlePrint}
                className="font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir Todos los Diplomas</span>
              </button>
            </div>

            {/* DIPLOMAS LOOP */}
            <div className="space-y-12">
              {diplomaAwards.map((dip, idx) => (
                <div
                  key={dip.id}
                  className={`p-10 border-8 border-double border-amber-600/80 rounded-3xl text-center space-y-6 bg-gradient-to-b from-amber-50/20 via-white to-amber-50/10 shadow-xs relative overflow-hidden ${
                    idx > 0 ? 'page-break-before' : ''
                  }`}
                  style={{ minHeight: '480px' }}
                >
                  <div className="flex justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-sm font-black text-xl">
                      ★
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest text-amber-900">
                      {diplomaConfig.institutionTitle}
                    </p>
                    <h2 className="text-2xl sm:text-4xl font-serif font-black tracking-tight text-slate-900">
                      DIPLOMA DE HONOR
                    </h2>
                    <p className="text-xs font-medium text-slate-600">
                      {currentChamp?.name || 'Campeonato de Gimnasia'}
                    </p>
                  </div>

                  <div className="space-y-2 py-4">
                    <p className="text-xs text-slate-500">Se otorga el presente reconocimiento a:</p>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                      {dip.gymnastName}
                    </h3>
                    <p className="text-sm font-bold text-blue-900">
                      {dip.clubName} • {dip.categoryName}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 max-w-md mx-auto">
                    <p className="text-sm font-black text-amber-950 uppercase tracking-wide">
                      {dip.awardTitle}
                    </p>
                    {dip.finalScore !== undefined && (
                      <p className="text-xs font-mono font-bold text-amber-900 mt-0.5">
                        Puntuación Oficial: {dip.finalScore.toFixed(3)} pts
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-12 pt-8 max-w-lg mx-auto text-center text-xs">
                    <div className="border-t border-slate-400 pt-1 space-y-0.5">
                      <p className="font-bold text-slate-900">{diplomaConfig.directorName}</p>
                      <p className="text-[10px] text-slate-500">{diplomaConfig.directorTitle}</p>
                    </div>
                    <div className="border-t border-slate-400 pt-1 space-y-0.5">
                      <p className="font-bold text-slate-900">{diplomaConfig.headJudgeName}</p>
                      <p className="text-[10px] text-slate-500">{diplomaConfig.headJudgeTitle}</p>
                    </div>
                  </div>

                  <div className="text-[9px] text-slate-400 pt-4 font-mono">
                    {diplomaConfig.tournamentLocation} • {diplomaConfig.tournamentDate} • Desarrollado por Comercial Hels SpA
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            DOCUMENT VIEW 5: START LIST & OPERATIONAL
           ========================================================================= */}
        {documentType === 'start_list' && (
          <div className="space-y-6">
            <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Secretaría Técnica</span>
                <h2 className="text-2xl font-black text-slate-950">Planilla Oficial de Partida (Start List)</h2>
                <p className="text-xs text-slate-500">{currentChamp?.name}</p>
              </div>
              <span className="font-mono text-xs font-bold text-slate-500">
                {athletes.length} Atletas Acreditados
              </span>
            </div>

            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 font-bold uppercase text-[10px] text-slate-700 border-b border-slate-300">
                <tr>
                  <th className="py-2 px-3">Dorsal</th>
                  <th className="py-2 px-3">Gimnasta</th>
                  <th className="py-2 px-3">Club</th>
                  <th className="py-2 px-3">Categoría</th>
                  <th className="py-2 px-3">Subdivisión</th>
                  <th className="py-2 px-3">Grupo</th>
                  <th className="py-2 px-3 text-center">Aparato Inicial</th>
                  <th className="py-2 px-3 text-center">Orden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {athletes.map((a) => (
                  <tr key={a.registrationId}>
                    <td className="py-2 px-3 font-mono font-black text-blue-900">#{a.bibNumber}</td>
                    <td className="py-2 px-3 font-bold text-slate-900">{a.gymnastName}</td>
                    <td className="py-2 px-3 text-slate-600">{a.clubName}</td>
                    <td className="py-2 px-3 text-slate-600">{a.categoryName}</td>
                    <td className="py-2 px-3 text-slate-500">{a.subdivision}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{a.rotationGroup}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-blue-700">{a.startingApparatus}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold">#{a.startOrder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* =========================================================================
            DOCUMENT VIEW 6: JUDGING SHEETS
           ========================================================================= */}
        {documentType === 'judging_sheets' && (
          <div className="space-y-8">
            <div className="border-b-2 border-slate-900 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Mesa de Jueces</span>
              <h2 className="text-2xl font-black text-slate-950">Planilla Técnica de Pista por Aparato</h2>
              <p className="text-xs text-slate-500">{currentChamp?.name} • Para registro manual de respaldo</p>
            </div>

            <div className="border-2 border-slate-900 rounded-2xl p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4 pb-4 border-b border-slate-300 text-xs font-semibold">
                <div>Aparato: <strong>_____________________</strong></div>
                <div>Panel: <strong>Jurado E / Jurado D</strong></div>
                <div>Juez Evaluador: <strong>_____________________</strong></div>
              </div>

              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-slate-100 font-bold text-[10px] uppercase text-slate-700 border-b border-slate-300">
                  <tr>
                    <th className="py-2 px-3 w-12 text-center">N°</th>
                    <th className="py-2 px-3 w-20">Dorsal</th>
                    <th className="py-2 px-3">Gimnasta / Club</th>
                    <th className="py-2 px-3 w-24 text-center">Nota D</th>
                    <th className="py-2 px-3 w-24 text-center">Deducción E</th>
                    <th className="py-2 px-3 w-24 text-center">Nota E</th>
                    <th className="py-2 px-3 w-24 text-center">ND (Línea/T)</th>
                    <th className="py-2 px-3 w-28 text-right">Nota Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <tr key={idx} className="h-10">
                      <td className="py-2 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3"></td>
                      <td className="py-2 px-3"></td>
                      <td className="py-2 px-3 text-center border-x border-slate-200"></td>
                      <td className="py-2 px-3 text-center border-x border-slate-200"></td>
                      <td className="py-2 px-3 text-center border-x border-slate-200"></td>
                      <td className="py-2 px-3 text-center border-x border-slate-200"></td>
                      <td className="py-2 px-3 text-right"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-6 flex justify-between text-xs text-slate-500 font-medium">
                <span>Firma Juez Responsable: __________________________________</span>
                <span>Visado Juez Árbitro: __________________________________</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
