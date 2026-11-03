import React, { useState } from 'react'
import {
  computeAllAroundStandings,
  computeApparatusStandings,
  computeTeamStandings,
  type GymnastScoreEntry,
} from './standingsEngine'
import { Trophy, Medal, Flame } from 'lucide-react'

// Demo data simulating real-time approved scores for a national championship
const INITIAL_SCORES: GymnastScoreEntry[] = [
  {
    gymnastId: 'g1',
    gymnastName: 'Florencia Castro',
    clubId: 'c1',
    clubName: 'Club Estadio Italiano',
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
    apparatusCode: 'FX',
    dScore: 5.1,
    eScoreAvg: 8.3,
    finalScore: 13.4,
    status: 'official_approved',
  },
  {
    gymnastId: 'g3',
    gymnastName: 'Isidora Morales',
    clubId: 'c1',
    clubName: 'Club Estadio Italiano',
    apparatusCode: 'VT',
    dScore: 4.8,
    eScoreAvg: 8.5,
    finalScore: 13.3,
    status: 'official_approved',
  },
  {
    gymnastId: 'g3',
    gymnastName: 'Isidora Morales',
    clubId: 'c1',
    clubName: 'Club Estadio Italiano',
    apparatusCode: 'BB',
    dScore: 4.7,
    eScoreAvg: 8.1,
    finalScore: 12.8,
    status: 'official_approved',
  },
]

export const LiveStandingsBoard: React.FC = () => {
  const [tab, setTab] = useState<'all_around' | 'apparatus' | 'teams'>('all_around')
  const [selectedApparatus, setSelectedApparatus] = useState<string>('VT')

  const allAround = computeAllAroundStandings(INITIAL_SCORES)
  const apparatusStandings = computeApparatusStandings(INITIAL_SCORES, selectedApparatus)
  const teamStandings = computeTeamStandings(INITIAL_SCORES)

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
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-600" />
            Resultados Oficiales & Clasificaciones en Vivo
          </h3>
          <p className="text-xs text-slate-500">
            Cómputo en vivo derivado exclusivamente de puntuaciones aprobadas con desempate reglamentario.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Tables based on active tab */}
      {tab === 'all_around' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Lugar</th>
                <th className="px-4 py-3 font-semibold">Gimnasta</th>
                <th className="px-4 py-3 font-semibold">Club / Delegación</th>
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
                  <td className="px-4 py-3 text-center font-mono">{row.dScore.toFixed(3)}</td>
                  <td className="px-4 py-3 text-center font-mono text-emerald-700 font-semibold">
                    {row.eScoreAvg.toFixed(3)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-black text-blue-900 text-sm">
                    {row.finalScore.toFixed(3)}
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
