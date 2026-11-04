import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  computeAllAroundStandings,
  computeApparatusStandings,
  computeTeamStandings,
  type GymnastScoreEntry,
} from './standingsEngine'
import { Trophy, Medal, Flame, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export const LiveStandingsBoard: React.FC = () => {
  const [tab, setTab] = useState<'all_around' | 'apparatus' | 'teams'>('all_around')
  const [selectedApparatus, setSelectedApparatus] = useState<string>('VT')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [scores, setScores] = useState<GymnastScoreEntry[]>([])
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false)

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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-600" />
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
          <p className="text-xs text-slate-500">
            Actualización reactiva automática sin recarga de página ante cada nota validada por el jurado.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter Selector */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs">
            <span className="font-semibold text-slate-500 text-[11px]">Categoría:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent font-medium text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="">Todas las Categorías</option>
              {categoriesList.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.regime === 'obligatory' ? 'Rutina Establecida' : 'Nivel Libre'})
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs">
            <button
              type="button"
              onClick={() => setTab('all_around')}
              className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                tab === 'all_around' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              General (All-Around)
            </button>
            <button
              type="button"
              onClick={() => setTab('apparatus')}
              className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                tab === 'apparatus' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Aparato
            </button>
            <button
              type="button"
              onClick={() => setTab('teams')}
              className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                tab === 'teams' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Equipos
            </button>
          </div>
        </div>
      </div>

      {tab === 'apparatus' && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Aparato:</span>
          {['VT', 'UB', 'BB', 'FX'].map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setSelectedApparatus(code)}
              className={`rounded-lg px-2.5 py-1 text-xs font-mono font-semibold transition-colors ${
                selectedApparatus === code
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      )}

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
                  <td className="px-4 py-3 font-bold text-slate-900">{row.gymnastName}</td>
                  <td className="px-4 py-3 text-slate-500">{row.clubName}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-800">{row.categoryName || 'General'}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{row.apparatusScores.VT?.toFixed(3) || '-'}</td>
                  <td className="px-4 py-3 text-center font-mono">{row.apparatusScores.UB?.toFixed(3) || '-'}</td>
                  <td className="px-4 py-3 text-center font-mono">{row.apparatusScores.BB?.toFixed(3) || '-'}</td>
                  <td className="px-4 py-3 text-center font-mono">{row.apparatusScores.FX?.toFixed(3) || '-'}</td>
                  <td className="px-4 py-3 text-right font-mono font-black text-blue-900 text-sm">
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
                  <td className="px-4 py-3 font-bold text-slate-900">{row.gymnastName}</td>
                  <td className="px-4 py-3 text-slate-500">{row.clubName}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-800">{row.categoryName || 'General'}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{row.dScore.toFixed(3)}</td>
                  <td className="px-4 py-3 text-center font-mono text-emerald-700 font-semibold">
                    {row.eScoreAvg.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-black text-blue-900 text-sm">
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
                  <td className="px-4 py-3 font-bold text-slate-900">{team.clubName}</td>
                  <td className="px-4 py-3 text-center font-mono">{team.participatingGymnastsCount}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1 text-[10px] font-mono">
                      {Object.entries(team.apparatusTotals).map(([app, val]) => (
                        <span key={app} className="bg-slate-100 px-1.5 py-0.5 rounded">
                          {app}: {val.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-black text-blue-900 text-sm">
                    {team.totalScore.toFixed(3)}
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
