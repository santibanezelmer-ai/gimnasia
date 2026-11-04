import React, { useState, useEffect } from 'react'
import { calculateFigScore } from './scoringEngine'
import { supabase } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calculator, AlertCircle, CheckCircle2, Send, User } from 'lucide-react'

export interface ScoringPadProps {
  onScoreSaved?: () => void
}

interface ActiveRegistrationOption {
  registrationId: string
  gymnastName: string
  clubName: string
  categoryName: string
  championshipId: string
  scoringRegime: 'free' | 'obligatory'
  defaultFixedDScore: number
}

interface ApparatusOption {
  id: string
  code: string
  name: string
}

export const ScoringPad: React.FC<ScoringPadProps> = ({ onScoreSaved }) => {
  const [registrations, setRegistrations] = useState<ActiveRegistrationOption[]>([])
  const [apparatuses, setApparatuses] = useState<ApparatusOption[]>([])
  const [selectedRegId, setSelectedRegId] = useState<string>('')
  const [selectedAppId, setSelectedAppId] = useState<string>('')

  // Scoring fields
  const [vaultAttempt, setVaultAttempt] = useState<1 | 2>(1)
  const [isObligatory, setIsObligatory] = useState<boolean>(false)
  const [fixedD, setFixedD] = useState<string>('10.0')
  const [dScore, setDScore] = useState<string>('4.8')
  const [e1, setE1] = useState<string>('8.5')
  const [e2, setE2] = useState<string>('8.7')
  const [e3, setE3] = useState<string>('8.4')
  const [e4, setE4] = useState<string>('8.6')
  const [neutralDeduction, setNeutralDeduction] = useState<string>('0.0')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load available apparatuses and registrations
  useEffect(() => {
    async function loadPadData() {
      // Apparatuses
      const { data: appsData } = await supabase
        .from('apparatuses')
        .select('id, code, name')
        .eq('discipline', 'GAF')
        .order('sort_order', { ascending: true })

      if (appsData && appsData.length > 0) {
        setApparatuses(appsData)
        setSelectedAppId(appsData[0].id)
      }

      // Registrations with joined gymnast and club
      const { data: regsData } = await supabase
        .from('registrations')
        .select(`
          id,
          championship_id,
          gymnasts (
            first_name,
            last_name
          ),
          clubs (
            name
          ),
          categories (
            name,
            scoring_regime,
            default_fixed_d_score
          )
        `)
        .eq('status', 'approved')

      if (regsData && regsData.length > 0) {
        const mapped = (regsData as unknown as Record<string, unknown>[]).map((r) => {
          const gym = r.gymnasts as { first_name: string; last_name: string } | null
          const club = r.clubs as { name: string } | null
          const cat = r.categories as { name: string; scoring_regime?: string; default_fixed_d_score?: number } | null

          const isOblig = cat?.scoring_regime === 'obligatory'
          const fixedVal = cat?.default_fixed_d_score ? Number(cat.default_fixed_d_score) : 10.0

          return {
            registrationId: r.id as string,
            gymnastName: gym ? `${gym.first_name} ${gym.last_name}` : 'Gimnasta',
            clubName: club?.name || 'Club',
            categoryName: cat?.name || 'General',
            championshipId: r.championship_id as string,
            scoringRegime: (isOblig ? 'obligatory' : 'free') as 'free' | 'obligatory',
            defaultFixedDScore: fixedVal,
          }
        })
        setRegistrations(mapped)
        setSelectedRegId(mapped[0].registrationId)
        // Auto-sync initial regime
        setIsObligatory(mapped[0].scoringRegime === 'obligatory')
        setFixedD(mapped[0].defaultFixedDScore.toString())
      }
    }
    loadPadData()
  }, [])

  // Auto-sync scoring regime whenever selected registration changes
  useEffect(() => {
    if (!selectedRegId) return
    const reg = registrations.find((r) => r.registrationId === selectedRegId)
    if (reg) {
      const isOblig = reg.scoringRegime === 'obligatory'
      setIsObligatory(isOblig)
      setFixedD(reg.defaultFixedDScore.toString())
    }
  }, [selectedRegId, registrations])

  let result = null
  let calculationError = null

  try {
    const rawE = [parseFloat(e1), parseFloat(e2), parseFloat(e3), parseFloat(e4)].filter((n) => !isNaN(n))
    if (rawE.length > 0) {
      result = calculateFigScore({
        dScore: isObligatory ? parseFloat(fixedD) || 10.0 : parseFloat(dScore) || 0,
        isObligatory,
        fixedDScore: parseFloat(fixedD) || 10.0,
        eScores: rawE,
        neutralDeductions: parseFloat(neutralDeduction) || 0,
      })
    }
  } catch (err: unknown) {
    calculationError = (err as Error).message
  }

  const handleSubmitScore = async (statusToSet: 'provisional' | 'official_approved' = 'official_approved') => {
    if (!result || !selectedRegId || !selectedAppId) {
      setSaveError('Selecciona una gimnasta y un aparato válidos para registrar la nota.')
      return
    }

    setIsSubmitting(true)
    setSaveError(null)
    setSaveSuccess(null)

    try {
      const selectedReg = registrations.find((r) => r.registrationId === selectedRegId)
      if (!selectedReg) {
        throw new Error('Inscripción no encontrada.')
      }

      const isVaultApp = apparatuses.find((a) => a.id === selectedAppId)?.code === 'VT'

      const { error } = await supabase.from('scores').upsert(
        {
          championship_id: selectedReg.championshipId,
          registration_id: selectedReg.registrationId,
          apparatus_id: selectedAppId,
          attempt_number: isVaultApp ? vaultAttempt : 1,
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
    <Card className="border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Mesa de Jurado & Captura Oficial</h4>
            <p className="text-xs text-slate-500">Terminal FIG 2025-2028 con descarte de extremos y transmisión Realtime</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Regime Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setIsObligatory(false)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                !isObligatory ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nivel Libre (D + E)
            </button>
            <button
              type="button"
              onClick={() => setIsObligatory(true)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                isObligatory ? 'bg-indigo-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rutina Establecida (Solo E)
            </button>
          </div>

          <Badge variant={isObligatory ? 'default' : 'outline'} className="text-[10px]">
            {isObligatory ? 'D Fija' : 'FIG D+E'}
          </Badge>
        </div>
      </div>

      {/* Target Athlete & Apparatus Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
            <User className="h-3.5 w-3.5 text-slate-500" /> Gimnasta en Pista
          </label>
          {registrations.length === 0 ? (
            <p className="text-xs text-amber-700 font-medium">
              No hay gimnastas aprobadas aún en el campeonato.
            </p>
          ) : (
            <select
              value={selectedRegId}
              onChange={(e) => setSelectedRegId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              {registrations.map((r) => (
                <option key={r.registrationId} value={r.registrationId}>
                  {r.gymnastName} • {r.clubName} ({r.categoryName} — {r.scoringRegime === 'obligatory' ? 'Rutina Establecida' : 'Nivel Libre'})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">Aparato en Competición</label>
          <div className="flex gap-1.5">
            {apparatuses.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedAppId(app.id)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold font-mono transition-colors ${
                  selectedAppId === app.id
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {app.code}
              </button>
            ))}
          </div>

          {apparatuses.find((a) => a.id === selectedAppId)?.code === 'VT' && (
            <div className="mt-2.5 flex items-center justify-between rounded-lg bg-blue-50/80 p-2 text-xs border border-blue-200">
              <span className="font-bold text-blue-900 text-[11px]">Intento de Salto:</span>
              <div className="inline-flex rounded-md border border-blue-300 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setVaultAttempt(1)}
                  className={`rounded px-2.5 py-1 font-semibold transition-colors ${
                    vaultAttempt === 1 ? 'bg-blue-700 text-white' : 'text-blue-900 hover:bg-blue-50'
                  }`}
                >
                  Salto 1 (VT1)
                </button>
                <button
                  type="button"
                  onClick={() => setVaultAttempt(2)}
                  className={`rounded px-2.5 py-1 font-semibold transition-colors ${
                    vaultAttempt === 2 ? 'bg-blue-700 text-white' : 'text-blue-900 hover:bg-blue-50'
                  }`}
                >
                  Salto 2 (VT2)
                </button>
              </div>
            </div>
          )}
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
          {!isObligatory ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Nota D (Dificultad en Vivo)
                </label>
                <Badge variant="outline" className="text-[10px]">Evaluación Dinámica</Badge>
              </div>
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
          ) : (
            <div className="rounded-lg bg-indigo-50/70 border border-indigo-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-indigo-900">Nota D Predeterminada por Reglamento</p>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    Rutina obligatoria / Nivel formativo. El jurado solo evalúa la ejecución técnica (E).
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-indigo-800">Valor D:</span>
                  <input
                    type="number"
                    step="0.5"
                    value={fixedD}
                    onChange={(e) => setFixedD(e.target.value)}
                    className="w-20 rounded border border-indigo-300 bg-white px-2 py-1 text-xs font-mono font-bold text-indigo-900 text-center"
                  />
                </div>
              </div>
            </div>
          )}

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
              disabled={isSubmitting || !result || registrations.length === 0}
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
