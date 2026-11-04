import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  calculateDisciplineScore,
  type MultiDisciplineScoreInput,
  type ScoreCalculationResult,
} from './scoringEngine'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calculator,
  Send,
  AlertCircle,
  CheckCircle2,
  User,
  Timer,
  Sparkles,
} from 'lucide-react'
import type { GymnasticsDiscipline } from '@/core/types/championship'
import { DISCIPLINES_LIST, OFFICIAL_DISCIPLINES } from '@/core/constants/disciplines'

interface ScoringPadProps {
  onScoreSaved?: () => void
}

interface RegistrationOption {
  registrationId: string
  gymnastName: string
  clubName: string
  categoryName: string
  discipline: GymnasticsDiscipline
  championshipId: string
  scoringRegime: 'free' | 'obligatory'
  defaultFixedDScore: number
}

interface ApparatusOption {
  id: string
  code: string
  name: string
  discipline: GymnasticsDiscipline
}

export const ScoringPad: React.FC<ScoringPadProps> = ({ onScoreSaved }) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<GymnasticsDiscipline>('GAF')
  const [apparatuses, setApparatuses] = useState<ApparatusOption[]>([])
  const [selectedAppId, setSelectedAppId] = useState<string>('')
  const [registrations, setRegistrations] = useState<RegistrationOption[]>([])
  const [selectedRegId, setSelectedRegId] = useState<string>('')

  // Vault dual attempt
  const [vaultAttempt, setVaultAttempt] = useState<1 | 2>(1)

  // Scoring Regime state
  const [isObligatory, setIsObligatory] = useState<boolean>(false)
  const [fixedD, setFixedD] = useState<string>('10.0')

  // Common D-score and E-scores
  const [dScore, setDScore] = useState<string>('5.2')
  const [e1, setE1] = useState<string>('8.5')
  const [e2, setE2] = useState<string>('8.7')
  const [e3, setE3] = useState<string>('8.4')
  const [e4, setE4] = useState<string>('8.6')
  const [neutralDeduction, setNeutralDeduction] = useState<string>('0.0')

  // Multi-discipline specific inputs
  const [aScore, setAScore] = useState<string>('8.3')             // Rítmica (GR), Aeróbica (AER), Acrobática (ACRO)
  const [tofScore, setTofScore] = useState<string>('15.420')       // Trampolín Time of Flight (ToF)
  const [hdScore, setHdScore] = useState<string>('9.400')          // Trampolín Horizontal Displacement (HD)
  const [timeSeconds, setTimeSeconds] = useState<string>('23.450') // Parkour Speed cronómetro
  const [penaltySeconds, setPenaltySeconds] = useState<string>('0.000') // Parkour Speed faltas

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // 1. Load registrations
  useEffect(() => {
    async function loadRegistrations() {
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
            discipline,
            scoring_regime,
            default_fixed_d_score
          )
        `)
        .eq('status', 'approved')

      if (regsData && regsData.length > 0) {
        const mapped: RegistrationOption[] = (regsData as unknown as Record<string, unknown>[]).map((r) => {
          const gym = r.gymnasts as { first_name: string; last_name: string } | null
          const club = r.clubs as { name: string } | null
          const cat = r.categories as {
            name: string
            discipline?: GymnasticsDiscipline
            scoring_regime?: string
            default_fixed_d_score?: number
          } | null

          const isOblig = cat?.scoring_regime === 'obligatory'
          const fixedVal = cat?.default_fixed_d_score ? Number(cat.default_fixed_d_score) : 10.0
          const disc = cat?.discipline || 'GAF'

          return {
            registrationId: r.id as string,
            gymnastName: gym ? `${gym.first_name} ${gym.last_name}` : 'Gimnasta',
            clubName: club?.name || 'Club',
            categoryName: cat?.name || 'General',
            discipline: disc,
            championshipId: r.championship_id as string,
            scoringRegime: (isOblig ? 'obligatory' : 'free') as 'free' | 'obligatory',
            defaultFixedDScore: fixedVal,
          }
        })

        setRegistrations(mapped)
        if (mapped.length > 0) {
          setSelectedRegId(mapped[0].registrationId)
          setSelectedDiscipline(mapped[0].discipline)
          setIsObligatory(mapped[0].scoringRegime === 'obligatory')
          setFixedD(mapped[0].defaultFixedDScore.toString())
        }
      }
    }
    loadRegistrations()
  }, [])

  // 2. Load apparatuses whenever selected discipline changes
  useEffect(() => {
    async function loadApparatuses() {
      const { data: appsData } = await supabase
        .from('apparatuses')
        .select('id, code, name, discipline, sort_order')
        .eq('discipline', selectedDiscipline)
        .order('sort_order', { ascending: true })

      if (appsData && appsData.length > 0) {
        const typedApps = appsData as unknown as ApparatusOption[]
        setApparatuses(typedApps)
        setSelectedAppId(typedApps[0].id)
      } else {
        // Fallback to local constants if database apparatuses not yet populated for this discipline
        const fallback = OFFICIAL_DISCIPLINES[selectedDiscipline]?.apparatuses.map((a) => ({
          id: `local-${selectedDiscipline}-${a.code}`,
          code: a.code,
          name: a.name,
          discipline: selectedDiscipline,
        })) || []
        setApparatuses(fallback)
        if (fallback.length > 0) {
          setSelectedAppId(fallback[0].id)
        }
      }
    }
    loadApparatuses()
  }, [selectedDiscipline])

  // Auto-sync scoring regime and discipline when athlete selection changes
  useEffect(() => {
    if (!selectedRegId) return
    const reg = registrations.find((r) => r.registrationId === selectedRegId)
    if (reg) {
      if (reg.discipline && reg.discipline !== selectedDiscipline) {
        setSelectedDiscipline(reg.discipline)
      }
      const isOblig = reg.scoringRegime === 'obligatory'
      setIsObligatory(isOblig)
      setFixedD(reg.defaultFixedDScore.toString())
    }
  }, [selectedRegId, registrations, selectedDiscipline])

  const currentApp = apparatuses.find((a) => a.id === selectedAppId)
  const currentAppCode = currentApp?.code || 'VT'
  const isParkourSpeed = selectedDiscipline === 'PK' && currentAppCode === 'SPD'
  const hasArtisticPanel = ['GR', 'AER', 'ACRO'].includes(selectedDiscipline)
  const isTrampoline = selectedDiscipline === 'TRA'

  let result: ScoreCalculationResult | null = null
  let calculationError: string | null = null

  try {
    const rawE = [parseFloat(e1), parseFloat(e2), parseFloat(e3), parseFloat(e4)].filter((n) => !isNaN(n))
    const input: MultiDisciplineScoreInput = {
      dScore: isObligatory ? parseFloat(fixedD) || 10.0 : parseFloat(dScore) || 0,
      isObligatory,
      fixedDScore: parseFloat(fixedD) || 10.0,
      eScores: rawE.length > 0 ? rawE : [8.5],
      neutralDeductions: parseFloat(neutralDeduction) || 0,
      aScore: parseFloat(aScore) || 0,
      tofScore: parseFloat(tofScore) || 0,
      hdScore: parseFloat(hdScore) || 0,
      timeSeconds: parseFloat(timeSeconds) || 0,
      penaltySeconds: parseFloat(penaltySeconds) || 0,
    }

    result = calculateDisciplineScore(selectedDiscipline, currentAppCode, input)
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

      const isVaultApp = currentAppCode === 'VT'

      const payload = {
        championship_id: selectedReg.championshipId,
        registration_id: selectedReg.registrationId,
        apparatus_id: selectedAppId,
        attempt_number: isVaultApp ? vaultAttempt : 1,
        d_score: result.dScore,
        e_scores: result.eScoresRaw,
        e_score_avg: result.eScoreAverage,
        a_score: result.aScore ?? null,
        tof_score: result.tofScore ?? null,
        hd_score: result.hdScore ?? null,
        time_seconds: result.timeSeconds ?? null,
        penalty_seconds: result.penaltySeconds ?? null,
        neutral_deductions: result.neutralDeductions,
        final_score: result.finalScore,
        status: statusToSet,
      }

      const { error } = await supabase.from('scores').upsert(payload, {
        onConflict: 'registration_id,apparatus_id,attempt_number',
      })

      if (error) throw error

      const unitText = result.unit === 's' ? 'segundos' : 'pts'
      setSaveSuccess(`¡Puntuación ${result.finalScore.toFixed(3)} ${unitText} guardada y transmitida en vivo a Supabase!`)
      if (onScoreSaved) onScoreSaved()
    } catch (err: unknown) {
      setSaveError((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-slate-200/90 bg-white shadow-sm p-5 sm:p-6 rounded-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 shadow-2xs">
            {isParkourSpeed ? <Timer className="h-6 w-6 text-amber-600" /> : <Calculator className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-black tracking-tight text-slate-900">
                Mesa Técnica FIG & Captura Multidisciplina
              </h4>
              <Badge variant="default" className="text-[10px] font-bold bg-slate-900 text-white">
                {OFFICIAL_DISCIPLINES[selectedDiscipline]?.shortName || selectedDiscipline}
              </Badge>
              {isObligatory && (
                <Badge variant="outline" className="text-[10px] font-bold border-indigo-300 text-indigo-700">
                  D Fija (Obligatorio)
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {OFFICIAL_DISCIPLINES[selectedDiscipline]?.rulesetReference} • Conforme a normativa oficial internacional.
            </p>
          </div>
        </div>

        {/* Discipline Quick Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          {DISCIPLINES_LIST.map((d) => (
            <button
              key={d.code}
              type="button"
              onClick={() => setSelectedDiscipline(d.code)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                selectedDiscipline === d.code
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {d.code}
            </button>
          ))}
        </div>
      </div>

      {/* Target Athlete & Apparatus Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
            <User className="h-3.5 w-3.5 text-slate-500" /> Atleta / Gimnasta en Pista
          </label>
          {registrations.length === 0 ? (
            <p className="text-xs text-amber-700 font-medium">
              No hay atletas aprobados aún en el campeonato.
            </p>
          ) : (
            <select
              value={selectedRegId}
              onChange={(e) => setSelectedRegId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              {registrations.map((r) => (
                <option key={r.registrationId} value={r.registrationId}>
                  {r.gymnastName} • {r.clubName} ({r.discipline} - {r.categoryName})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            Aparato / Evento ({OFFICIAL_DISCIPLINES[selectedDiscipline]?.shortName})
          </label>
          <div className="flex flex-wrap gap-1.5">
            {apparatuses.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => setSelectedAppId(app.id)}
                title={app.name}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold font-mono transition-colors ${
                  selectedAppId === app.id
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {app.code}
              </button>
            ))}
          </div>

          {currentAppCode === 'VT' && (
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

      {/* DYNAMIC SCORING CONTROLS PER DISCIPLINE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="sm:col-span-2 space-y-4">
          {/* 1. PARKOUR SPEED MODE */}
          {isParkourSpeed ? (
            <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                <Timer className="h-4 w-4 text-amber-600" />
                <span>Cronometraje Electrónico de Carrera (Parkour Speed FIG)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tiempo de Pista (Segundos)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="1"
                      value={timeSeconds}
                      onChange={(e) => setTimeSeconds(e.target.value)}
                      placeholder="ej. 23.450"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-mono font-bold text-slate-900 focus:border-amber-600 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">seg</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Registro de fotocélula o cronómetro manual oficial.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Penalizaciones de Tiempo (Faltas de Obstáculo)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={penaltySeconds}
                      onChange={(e) => setPenaltySeconds(e.target.value)}
                      placeholder="0.000"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-mono font-bold text-rose-700 focus:border-rose-600 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">+seg</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    +1.000s por salida de línea, +2.000s por omisión de obstáculo.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 2. DIFFICULTY PANEL (D-SCORE) */}
              {!isObligatory ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Nota D (Dificultad FIG)
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

              {/* 3. ARTISTIC PANEL (GR, AER, ACRO) */}
              {hasArtisticPanel && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                      Jurado Artístico (Nota A - FIG {selectedDiscipline})
                    </label>
                    <span className="text-[10px] text-purple-700 font-medium">Base 10.000 pts</span>
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="10"
                    value={aScore}
                    onChange={(e) => setAScore(e.target.value)}
                    className="w-full sm:w-48 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-sm font-mono font-bold text-purple-900 focus:border-purple-600 focus:outline-none"
                  />
                </div>
              )}

              {/* 4. TRAMPOLINE ToF & HD PANEL */}
              {isTrampoline && (currentAppCode === 'TRA' || currentAppCode === 'SYN') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3">
                  <div>
                    <label className="block text-xs font-bold text-sky-900 mb-1">
                      Tiempo de Vuelo (ToF - Segundos)
                    </label>
                    <input
                      type="number"
                      step="0.005"
                      min="0"
                      value={tofScore}
                      onChange={(e) => setTofScore(e.target.value)}
                      className="w-full rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm font-mono font-bold text-sky-900 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-sky-900 mb-1">
                      Desplazamiento Horizontal (HD)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="10"
                      value={hdScore}
                      onChange={(e) => setHdScore(e.target.value)}
                      className="w-full rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm font-mono font-bold text-sky-900 focus:border-sky-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 5. EXECUTION PANEL (E-SCORES) */}
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

              {/* 6. NEUTRAL DEDUCTIONS */}
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
            </>
          )}
        </div>

        {/* SUMMARY / FINAL SCORE COMPUTATION BOX */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
              Cómputo Automático FIG
            </p>
            {isParkourSpeed ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Tiempo de Pista:</span>
                  <span className="font-mono font-semibold">{result?.timeSeconds?.toFixed(3) || '0.000'} s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Penalizaciones:</span>
                  <span className="font-mono font-semibold text-rose-600">
                    +{result?.penaltySeconds?.toFixed(3) || '0.000'} s
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 italic">
                  * En Parkour Speed, el menor tiempo total determina el podio oficial.
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Nota D:</span>
                  <span className="font-mono font-semibold">{result?.dScore.toFixed(3) || '0.000'}</span>
                </div>
                {hasArtisticPanel && (
                  <div className="flex justify-between text-purple-700">
                    <span className="font-medium">Nota A (Artística):</span>
                    <span className="font-mono font-semibold">+{result?.aScore?.toFixed(3) || '0.000'}</span>
                  </div>
                )}
                {isTrampoline && (currentAppCode === 'TRA' || currentAppCode === 'SYN') && (
                  <>
                    <div className="flex justify-between text-sky-700">
                      <span className="font-medium">Tiempo Vuelo (ToF):</span>
                      <span className="font-mono font-semibold">+{result?.tofScore?.toFixed(3) || '0.000'}</span>
                    </div>
                    <div className="flex justify-between text-sky-700">
                      <span className="font-medium">Desplaz. Horiz. (HD):</span>
                      <span className="font-mono font-semibold">+{result?.hdScore?.toFixed(3) || '0.000'}</span>
                    </div>
                  </>
                )}
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
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 mt-4 text-center">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              {isParkourSpeed ? 'Tiempo Final Oficial' : 'Puntuación Final'}
            </p>
            <p className="text-3xl font-black text-blue-900 font-mono mt-1">
              {result?.finalScore.toFixed(3) || '0.000'}
              <span className="text-sm font-bold text-slate-500 ml-1.5 font-sans">
                {isParkourSpeed ? 's' : 'pts'}
              </span>
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
