import React, { useState } from 'react'
import { calculateFigScore } from './scoringEngine'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calculator, AlertCircle } from 'lucide-react'

export interface ScoringPadProps {
  gymnastName?: string
  apparatusName?: string
  onScoreCalculated?: (finalScore: number, dScore: number, eScores: number[], nd: number) => void
}

export const ScoringPad: React.FC<ScoringPadProps> = ({
  gymnastName = 'Gimnasta en Prueba',
  apparatusName = 'Salto (VT)',
  onScoreCalculated,
}) => {
  const [dScore, setDScore] = useState<string>('4.8')
  const [e1, setE1] = useState<string>('8.5')
  const [e2, setE2] = useState<string>('8.7')
  const [e3, setE3] = useState<string>('8.4')
  const [e4, setE4] = useState<string>('8.6')
  const [neutralDeduction, setNeutralDeduction] = useState<string>('0.0')

  // Calculate live using the official engine
  let result = null
  let calculationError = null

  try {
    const rawE = [parseFloat(e1), parseFloat(e2), parseFloat(e3), parseFloat(e4)].filter((n) => !isNaN(n))
    if (rawE.length > 0) {
      result = calculateFigScore({
        dScore: parseFloat(dScore) || 0,
        eScores: rawE,
        neutralDeductions: parseFloat(neutralDeduction) || 0,
      })
    }
  } catch (err: unknown) {
    calculationError = (err as Error).message
  }

  return (
    <Card className="border-slate-200 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">{apparatusName}</h4>
            <p className="text-xs text-slate-500">{gymnastName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">Fórmula Oficial FIG 2025-2028</Badge>
          <Badge variant="success" className="text-[10px]">Panel D/E</Badge>
        </div>
      </div>

      {calculationError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{calculationError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Left: Input parameters */}
        <div className="sm:col-span-2 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nota D (Dificultad / Requisitos de Grupo)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={dScore}
              onChange={(e) => setDScore(e.target.value)}
              className="w-full sm:w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Panel Jueces E (Ejecución y Arte)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Juez E1</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="10"
                  value={e1}
                  onChange={(e) => setE1(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1 text-xs font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Juez E2</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="10"
                  value={e2}
                  onChange={(e) => setE2(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1 text-xs font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Juez E3</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="10"
                  value={e3}
                  onChange={(e) => setE3(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1 text-xs font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Juez E4</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="10"
                  value={e4}
                  onChange={(e) => setE4(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2.5 py-1 text-xs font-mono"
                />
              </div>
            </div>
            {result?.eScoreDiscardedHigh !== undefined && (
              <p className="text-[10px] text-slate-400 mt-1.5">
                Descarte FIG de extremos: Min (<strong>{result.eScoreDiscardedLow}</strong>) y Max (
                <strong>{result.eScoreDiscardedHigh}</strong>) eliminadas.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deducciones Neutras (Línea / Tiempo / Indumentaria)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={neutralDeduction}
              onChange={(e) => setNeutralDeduction(e.target.value)}
              className="w-full sm:w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Right: Score breakdown and final computed value */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
              Desglose Técnico
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Nota D:</span>
                <span className="font-mono font-semibold">{result?.dScore.toFixed(3) || '0.000'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Promedio Nota E:</span>
                <span className="font-mono font-semibold text-emerald-700">
                  +{result?.eScoreAverage.toFixed(3) || '0.000'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Deducción Neutra:</span>
                <span className="font-mono font-semibold text-rose-600">
                  -{result?.neutralDeductions.toFixed(3) || '0.000'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 mt-4 text-center">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Puntuación Final</p>
            <p className="text-3xl font-black text-blue-900 font-mono mt-1">
              {result?.finalScore.toFixed(3) || '0.000'}
            </p>
            {onScoreCalculated && result && (
              <button
                type="button"
                onClick={() =>
                  onScoreCalculated(
                    result.finalScore,
                    result.dScore,
                    result.eScoresRaw,
                    result.neutralDeductions
                  )
                }
                className="mt-3 w-full rounded-lg bg-blue-700 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors"
              >
                Aprobar Puntuación
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
