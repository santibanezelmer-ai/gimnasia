import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Award, Download } from 'lucide-react'

export const HeadJudgeView: React.FC = () => {
  const pendingScores = [
    {
      id: 'sc-1',
      gymnast: 'Florencia Castro',
      club: 'Club Estadio Italiano',
      apparatus: 'Viga de Equilibrio (BB)',
      dScore: 5.1,
      eAvg: 8.3,
      nd: 0.0,
      finalScore: 13.4,
      judges: 'Panel E: E1(8.3), E2(8.4), E3(8.2), E4(8.3)',
      time: 'Hace 3 min',
    },
    {
      id: 'sc-2',
      gymnast: 'Camila Valenzuela',
      club: 'Club Deportivo Manquehue',
      apparatus: 'Barras Asimétricas (UB)',
      dScore: 5.2,
      eAvg: 8.4,
      nd: 0.0,
      finalScore: 13.6,
      judges: 'Panel E: E1(8.4), E2(8.5), E3(8.3), E4(8.4)',
      time: 'Hace 1 min',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-600" />
            Consola del Juez Árbitro (Head Judge)
          </h3>
          <p className="text-xs text-slate-500">
            Revisión, validación de apelaciones y firma digital de puntuaciones para publicación oficial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar Acta Oficial PDF
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Puntuaciones Pendientes de Aprobación Oficial ({pendingScores.length})
          </h4>
          <Badge variant="warning">En espera de firma</Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {pendingScores.map((item) => (
            <Card key={item.id} className="border-indigo-100 bg-indigo-50/20">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{item.gymnast}</h4>
                  <p className="text-xs text-slate-500">{item.club} • {item.apparatus}</p>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{item.time}</span>
              </div>

              <div className="mt-4 rounded-lg bg-white p-3 border border-slate-200">
                <div className="flex justify-between items-center text-xs">
                  <span>Nota D: <strong>{item.dScore.toFixed(3)}</strong></span>
                  <span>Promedio E: <strong className="text-emerald-700">+{item.eAvg.toFixed(3)}</strong></span>
                  <span>ND: <strong className="text-rose-600">-{item.nd.toFixed(3)}</strong></span>
                  <span className="text-base font-black text-blue-900 font-mono">
                    {item.finalScore.toFixed(3)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-mono">{item.judges}</p>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Observar / Apelación
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 shadow-sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Aprobar & Publicar Oficial
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
