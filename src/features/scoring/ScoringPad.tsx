import React, { useState, useEffect } from 'react'
import { calculateFigScore } from './scoringEngine'
import { supabase } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calculator, AlertCircle, CheckCircle2, Send } from 'lucide-react'

export interface ScoringPadProps {
  gymnastName?: string
  apparatusCode?: 'VT' | 'UB' | 'BB' | 'FX'
  apparatusName?: string
  championshipId?: string
  registrationId?: string
  apparatusId?: string
  onScoreSaved?: () => void
}

export const ScoringPad: React.FC<ScoringPadProps> = ({
  gymnastName = 'Camila Valenzuela • Club Deportivo Manquehue',
  apparatusCode = 'VT',
  apparatusName = 'Salto (VT) - Ronda 1',
  championshipId,
  registrationId,
  apparatusId,
  onScoreSaved,
}) => {
  const [dScore, setDScore] = useState<string>('4.8')
  const [e1, setE1] = useState<string>('8.5')
  const [e2, setE2] = useState<string>('8.7')
  const [e3, setE3] = useState<string>('8.4')
  const [e4, setE4] = useState<string>('8.6')
  const [neutralDeduction, setNeutralDeduction] = useState<string>('0.0')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Internal resolved IDs if not provided as props
  const [resolvedChampId, setResolvedChampId] = useState<string>(championshipId || '')
  const [resolvedRegId, setResolvedRegId] = useState<string>(registrationId || '')
  const [resolvedAppId, setResolvedAppId] = useState<string>(apparatusId || '')

  useEffect(() => {
    // If IDs are not supplied, resolve the active championship and apparatus from Supabase
    async function resolveDefaults() {
      if (!resolvedChampId) {
        const { data: champs } = await supabase.from('championships').select('id').limit(1)
        if (champs && champs[0]) setResolvedChampId(champs[0].id)
      }
      if (!resolvedAppId) {
        const { data: apps } = await supabase.from('apparatuses').select('id').eq('code', apparatusCode).limit(1)
        if (apps && apps[0]) setResolvedAppId(apps[0].id)
      }
      if (!resolvedRegId) {
        const { data: regs } = await supabase.from('registrations').select('id').limit(1)
        if (regs && regs[0]) setResolvedRegId(regs[0].id)
      }
    }
    resolveDefaults()
  }, [apparatusCode, resolvedChampId, resolvedAppId, resolvedRegId])

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

  const handleSubmitScore = async (statusToSet: 'provisional' | 'official_approved' = 'official_approved') => {
    if (!result) return
    setIsSubmitting(true)
    setSaveError(null)
    setSaveSuccess(null)

    try {
      if (!resolvedChampId || !resolvedAppId) {
        throw new Error('Falta ID de campeonato o aparato. Asegúrate de tener al menos un campeonato creado.')
      }

      // Upsert into public.scores
      const { error } = await supabase.from('scores').upsert(
        {
          championship_id: resolvedChampId,
          registration_id: resolvedRegId || '11111111-1111-1111-1111-111111111111',
          apparatus_id: resolvedAppId,
          attempt_number: 1,
          d_score: result.dScore,
          e_scores: result.eScoresRaw,
          e_score_avg: result.eScoreAverage,
          neutral_deductions: result.neutralDeductions,
          final_score: result.finalScore,
          status: statusToSet,
        },
        {
          onConflict: 'registration_id,apparatus_id,attempt_number',
        }
      )

      if (error) throw error

      setSaveSuccess(`¡Puntuación ${result.finalScore.toFixed(3)} guardada y transmitida en vivo a Supabase!`)
      if (onScoreSaved) onScoreSaved()
    } catch (err: unknown) {
      setSaveError((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
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
          <Badge variant="success" className="text-[10px]">Panel D/E Conectado</Badge>
        </div>
      </div>

      {calculationError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{calculationError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="sm:col-span-2 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nota D (Dificultad / Elementos Acreditados)
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
              Panel Jueces E (Ejecución Técnica)
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

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
              Cómputo Automático
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

            <button
              type="button"
              disabled={isSubmitting || !result}
              onClick={() => handleSubmitScore('official_approved')}
              className="mt-4 w-full rounded-lg bg-blue-700 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Transmitiendo...' : 'Publicar Nota en Vivo'}</span>
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}
