import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  computeAllAroundStandings,
  computeApparatusStandings,
  computeTeamStandings,
  type GymnastScoreEntry,
} from './standingsEngine'
import {
  Trophy,
  Medal,
  Flame,
  Radio,
  Tv,
  Maximize2,
  Minimize2,
  LayoutList,
  Sparkles,
  Printer,
  ChevronDown,
  ChevronUp,
  Award,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const LiveStandingsBoard: React.FC = () => {
  const [tab, setTab] = useState<'all_around' | 'apparatus' | 'teams'>('all_around')
  const [selectedApparatus, setSelectedApparatus] = useState<string>('VT')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [scores, setScores] = useState<GymnastScoreEntry[]>([])
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false)

  // 3-Way Design Mode Switcher: Standard Table, Olympic Podium, Arena / TV Display
  type ViewMode = 'standard' | 'podium' | 'arena'
  const [viewMode, setViewMode] = useState<ViewMode>('standard')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [expandedGymnastId, setExpandedGymnastId] = useState<string | null>(null)

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // 1. Fetch initial scores from Supabase
  const loadLiveScores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('scores')
        .select(`
          id,
          final_score,
          d_score,
          e_score_avg,
          status,
          attempt_number,
          apparatuses (
            code
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
        .in('status', ['provisional', 'official_approved'])

      if (error) {
        console.warn('Realtime fetch warning:', error.message)
        return
      }

      if (data && data.length > 0) {
        const mapped: GymnastScoreEntry[] = (data as unknown as Record<string, unknown>[]).map((row) => {
          const app = row.apparatuses as { code: string } | null
          const reg = row.registrations as {
            gymnast_id: string
            category_id?: string
            gymnasts: { first_name: string; last_name: string } | null
            clubs: { id: string; name: string } | null
            categories: { id: string; name: string; scoring_regime?: string } | null
          } | null

          const gymnastName = reg?.gymnasts
            ? `${reg.gymnasts.first_name} ${reg.gymnasts.last_name}`
            : 'Camila Valenzuela'
          const clubName = reg?.clubs?.name || 'Club Deportivo Manquehue'
          const clubId = reg?.clubs?.id || 'club-manquehue'
          const cat = reg?.categories
          const isOblig = cat?.scoring_regime === 'obligatory'

          return {
            gymnastId: reg?.gymnast_id || (row.id as string),
            gymnastName,
            clubId,
            clubName,
            categoryId: cat?.id || reg?.category_id || 'general',
            categoryName: cat?.name || 'General',
            scoringRegime: isOblig ? 'obligatory' : 'free',
            apparatusCode: app?.code || 'VT',
            attemptNumber: row.attempt_number ? Number(row.attempt_number) : 1,
            dScore: Number(row.d_score),
            eScoreAvg: Number(row.e_score_avg),
            finalScore: Number(row.final_score),
            status: row.status as GymnastScoreEntry['status'],
          }
        })
        setScores(mapped)
      } else {
        // Fallback demo data so the board is lively even before first entry
        setScores(getDemoSeedScores())
      }
    } catch (err) {
      console.error('Error fetching scores:', err)
      setScores(getDemoSeedScores())
    }
  }, [])

  // 2. Setup Supabase Realtime channel
  useEffect(() => {
    loadLiveScores()

    const channel = supabase
      .channel('public:scores_realtime_board')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        (payload) => {
          console.log('⚡ Realtime score event received:', payload)
          loadLiveScores()
        }
      )
      .subscribe((status) => {
        setIsLiveConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadLiveScores])

  const categoriesList = Array.from(
    new Map(
      scores
        .filter((s) => s.categoryId && s.categoryName)
        .map((s) => [s.categoryId!, { id: s.categoryId!, name: s.categoryName!, regime: s.scoringRegime }])
    ).values()
  )

  const availableApparatusCodes = useMemo(() => {
    const fromScores = Array.from(new Set(scores.map((s) => s.apparatusCode))).filter(Boolean)
    if (fromScores.length > 0) return fromScores
    return ['VT', 'UB', 'BB', 'FX', 'PH', 'SR', 'PB', 'HB', 'HOOP', 'BALL', 'CLUBS', 'RIBBON', 'TRA', 'DMT', 'SPD', 'FR']
  }, [scores])

  useEffect(() => {
    if (availableApparatusCodes.length > 0 && !availableApparatusCodes.includes(selectedApparatus)) {
      setSelectedApparatus(availableApparatusCodes[0])
    }
  }, [availableApparatusCodes, selectedApparatus])

  const allAround = computeAllAroundStandings(scores, { categoryId: selectedCategory || undefined })
  const apparatusStandings = computeApparatusStandings(scores, selectedApparatus, selectedCategory || undefined)
  const teamStandings = computeTeamStandings(scores)

  const medalBadge = (medal?: 'gold' | 'silver' | 'bronze') => {
    if (medal === 'gold') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 border border-amber-300">
          <Medal className="h-3 w-3 text-amber-600" /> 1° Oro
        </span>
      )
    }
    if (medal === 'silver') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 border border-slate-300">
          <Medal className="h-3 w-3 text-slate-500" /> 2° Plata
        </span>
      )
    }
    if (medal === 'bronze') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-800 border border-orange-300">
          <Medal className="h-3 w-3 text-orange-600" /> 3° Bronce
        </span>
      )
    }
    return null
  }

  return (
    <div className={`space-y-4 ${isFullscreen ? 'p-6 bg-slate-950 text-white min-h-screen' : ''}`}>
      {/* Top Header & Interactive Controls */}
      <div className={`flex flex-col gap-4 border-b pb-4 ${isFullscreen ? 'border-slate-800' : 'border-slate-200/80'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-lg font-bold flex items-center gap-2 ${isFullscreen ? 'text-white' : 'text-slate-900'}`}>
                <Flame className="h-5 w-5 text-orange-500" />
                Tablero de Resultados Oficiales & Directos
              </h3>
              {isLiveConnected ? (
                <Badge variant="success" className="text-[10px] flex items-center gap-1">
                  <Radio className="h-3 w-3 animate-pulse text-emerald-600" /> Realtime Activo
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Conectando WebSocket...</Badge>
              )}
            </div>
            <p className={`text-xs ${isFullscreen ? 'text-slate-400' : 'text-slate-500'}`}>
              Actualización reactiva automática sin recarga de página ante cada nota validada por el jurado.
            </p>
          </div>

          {/* Action buttons: Print & Fullscreen */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handlePrint}
              title="Imprimir Acta Oficial de Resultados"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span>Imprimir Acta</span>
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Salir de Pantalla Completa' : 'Modo Pantalla Completa TV'}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold shadow-xs transition-colors"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5 text-emerald-400" />}
              <span>{isFullscreen ? 'Salir TV' : 'Pantalla Completa'}</span>
            </button>
          </div>
        </div>

        {/* View Switchers Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* 3-Way Mode Switcher: Estándar | Podio | Arena TV */}
          <div className={`inline-flex rounded-xl p-1 text-xs shadow-xs ${isFullscreen ? 'bg-slate-900 border border-slate-800' : 'bg-slate-100 border border-slate-200'}`}>
            <button
              type="button"
              onClick={() => setViewMode('standard')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-all ${
                viewMode === 'standard' ? 'bg-white text-blue-900 shadow-sm' : isFullscreen ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="h-3.5 w-3.5 text-blue-700" />
              <span>Tabla Estándar</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('podium')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-all ${
                viewMode === 'podium' ? 'bg-amber-500 text-white shadow-sm' : isFullscreen ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Medal className="h-3.5 w-3.5" />
              <span>Podio Olímpico</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('arena')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-all ${
                viewMode === 'arena' ? 'bg-slate-950 text-emerald-400 shadow-sm ring-1 ring-emerald-500/40' : isFullscreen ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tv className="h-3.5 w-3.5" />
              <span>Modo TV Arena</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter Selector */}
            <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs shadow-xs ${isFullscreen ? 'bg-slate-900 border border-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-900'}`}>
              <span className={`font-semibold text-[11px] ${isFullscreen ? 'text-slate-400' : 'text-slate-500'}`}>Categoría:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`bg-transparent font-medium focus:outline-none cursor-pointer text-xs ${isFullscreen ? 'text-white' : 'text-slate-900'}`}
              >
                <option value="" className="text-slate-900">Todas las Categorías</option>
                {categoriesList.map((cat) => (
                  <option key={cat.id} value={cat.id} className="text-slate-900">
                    {cat.name} ({cat.regime === 'obligatory' ? 'Rutina Establecida' : 'Nivel Libre'})
                  </option>
                ))}
              </select>
            </div>

            {/* Competition Tabs */}
            <div className={`inline-flex rounded-lg p-1 text-xs shadow-xs ${isFullscreen ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setTab('all_around')}
                className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                  tab === 'all_around' ? 'bg-blue-700 text-white' : isFullscreen ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                General (All-Around)
              </button>
              <button
                type="button"
                onClick={() => setTab('apparatus')}
                className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                  tab === 'apparatus' ? 'bg-blue-700 text-white' : isFullscreen ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Por Aparato
              </button>
              <button
                type="button"
                onClick={() => setTab('teams')}
                className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                  tab === 'teams' ? 'bg-blue-700 text-white' : isFullscreen ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Por Equipos
              </button>
            </div>
          </div>
        </div>
      </div>

      {tab === 'apparatus' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-semibold ${isFullscreen ? 'text-slate-400' : 'text-slate-600'}`}>Aparato / Evento:</span>
          {availableApparatusCodes.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setSelectedApparatus(code)}
              className={`rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition-colors ${
                selectedApparatus === code
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isFullscreen
                    ? 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      )}

      {/* -------------------- VIEW MODE 1: OLYMPIC PODIUM -------------------- */}
      {viewMode === 'podium' && (
        <div className="space-y-6">
          {tab === 'all_around' && (
            <OlympicPodiumAllAround
              items={allAround}
              expandedId={expandedGymnastId}
              onToggleExpand={(id) => setExpandedGymnastId(expandedGymnastId === id ? null : id)}
            />
          )}
          {tab === 'apparatus' && (
            <OlympicPodiumApparatus
              items={apparatusStandings}
              apparatusCode={selectedApparatus}
            />
          )}
          {tab === 'teams' && (
            <OlympicPodiumTeams
              teams={teamStandings}
            />
          )}
        </div>
      )}

      {/* -------------------- VIEW MODE 2: ARENA / TV DISPLAY -------------------- */}
      {viewMode === 'arena' && (
        <ArenaLiveDisplay
          tab={tab}
          allAround={allAround}
          apparatusStandings={apparatusStandings}
          selectedApparatus={selectedApparatus}
          teamStandings={teamStandings}
          medalBadge={medalBadge}
        />
      )}

      {/* -------------------- VIEW MODE 3: STANDARD HIGH-DENSITY TABLE -------------------- */}
      {viewMode === 'standard' && (
        <>
          {tab === 'all_around' && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Lugar</th>
                    <th className="px-4 py-3 font-semibold">Gimnasta</th>
                    <th className="px-4 py-3 font-semibold">Club / Delegación</th>
                    <th className="px-4 py-3 font-semibold">Categoría</th>
                    <th className="px-4 py-3 font-semibold text-center">VT</th>
                    <th className="px-4 py-3 font-semibold text-center">UB</th>
                    <th className="px-4 py-3 font-semibold text-center">BB</th>
                    <th className="px-4 py-3 font-semibold text-center">FX</th>
                    <th className="px-4 py-3 font-semibold text-right">Total AA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {allAround.map((row) => (
                    <tr key={row.gymnastId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-center">{row.rank}°</span>
                          {medalBadge(row.medal)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div>{row.gymnastName}</div>
                        {row.tieBreakInfo && (
                          <div className="text-[10px] text-amber-700 font-sans font-normal">
                            {row.tieBreakInfo}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{row.clubName}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{row.categoryName || 'General'}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums">{row.apparatusScores.VT?.toFixed(3) || '-'}</td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums">{row.apparatusScores.UB?.toFixed(3) || '-'}</td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums">{row.apparatusScores.BB?.toFixed(3) || '-'}</td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums">{row.apparatusScores.FX?.toFixed(3) || '-'}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-blue-900 text-sm tabular-nums">
                        {row.totalScore.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'apparatus' && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Lugar</th>
                    <th className="px-4 py-3 font-semibold">Gimnasta</th>
                    <th className="px-4 py-3 font-semibold">Club</th>
                    <th className="px-4 py-3 font-semibold">Categoría</th>
                    <th className="px-4 py-3 font-semibold text-center">Nota D</th>
                    <th className="px-4 py-3 font-semibold text-center">Promedio E (Desempate)</th>
                    <th className="px-4 py-3 font-semibold text-right">Nota Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {apparatusStandings.map((row) => (
                    <tr key={row.gymnastId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{row.rank}°</span>
                          {medalBadge(row.medal)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div>{row.gymnastName}</div>
                        {row.tieBreakInfo && (
                          <div className="text-[10px] text-amber-700 font-sans font-normal">
                            {row.tieBreakInfo}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{row.clubName}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{row.categoryName || 'General'}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums">{row.dScore.toFixed(3)}</td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums text-emerald-700 font-semibold">
                        {row.eScoreAvg.toFixed(3)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-blue-900 text-sm tabular-nums">
                        <div>{row.finalScore.toFixed(3)}</div>
                        {row.vaultAttempts?.attempt1 && row.vaultAttempts?.attempt2 && (
                          <div className="text-[10px] font-normal text-slate-400 font-sans">
                            S1: {row.vaultAttempts.attempt1.finalScore.toFixed(3)} | S2: {row.vaultAttempts.attempt2.finalScore.toFixed(3)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'teams' && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Lugar</th>
                    <th className="px-4 py-3 font-semibold">Club / Delegación</th>
                    <th className="px-4 py-3 font-semibold text-center">Gimnastas</th>
                    <th className="px-4 py-3 font-semibold text-center">Aparatos Computados</th>
                    <th className="px-4 py-3 font-semibold text-right">Puntaje Total Equipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {teamStandings.map((team) => (
                    <tr key={team.clubId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Trophy className={`h-4 w-4 ${team.rank === 1 ? 'text-amber-500' : 'text-slate-400'}`} />
                          <span>{team.rank}° Lugar</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div>{team.clubName}</div>
                        {team.tieBreakInfo && (
                          <div className="text-[10px] text-amber-700 font-sans font-normal">
                            {team.tieBreakInfo}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono tabular-nums">{team.participatingGymnastsCount}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1 text-[10px] font-mono tabular-nums">
                          {Object.entries(team.apparatusTotals).map(([app, val]) => (
                            <span key={app} className="bg-slate-100 px-1.5 py-0.5 rounded">
                              {app}: {val.toFixed(2)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-blue-900 text-sm tabular-nums">
                        {team.totalScore.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* =========================================================================================
   SUBCOMPONENT: OLYMPIC PODIUM FOR ALL-AROUND
========================================================================================= */
interface OlympicPodiumAllAroundProps {
  items: ReturnType<typeof computeAllAroundStandings>
  expandedId: string | null
  onToggleExpand: (id: string) => void
}

const OlympicPodiumAllAround: React.FC<OlympicPodiumAllAroundProps> = ({
  items,
  expandedId,
  onToggleExpand,
}) => {
  const first = items.find((i) => i.rank === 1)
  const second = items.find((i) => i.rank === 2)
  const third = items.find((i) => i.rank === 3)
  const rest = items.filter((i) => i.rank > 3)

  return (
    <div className="space-y-8">
      {/* Visual Pedestal (2nd - 1st - 3rd) */}
      <div className="relative rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 text-white shadow-xl overflow-hidden border border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative flex flex-col items-center justify-center mb-6 text-center">
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 gap-1.5 px-3 py-1 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Ceremonia de Premiación All-Around
          </Badge>
          <h4 className="text-xl sm:text-2xl font-black mt-2 tracking-tight">Podio de Campeonas All-Around</h4>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-6 items-end max-w-3xl mx-auto pt-6">
          {/* 2nd Place: Silver (Left) */}
          <div className="flex flex-col items-center">
            {second ? (
              <div className="w-full text-center mb-3">
                <div className="inline-flex p-2.5 rounded-full bg-slate-800 border-2 border-slate-400 shadow-lg shadow-slate-500/20 mb-2">
                  <Medal className="h-6 w-6 text-slate-300" />
                </div>
                <div className="font-bold text-xs sm:text-sm text-slate-100 truncate px-1">{second.gymnastName}</div>
                <div className="text-[10px] sm:text-xs text-slate-400 truncate px-1">{second.clubName}</div>
                <div className="mt-1 font-mono font-black text-slate-200 text-sm sm:text-lg tabular-nums">
                  {second.totalScore.toFixed(3)}
                </div>
              </div>
            ) : (
              <div className="h-20" />
            )}
            <div className="w-full h-24 sm:h-32 rounded-t-xl bg-gradient-to-t from-slate-800 to-slate-700/80 border-t-4 border-slate-400 flex flex-col items-center justify-center shadow-inner">
              <span className="text-2xl sm:text-4xl font-black text-slate-300 font-mono">2</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Plata</span>
            </div>
          </div>

          {/* 1st Place: Gold (Center - Tallest) */}
          <div className="flex flex-col items-center -mt-6">
            {first ? (
              <div className="w-full text-center mb-3">
                <div className="inline-flex p-3 rounded-full bg-amber-500/20 border-2 border-amber-400 shadow-xl shadow-amber-500/30 mb-2 ring-4 ring-amber-400/20 animate-pulse">
                  <Trophy className="h-8 w-8 text-amber-400" />
                </div>
                <div className="font-black text-sm sm:text-base text-amber-200 truncate px-1">{first.gymnastName}</div>
                <div className="text-[11px] sm:text-xs text-amber-300/80 truncate px-1">{first.clubName}</div>
                <div className="mt-1 font-mono font-black text-amber-400 text-base sm:text-2xl tabular-nums">
                  {first.totalScore.toFixed(3)}
                </div>
              </div>
            ) : (
              <div className="h-28" />
            )}
            <div className="w-full h-36 sm:h-44 rounded-t-xl bg-gradient-to-t from-amber-900/80 to-amber-600/80 border-t-4 border-amber-300 flex flex-col items-center justify-center shadow-inner relative overflow-hidden">
              <span className="text-3xl sm:text-5xl font-black text-amber-200 font-mono">1</span>
              <span className="text-[10px] sm:text-xs uppercase tracking-widest text-amber-300 font-black">Campeona Oro</span>
            </div>
          </div>

          {/* 3rd Place: Bronze (Right) */}
          <div className="flex flex-col items-center">
            {third ? (
              <div className="w-full text-center mb-3">
                <div className="inline-flex p-2.5 rounded-full bg-amber-950/60 border-2 border-orange-600 shadow-lg shadow-orange-700/20 mb-2">
                  <Medal className="h-6 w-6 text-orange-400" />
                </div>
                <div className="font-bold text-xs sm:text-sm text-slate-100 truncate px-1">{third.gymnastName}</div>
                <div className="text-[10px] sm:text-xs text-slate-400 truncate px-1">{third.clubName}</div>
                <div className="mt-1 font-mono font-black text-orange-300 text-sm sm:text-lg tabular-nums">
                  {third.totalScore.toFixed(3)}
                </div>
              </div>
            ) : (
              <div className="h-16" />
            )}
            <div className="w-full h-18 sm:h-24 rounded-t-xl bg-gradient-to-t from-orange-950 to-orange-800/80 border-t-4 border-orange-600 flex flex-col items-center justify-center shadow-inner">
              <span className="text-xl sm:text-3xl font-black text-orange-300 font-mono">3</span>
              <span className="text-[10px] uppercase tracking-widest text-orange-400 font-bold">Bronce</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rest of the field (Ranks 4+) */}
      {rest.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            Clasificación General (4° en adelante)
          </h5>
          <div className="grid gap-2">
            {rest.map((r) => {
              const isExpanded = expandedId === r.gymnastId
              return (
                <div
                  key={r.gymnastId}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs transition-all hover:border-slate-300"
                >
                  <div
                    onClick={() => onToggleExpand(r.gymnastId)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-700 font-mono">
                        {r.rank}°
                      </span>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900">{r.gymnastName}</div>
                        <div className="text-[11px] text-slate-500">{r.clubName} · {r.categoryName}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-mono text-sm sm:text-base font-black text-blue-900 tabular-nums">
                          {r.totalScore.toFixed(3)}
                        </div>
                        <div className="text-[10px] text-slate-400">Puntaje AA</div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-slate-500">Salto (VT)</div>
                        <div className="font-mono font-bold text-slate-800 tabular-nums">
                          {r.apparatusScores.VT?.toFixed(3) || '-'}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-slate-500">Asimétricas (UB)</div>
                        <div className="font-mono font-bold text-slate-800 tabular-nums">
                          {r.apparatusScores.UB?.toFixed(3) || '-'}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-slate-500">Viga (BB)</div>
                        <div className="font-mono font-bold text-slate-800 tabular-nums">
                          {r.apparatusScores.BB?.toFixed(3) || '-'}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <div className="text-[10px] font-semibold text-slate-500">Suelo (FX)</div>
                        <div className="font-mono font-bold text-slate-800 tabular-nums">
                          {r.apparatusScores.FX?.toFixed(3) || '-'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================================================
   SUBCOMPONENT: OLYMPIC PODIUM FOR APPARATUS
========================================================================================= */
interface OlympicPodiumApparatusProps {
  items: ReturnType<typeof computeApparatusStandings>
  apparatusCode: string
}

const OlympicPodiumApparatus: React.FC<OlympicPodiumApparatusProps> = ({
  items,
  apparatusCode,
}) => {
  const first = items.find((i) => i.rank === 1)
  const second = items.find((i) => i.rank === 2)
  const third = items.find((i) => i.rank === 3)
  const rest = items.filter((i) => i.rank > 3)

  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 text-white shadow-xl overflow-hidden border border-slate-800">
        <div className="text-center mb-6">
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 gap-1.5 px-3 py-1 text-xs">
            <Award className="h-3.5 w-3.5 text-blue-400" /> Especialidad por Aparato · {apparatusCode}
          </Badge>
          <h4 className="text-xl sm:text-2xl font-black mt-2 tracking-tight">Final Individual de {apparatusCode}</h4>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-6 items-end max-w-3xl mx-auto pt-6">
          {/* Silver */}
          <div className="flex flex-col items-center">
            {second ? (
              <div className="w-full text-center mb-3">
                <div className="inline-flex p-2.5 rounded-full bg-slate-800 border-2 border-slate-400 mb-2">
                  <Medal className="h-6 w-6 text-slate-300" />
                </div>
                <div className="font-bold text-xs sm:text-sm text-slate-100 truncate px-1">{second.gymnastName}</div>
                <div className="text-[10px] text-slate-400 truncate px-1">{second.clubName}</div>
                <div className="mt-1 font-mono font-black text-slate-200 text-sm sm:text-lg tabular-nums">
                  {second.finalScore.toFixed(3)}
                </div>
                <div className="text-[9px] text-slate-400 font-mono">D: {second.dScore.toFixed(2)} | E: {second.eScoreAvg.toFixed(2)}</div>
              </div>
            ) : (
              <div className="h-20" />
            )}
            <div className="w-full h-24 sm:h-32 rounded-t-xl bg-gradient-to-t from-slate-800 to-slate-700/80 border-t-4 border-slate-400 flex flex-col items-center justify-center">
              <span className="text-2xl sm:text-4xl font-black text-slate-300 font-mono">2</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Plata</span>
            </div>
          </div>

          {/* Gold */}
          <div className="flex flex-col items-center -mt-6">
            {first ? (
              <div className="w-full text-center mb-3">
                <div className="inline-flex p-3 rounded-full bg-amber-500/20 border-2 border-amber-400 mb-2 ring-4 ring-amber-400/20 animate-pulse">
                  <Trophy className="h-8 w-8 text-amber-400" />
                </div>
                <div className="font-black text-sm sm:text-base text-amber-200 truncate px-1">{first.gymnastName}</div>
                <div className="text-[11px] text-amber-300/80 truncate px-1">{first.clubName}</div>
                <div className="mt-1 font-mono font-black text-amber-400 text-base sm:text-2xl tabular-nums">
                  {first.finalScore.toFixed(3)}
                </div>
                <div className="text-[10px] text-amber-300/70 font-mono">D: {first.dScore.toFixed(2)} | E: {first.eScoreAvg.toFixed(2)}</div>
              </div>
            ) : (
              <div className="h-28" />
            )}
            <div className="w-full h-36 sm:h-44 rounded-t-xl bg-gradient-to-t from-amber-900/80 to-amber-600/80 border-t-4 border-amber-300 flex flex-col items-center justify-center">
              <span className="text-3xl sm:text-5xl font-black text-amber-200 font-mono">1</span>
              <span className="text-[10px] sm:text-xs uppercase tracking-widest text-amber-300 font-black">Medalla de Oro</span>
            </div>
          </div>

          {/* Bronze */}
          <div className="flex flex-col items-center">
            {third ? (
              <div className="w-full text-center mb-3">
                <div className="inline-flex p-2.5 rounded-full bg-amber-950/60 border-2 border-orange-600 mb-2">
                  <Medal className="h-6 w-6 text-orange-400" />
                </div>
                <div className="font-bold text-xs sm:text-sm text-slate-100 truncate px-1">{third.gymnastName}</div>
                <div className="text-[10px] text-slate-400 truncate px-1">{third.clubName}</div>
                <div className="mt-1 font-mono font-black text-orange-300 text-sm sm:text-lg tabular-nums">
                  {third.finalScore.toFixed(3)}
                </div>
                <div className="text-[9px] text-orange-400/80 font-mono">D: {third.dScore.toFixed(2)} | E: {third.eScoreAvg.toFixed(2)}</div>
              </div>
            ) : (
              <div className="h-16" />
            )}
            <div className="w-full h-18 sm:h-24 rounded-t-xl bg-gradient-to-t from-orange-950 to-orange-800/80 border-t-4 border-orange-600 flex flex-col items-center justify-center">
              <span className="text-xl sm:text-3xl font-black text-orange-300 font-mono">3</span>
              <span className="text-[10px] uppercase tracking-widest text-orange-400 font-bold">Bronce</span>
            </div>
          </div>
        </div>
      </div>

      {rest.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            Posiciones 4° en adelante ({apparatusCode})
          </h5>
          <div className="grid gap-2">
            {rest.map((r) => (
              <div
                key={r.gymnastId}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-700 font-mono">
                    {r.rank}°
                  </span>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900">{r.gymnastName}</div>
                    <div className="text-[11px] text-slate-500">{r.clubName} · {r.categoryName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:block text-right text-xs font-mono text-slate-500">
                    <div>D: {r.dScore.toFixed(3)}</div>
                    <div>E: {r.eScoreAvg.toFixed(3)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm sm:text-base font-black text-blue-900 tabular-nums">
                      {r.finalScore.toFixed(3)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================================================
   SUBCOMPONENT: OLYMPIC PODIUM FOR TEAMS
========================================================================================= */
interface OlympicPodiumTeamsProps {
  teams: ReturnType<typeof computeTeamStandings>
}

const OlympicPodiumTeams: React.FC<OlympicPodiumTeamsProps> = ({ teams }) => {
  const first = teams.find((t) => t.rank === 1)
  const second = teams.find((t) => t.rank === 2)
  const third = teams.find((t) => t.rank === 3)
  const rest = teams.filter((t) => t.rank > 3)

  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 text-white shadow-xl overflow-hidden border border-slate-800">
        <div className="text-center mb-6">
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1.5 px-3 py-1 text-xs">
            <Users className="h-3.5 w-3.5 text-emerald-400" /> Clasificación General por Equipos y Clubes
          </Badge>
          <h4 className="text-xl sm:text-2xl font-black mt-2 tracking-tight">Podio de Clubes Campeones</h4>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-6 items-end max-w-3xl mx-auto pt-6">
          {/* Silver Team */}
          <div className="flex flex-col items-center">
            {second ? (
              <div className="w-full text-center mb-3">
                <div className="inline-flex p-2.5 rounded-full bg-slate-800 border-2 border-slate-400 mb-2">
                  <Medal className="h-6 w-6 text-slate-300" />
                </div>
                <div className="font-bold text-xs sm:text-sm text-slate-100 truncate px-1">{second.clubName}</div>
                <div className="text-[10px] text-slate-400 truncate px-1">{second.participatingGymnastsCount} gimnastas</div>
                <div className="mt-1 font-mono font-black text-slate-200 text-sm sm:text-lg tabular-nums">
                  {second.totalScore.toFixed(3)}
                </div>
              </div>
            ) : (
              <div className="h-20" />
            )}
            <div className="w-full h-24 sm:h-32 rounded-t-xl bg-gradient-to-t from-slate-800 to-slate-700/80 border-t-4 border-slate-400 flex flex-col items-center justify-center">
              <span className="text-2xl sm:text-4xl font-black text-slate-300 font-mono">2</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Subcampeón</span>
            </div>
          </div>

          {/* Gold Team */}
          <div className="flex flex-col items-center -mt-6">
            {first ? (
              <div className="w-full text-center mb-3">
                <div className="inline-flex p-3 rounded-full bg-amber-500/20 border-2 border-amber-400 mb-2 ring-4 ring-amber-400/20 animate-pulse">
                  <Trophy className="h-8 w-8 text-amber-400" />
                </div>
                <div className="font-black text-sm sm:text-base text-amber-200 truncate px-1">{first.clubName}</div>
                <div className="text-[11px] text-amber-300/80 truncate px-1">{first.participatingGymnastsCount} gimnastas</div>
                <div className="mt-1 font-mono font-black text-amber-400 text-base sm:text-2xl tabular-nums">
                  {first.totalScore.toFixed(3)}
                </div>
              </div>
            ) : (
              <div className="h-28" />
            )}
            <div className="w-full h-36 sm:h-44 rounded-t-xl bg-gradient-to-t from-amber-900/80 to-amber-600/80 border-t-4 border-amber-300 flex flex-col items-center justify-center">
              <span className="text-3xl sm:text-5xl font-black text-amber-200 font-mono">1</span>
              <span className="text-[10px] sm:text-xs uppercase tracking-widest text-amber-300 font-black">Club Campeón</span>
            </div>
          </div>

          {/* Bronze Team */}
          <div className="flex flex-col items-center">
            {third ? (
              <div className="w-full text-center mb-3">
                <div className="inline-flex p-2.5 rounded-full bg-amber-950/60 border-2 border-orange-600 mb-2">
                  <Medal className="h-6 w-6 text-orange-400" />
                </div>
                <div className="font-bold text-xs sm:text-sm text-slate-100 truncate px-1">{third.clubName}</div>
                <div className="text-[10px] text-slate-400 truncate px-1">{third.participatingGymnastsCount} gimnastas</div>
                <div className="mt-1 font-mono font-black text-orange-300 text-sm sm:text-lg tabular-nums">
                  {third.totalScore.toFixed(3)}
                </div>
              </div>
            ) : (
              <div className="h-16" />
            )}
            <div className="w-full h-18 sm:h-24 rounded-t-xl bg-gradient-to-t from-orange-950 to-orange-800/80 border-t-4 border-orange-600 flex flex-col items-center justify-center">
              <span className="text-xl sm:text-3xl font-black text-orange-300 font-mono">3</span>
              <span className="text-[10px] uppercase tracking-widest text-orange-400 font-bold">3° Lugar</span>
            </div>
          </div>
        </div>
      </div>

      {rest.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
            Clubes Participantes (4° en adelante)
          </h5>
          <div className="grid gap-2">
            {rest.map((t) => (
              <div
                key={t.clubId}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-700 font-mono">
                    {t.rank}°
                  </span>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900">{t.clubName}</div>
                    <div className="text-[11px] text-slate-500">{t.participatingGymnastsCount} gimnastas computados</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm sm:text-base font-black text-blue-900 tabular-nums">
                    {t.totalScore.toFixed(3)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================================================
   SUBCOMPONENT: ARENA / TV LIVE DISPLAY (High Contrast & Large Font for Gym Screens)
========================================================================================= */
interface ArenaLiveDisplayProps {
  tab: 'all_around' | 'apparatus' | 'teams'
  allAround: ReturnType<typeof computeAllAroundStandings>
  apparatusStandings: ReturnType<typeof computeApparatusStandings>
  selectedApparatus: string
  teamStandings: ReturnType<typeof computeTeamStandings>
  medalBadge: (medal?: 'gold' | 'silver' | 'bronze') => React.ReactNode
}

const ArenaLiveDisplay: React.FC<ArenaLiveDisplayProps> = ({
  tab,
  allAround,
  apparatusStandings,
  selectedApparatus,
  teamStandings,
}) => {
  return (
    <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 sm:p-6 text-white shadow-2xl">
      {/* Arena Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 mb-4 gap-2">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <span className="text-xs uppercase tracking-widest font-black text-emerald-400">
            TRANSMISIÓN EN VIVO · PANTALLA OFICIAL DE ESTADIO
          </span>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Modo Alta Visibilidad (Visible hasta 25m)
        </div>
      </div>

      {tab === 'all_around' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-3">Lugar</th>
                <th className="py-3 px-3">Gimnasta</th>
                <th className="py-3 px-3">Club</th>
                <th className="py-3 px-3 text-center">VT</th>
                <th className="py-3 px-3 text-center">UB</th>
                <th className="py-3 px-3 text-center">BB</th>
                <th className="py-3 px-3 text-center">FX</th>
                <th className="py-3 px-3 text-right">TOTAL AA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {allAround.map((row) => {
                const isGold = row.rank === 1
                const isSilver = row.rank === 2
                const isBronze = row.rank === 3
                return (
                  <tr
                    key={row.gymnastId}
                    className={`transition-colors ${
                      isGold
                        ? 'bg-amber-500/15 border-l-4 border-amber-400 text-amber-100'
                        : isSilver
                        ? 'bg-slate-800/40 border-l-4 border-slate-300 text-slate-200'
                        : isBronze
                        ? 'bg-orange-950/30 border-l-4 border-orange-500 text-orange-200'
                        : 'hover:bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center justify-center font-mono font-black text-base sm:text-xl ${isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : isBronze ? 'text-orange-400' : 'text-slate-400'}`}>
                        {row.rank}°
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-sm sm:text-base text-white">
                      {row.gymnastName}
                    </td>
                    <td className="py-3.5 px-3 text-xs sm:text-sm text-slate-400 truncate max-w-[160px]">
                      {row.clubName}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-sm sm:text-base tabular-nums">
                      {row.apparatusScores.VT?.toFixed(3) || '-'}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-sm sm:text-base tabular-nums">
                      {row.apparatusScores.UB?.toFixed(3) || '-'}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-sm sm:text-base tabular-nums">
                      {row.apparatusScores.BB?.toFixed(3) || '-'}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-sm sm:text-base tabular-nums">
                      {row.apparatusScores.FX?.toFixed(3) || '-'}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <span className={`font-mono font-black text-lg sm:text-2xl tabular-nums ${isGold ? 'text-amber-300' : 'text-emerald-400'}`}>
                        {row.totalScore.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'apparatus' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-3">Lugar</th>
                <th className="py-3 px-3">Gimnasta</th>
                <th className="py-3 px-3">Club</th>
                <th className="py-3 px-3 text-center">Nota D</th>
                <th className="py-3 px-3 text-center">Nota E (Promedio)</th>
                <th className="py-3 px-3 text-right">FINAL {selectedApparatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {apparatusStandings.map((row) => {
                const isGold = row.rank === 1
                return (
                  <tr
                    key={row.gymnastId}
                    className={`transition-colors ${
                      isGold
                        ? 'bg-amber-500/15 border-l-4 border-amber-400 text-amber-100'
                        : 'hover:bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <td className="py-3.5 px-3 font-mono font-black text-base sm:text-xl">
                      {row.rank}°
                    </td>
                    <td className="py-3.5 px-3 font-bold text-sm sm:text-base text-white">
                      {row.gymnastName}
                    </td>
                    <td className="py-3.5 px-3 text-xs sm:text-sm text-slate-400">
                      {row.clubName}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-sm sm:text-base text-slate-300 tabular-nums">
                      {row.dScore.toFixed(3)}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-sm sm:text-base text-emerald-400 font-bold tabular-nums">
                      {row.eScoreAvg.toFixed(3)}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <span className={`font-mono font-black text-lg sm:text-2xl tabular-nums ${isGold ? 'text-amber-300' : 'text-emerald-400'}`}>
                        {row.finalScore.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'teams' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-3">Lugar</th>
                <th className="py-3 px-3">Club / Delegación</th>
                <th className="py-3 px-3 text-center">Gimnastas</th>
                <th className="py-3 px-3 text-right">PUNTAJE TOTAL EQUIPO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {teamStandings.map((t) => (
                <tr
                  key={t.clubId}
                  className={`transition-colors ${
                    t.rank === 1
                      ? 'bg-amber-500/15 border-l-4 border-amber-400 text-amber-100'
                      : 'hover:bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <td className="py-3.5 px-3 font-mono font-black text-base sm:text-xl">
                    {t.rank}°
                  </td>
                  <td className="py-3.5 px-3 font-bold text-sm sm:text-base text-white">
                    {t.clubName}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-sm sm:text-base text-slate-400 tabular-nums">
                    {t.participatingGymnastsCount}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <span className={`font-mono font-black text-lg sm:text-2xl tabular-nums ${t.rank === 1 ? 'text-amber-300' : 'text-emerald-400'}`}>
                      {t.totalScore.toFixed(3)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function getDemoSeedScores(): GymnastScoreEntry[] {
  return [
    {
      gymnastId: 'g1',
      gymnastName: 'Florencia Castro',
      clubId: 'c1',
      clubName: 'Club Estadio Italiano',
      categoryId: 'cat-senior',
      categoryName: 'FIG Senior',
      scoringRegime: 'free',
      apparatusCode: 'VT',
      dScore: 5.2,
      eScoreAvg: 8.7,
      finalScore: 13.9,
      status: 'official_approved',
    },
    {
      gymnastId: 'g1',
      gymnastName: 'Florencia Castro',
      clubId: 'c1',
      clubName: 'Club Estadio Italiano',
      categoryId: 'cat-senior',
      categoryName: 'FIG Senior',
      scoringRegime: 'free',
      apparatusCode: 'UB',
      dScore: 4.9,
      eScoreAvg: 8.2,
      finalScore: 13.1,
      status: 'official_approved',
    },
    {
      gymnastId: 'g1',
      gymnastName: 'Florencia Castro',
      clubId: 'c1',
      clubName: 'Club Estadio Italiano',
      categoryId: 'cat-senior',
      categoryName: 'FIG Senior',
      scoringRegime: 'free',
      apparatusCode: 'BB',
      dScore: 5.1,
      eScoreAvg: 8.3,
      finalScore: 13.4,
      status: 'official_approved',
    },
    {
      gymnastId: 'g1',
      gymnastName: 'Florencia Castro',
      clubId: 'c1',
      clubName: 'Club Estadio Italiano',
      categoryId: 'cat-senior',
      categoryName: 'FIG Senior',
      scoringRegime: 'free',
      apparatusCode: 'FX',
      dScore: 5.3,
      eScoreAvg: 8.4,
      finalScore: 13.7,
      status: 'official_approved',
    },
    {
      gymnastId: 'g2',
      gymnastName: 'Camila Valenzuela',
      clubId: 'c2',
      clubName: 'Club Deportivo Manquehue',
      categoryId: 'cat-senior',
      categoryName: 'FIG Senior',
      scoringRegime: 'free',
      apparatusCode: 'VT',
      dScore: 5.0,
      eScoreAvg: 8.6,
      finalScore: 13.6,
      status: 'official_approved',
    },
    {
      gymnastId: 'g2',
      gymnastName: 'Camila Valenzuela',
      clubId: 'c2',
      clubName: 'Club Deportivo Manquehue',
      categoryId: 'cat-senior',
      categoryName: 'FIG Senior',
      scoringRegime: 'free',
      apparatusCode: 'UB',
      dScore: 5.2,
      eScoreAvg: 8.4,
      finalScore: 13.6,
      status: 'official_approved',
    },
    {
      gymnastId: 'g2',
      gymnastName: 'Camila Valenzuela',
      clubId: 'c2',
      clubName: 'Club Deportivo Manquehue',
      categoryId: 'cat-senior',
      categoryName: 'FIG Senior',
      scoringRegime: 'free',
      apparatusCode: 'BB',
      dScore: 4.8,
      eScoreAvg: 8.2,
      finalScore: 13.0,
      status: 'official_approved',
    },
    {
      gymnastId: 'g2',
      gymnastName: 'Camila Valenzuela',
      clubId: 'c2',
      clubName: 'Club Deportivo Manquehue',
      categoryId: 'cat-senior',
      categoryName: 'FIG Senior',
      scoringRegime: 'free',
      apparatusCode: 'FX',
      dScore: 5.1,
      eScoreAvg: 8.3,
      finalScore: 13.4,
      status: 'official_approved',
    },
    // Nivel Obligatorio (Rutina Establecida - D fija 10.000)
    {
      gymnastId: 'g3',
      gymnastName: 'Martina Rojas',
      clubId: 'c2',
      clubName: 'Club Deportivo Manquehue',
      categoryId: 'cat-usag3',
      categoryName: 'Nivel 3 USAG',
      scoringRegime: 'obligatory',
      apparatusCode: 'VT',
      dScore: 10.0,
      eScoreAvg: 8.9,
      finalScore: 18.9,
      status: 'official_approved',
    },
    {
      gymnastId: 'g3',
      gymnastName: 'Martina Rojas',
      clubId: 'c2',
      clubName: 'Club Deportivo Manquehue',
      categoryId: 'cat-usag3',
      categoryName: 'Nivel 3 USAG',
      scoringRegime: 'obligatory',
      apparatusCode: 'UB',
      dScore: 10.0,
      eScoreAvg: 8.7,
      finalScore: 18.7,
      status: 'official_approved',
    },
  ]
}
