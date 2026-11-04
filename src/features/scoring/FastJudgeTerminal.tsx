import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { calculateFigScore } from './scoringEngine'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Award,
  Send,
  User,
  Radio,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  LogOut,
} from 'lucide-react'

interface FastJudgeSession {
  judgeCode: string
  judgeName: string
  apparatusCode: string
  championshipId: string
  championshipName: string
}

interface LoadedGymnastOption {
  id: string
  bib_number?: number
  rotation_group?: string
  gymnast_name: string
  club_name: string
  category_name: string
  scoring_regime: 'free' | 'obligatory'
  default_fixed_d_score?: number
}

interface LoadedApparatus {
  id: string
  code: string
  name: string
}

export const FastJudgeTerminal: React.FC = () => {
  const [session, setSession] = useState<FastJudgeSession | null>(() => {
    const saved = localStorage.getItem('operix_fast_judge_session')
    return saved ? JSON.parse(saved) : null
  })

  // Fast Login form fields
  const [inputCode, setInputCode] = useState('')
  const [inputName, setInputName] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // Loaded Championship Data
  const [gymnasts, setGymnasts] = useState<LoadedGymnastOption[]>([])
  const [apparatuses, setApparatuses] = useState<LoadedApparatus[]>([])
  const [selectedRegId, setSelectedRegId] = useState<string>('')
  const [selectedAppId, setSelectedAppId] = useState<string>('')

  // Scoring Fields
  const [vaultAttempt, setVaultAttempt] = useState<1 | 2>(1)
  const [isObligatory, setIsObligatory] = useState<boolean>(false)
  const [fixedD, setFixedD] = useState<string>('10.0')
  const [dScore, setDScore] = useState<string>('4.8')
  const [e1, setE1] = useState<string>('8.5')
  const [e2, setE2] = useState<string>('8.6')
  const [e3, setE3] = useState<string>('8.4')
  const [e4, setE4] = useState<string>('8.5')
  const [neutralDeduction, setNeutralDeduction] = useState<string>('0.0')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Load championship data using judge_code
  const loadChampionshipData = async (code: string) => {
    setIsVerifying(true)
    setLoginError(null)

    try {
      const { data, error } = await supabase.rpc('get_championship_by_code', {
        p_code: code.trim(),
      })

      if (error) throw error
      if (!data || !data.championship) {
        throw new Error('Código de juez o campeonato no encontrado.')
      }

      const champ = data.championship
      const loadedGyms = (data.registrations || []) as unknown as LoadedGymnastOption[]
      const loadedApps = (data.apparatuses || []) as unknown as LoadedApparatus[]

      setGymnasts(loadedGyms)
      setApparatuses(loadedApps)

      if (loadedGyms.length > 0) {
        setSelectedRegId(loadedGyms[0].id)
        setIsObligatory(loadedGyms[0].scoring_regime === 'obligatory')
        setFixedD(loadedGyms[0].default_fixed_d_score?.toString() || '10.0')
      }

      if (loadedApps.length > 0) {
        setSelectedAppId(loadedApps[0].id)
      }

      return champ
    } catch (err: unknown) {
      setLoginError((err as Error).message)
      return null
    } finally {
      setIsVerifying(false)
    }
  }

  // Restore session on mount
  useEffect(() => {
    if (session) {
      loadChampionshipData(session.judgeCode)
    }
  }, [])

  // Auto-sync scoring regime when selected gymnast changes
  useEffect(() => {
    if (!selectedRegId) return
    const gym = gymnasts.find((g) => g.id === selectedRegId)
    if (gym) {
      const isOblig = gym.scoring_regime === 'obligatory'
      setIsObligatory(isOblig)
      setFixedD(gym.default_fixed_d_score?.toString() || '10.0')
    }
  }, [selectedRegId, gymnasts])

  const handleStartJudging = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputCode.trim() || !inputName.trim()) {
      setLoginError('Ingresa el código del torneo y tu nombre.')
      return
    }

    const champ = await loadChampionshipData(inputCode.trim())
    if (champ) {
      const newSession: FastJudgeSession = {
        judgeCode: inputCode.trim(),
        judgeName: inputName.trim(),
        apparatusCode: 'VT',
        championshipId: champ.id,
        championshipName: champ.name,
      }
      setSession(newSession)
      localStorage.setItem('operix_fast_judge_session', JSON.stringify(newSession))
    }
  }

  const handleLogout = () => {
    setSession(null)
    localStorage.removeItem('operix_fast_judge_session')
    setInputCode('')
    setInputName('')
  }

  // Pure FIG calculation
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

  const handleSubmitScore = async () => {
    if (!result || !session || !selectedRegId || !selectedAppId) {
      setSubmitError('Verifica la selección de gimnasta y aparato.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)

    const currentApp = apparatuses.find((a) => a.id === selectedAppId)
    const isVaultApp = currentApp?.code === 'VT'

    try {
      const { error } = await supabase.rpc('submit_fast_judge_score', {
        p_championship_id: session.championshipId,
        p_judge_code: session.judgeCode,
        p_registration_id: selectedRegId,
        p_apparatus_id: selectedAppId,
        p_judge_name: session.judgeName,
        p_d_score: result.dScore,
        p_e_scores: result.eScoresRaw,
        p_e_score_avg: result.eScoreAverage,
        p_neutral_deductions: result.neutralDeductions,
        p_final_score: result.finalScore,
        p_attempt_number: isVaultApp ? vaultAttempt : 1,
      })

      if (error) throw error

      setSubmitSuccess(
        isVaultApp
          ? `¡Salto ${vaultAttempt} (${result.finalScore.toFixed(3)}) enviado con éxito!`
          : `¡Puntuación ${result.finalScore.toFixed(3)} enviada con éxito a Mesa de Control!`
      )

      if (isVaultApp && vaultAttempt === 1) {
        setVaultAttempt(2)
      }
    } catch (err: unknown) {
      setSubmitError((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // IF NOT LOGGED IN: Fast PIN/Code Login Screen
  if (!session) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-6">
        <Card className="border-indigo-200 bg-white shadow-md p-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Acceso Rápido para Jurados</h3>
              <p className="text-xs text-slate-500">
                Ingresa con el código entregado por el club organizador. Sin necesidad de registrar correo ni contraseña.
              </p>
            </div>
          </div>

          {loginError && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleStartJudging} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código de Juez del Torneo
              </label>
              <input
                type="text"
                required
                placeholder="Ej. JUEZ-2026"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono font-bold tracking-wider uppercase text-blue-900 focus:border-indigo-600 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Demo activo: <strong className="font-mono text-slate-700">JUEZ-2026</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre y Apellido del Juez
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Claudia Muñoz"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full rounded-lg bg-indigo-700 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Award className="h-4 w-4" />
              {isVerifying ? 'Verificando Código...' : 'Entrar a Pista como Juez'}
            </button>
          </form>
        </Card>
      </div>
    )
  }

  // LOGGED IN: Fast Judge Scoring Pad
  const selectedGymnast = gymnasts.find((g) => g.id === selectedRegId)

  return (
    <div className="space-y-6">
      {/* Judge Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/60 via-white to-purple-50/30 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100/80 border border-indigo-200 text-indigo-700 shadow-2xs">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-indigo-700 text-[10px] text-white font-bold">
                Jurado de Pista
              </Badge>
              <span className="text-xs font-mono font-bold text-slate-800">
                {session.championshipName}
              </span>
            </div>
            <h3 className="text-base font-black tracking-tight text-slate-900 mt-0.5">
              Juez Oficial: {session.judgeName}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="success" className="text-[10px] flex items-center gap-1 font-bold">
            <Radio className="h-3 w-3 animate-pulse text-emerald-600" /> Transmisión Directa
          </Badge>
          <button
            type="button"
            onClick={handleLogout}
            title="Cerrar sesión de juez"
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </div>

      {submitSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{submitSuccess}</span>
        </div>
      )}

      {submitError && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <Card className="border-slate-200 bg-white shadow-sm p-4">
        {/* Athlete & Apparatus Picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-slate-500" /> Gimnasta en Pista
            </label>
            {gymnasts.length === 0 ? (
              <p className="text-xs text-amber-700 font-medium">
                No hay gimnastas registradas aún en el campeonato.
              </p>
            ) : (
              <select
                value={selectedRegId}
                onChange={(e) => setSelectedRegId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none"
              >
                {gymnasts.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.gymnast_name} • {g.club_name} ({g.category_name} — {g.scoring_regime === 'obligatory' ? 'Rutina Establecida' : 'Libre'})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Aparato Asignado</label>
            <div className="flex gap-1.5">
              {apparatuses.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedAppId(app.id)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold font-mono transition-colors ${
                    selectedAppId === app.id
                      ? 'bg-indigo-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {app.code}
                </button>
              ))}
            </div>

            {apparatuses.find((a) => a.id === selectedAppId)?.code === 'VT' && (
              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-indigo-100/60 p-2 text-xs border border-indigo-200">
                <span className="font-bold text-indigo-900 text-[11px]">Intento de Salto:</span>
                <div className="inline-flex rounded-md border border-indigo-300 bg-white p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setVaultAttempt(1)}
                    className={`rounded px-2.5 py-1 font-semibold transition-colors ${
                      vaultAttempt === 1 ? 'bg-indigo-700 text-white' : 'text-indigo-900 hover:bg-indigo-50'
                    }`}
                  >
                    Salto 1 (VT1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVaultAttempt(2)}
                    className={`rounded px-2.5 py-1 font-semibold transition-colors ${
                      vaultAttempt === 2 ? 'bg-indigo-700 text-white' : 'text-indigo-900 hover:bg-indigo-50'
                    }`}
                  >
                    Salto 2 (VT2)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedGymnast && (
          <div className="mb-4 flex items-center justify-between rounded-lg bg-indigo-50/50 p-2.5 text-xs border border-indigo-100">
            <div>
              <span className="font-semibold text-indigo-950">
                {selectedGymnast.category_name}
              </span>
              <span className="text-slate-500 ml-2">
                {isObligatory
                  ? `(Rutina Establecida • D Fija = ${fixedD})`
                  : '(Nivel Libre FIG • D evaluada en vivo)'}
              </span>
            </div>
            <Badge variant={isObligatory ? 'default' : 'outline'} className="text-[10px]">
              {isObligatory ? 'D Fija' : 'FIG D+E'}
            </Badge>
          </div>
        )}

        {calculationError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{calculationError}</span>
          </div>
        )}

        {/* Scoring Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="sm:col-span-2 space-y-4">
            {!isObligatory ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nota D (Dificultad evaluada por Jurado D)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={dScore}
                  onChange={(e) => setDScore(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nota D Preestablecida por Reglamento
                </label>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-2.5 text-sm font-mono font-bold text-indigo-950">
                  {fixedD} puntos base (Automática)
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Notas de Ejecución (Jueces E1 a E4)
                </label>
                <span className="text-[10px] text-slate-400">Descarte FIG de mayor y menor</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { val: e1, setter: setE1, label: 'E1' },
                  { val: e2, setter: setE2, label: 'E2' },
                  { val: e3, setter: setE3, label: 'E3' },
                  { val: e4, setter: setE4, label: 'E4' },
                ].map((item, idx) => (
                  <div key={idx}>
                    <span className="block text-[10px] font-bold text-slate-500 mb-0.5">{item.label}</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={item.val}
                      onChange={(e) => item.setter(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-center text-sm font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deducciones Neutrales (Línea, Tiempo, etc.)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={neutralDeduction}
                onChange={(e) => setNeutralDeduction(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-mono text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Result Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Puntuación Final Resultante
              </span>
              <div className="mt-2 text-3xl font-black font-mono text-indigo-950">
                {result ? result.finalScore.toFixed(3) : '0.000'}
              </div>

              {result && (
                <div className="mt-3 space-y-1 text-[11px] text-slate-500 border-t border-slate-200 pt-2 font-mono">
                  <div className="flex justify-between">
                    <span>Nota D:</span>
                    <strong className="text-slate-800">{result.dScore.toFixed(3)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Promedio E:</span>
                    <strong className="text-emerald-700">+{result.eScoreAverage.toFixed(3)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Deducción ND:</span>
                    <strong className="text-rose-600">-{result.neutralDeductions.toFixed(3)}</strong>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={isSubmitting || !result || gymnasts.length === 0}
              onClick={handleSubmitScore}
              className="mt-4 w-full rounded-lg bg-indigo-700 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Transmitiendo...' : 'Enviar a Mesa de Control'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
