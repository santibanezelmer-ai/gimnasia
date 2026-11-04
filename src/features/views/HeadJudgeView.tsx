import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/features/auth/AuthContext'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  Award,
  Download,
  AlertCircle,
  Radio,
  FileQuestion,
  RefreshCw,
  History,
  X,
  FileText,
  Scale,
} from 'lucide-react'

export interface HeadJudgeScoreItem {
  id: string
  championshipId: string
  gymnastName: string
  clubName: string
  categoryName: string
  scoringRegime: 'free' | 'obligatory'
  apparatusCode: string
  apparatusName: string
  bibNumber?: number
  dScore: number
  eScores: number[]
  eAvg: number
  nd: number
  finalScore: number
  status: 'draft' | 'submitted' | 'provisional' | 'official_approved'
  notes?: string
  createdAt: string
  approvedAt?: string
}

export interface ScoreAuditRecord {
  id: string
  score_id: string
  organization_id: string
  reason: string
  previous_value: Record<string, unknown>
  new_value: Record<string, unknown>
  created_at: string
}

export const HeadJudgeView: React.FC = () => {
  const { user } = useAuth()
  const [scores, setScores] = useState<HeadJudgeScoreItem[]>([])
  const [filterTab, setFilterTab] = useState<'pending' | 'approved'>('pending')
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isRealtimeActive, setIsRealtimeActive] = useState(false)

  // Modal: Apelación & Corrección Oficial
  const [adjustingScore, setAdjustingScore] = useState<HeadJudgeScoreItem | null>(null)
  const [adjDScore, setAdjDScore] = useState('')
  const [adjND, setAdjND] = useState('')
  const [adjReason, setAdjReason] = useState('')
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false)

  // Modal: Historial de Auditoría Inmutable
  const [auditScore, setAuditScore] = useState<HeadJudgeScoreItem | null>(null)
  const [auditLogs, setAuditLogs] = useState<ScoreAuditRecord[]>([])
  const [isLoadingAudits, setIsLoadingAudits] = useState(false)

  const loadScores = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMsg(null)

      const { data, error } = await supabase
        .from('scores')
        .select(`
          id,
          championship_id,
          registration_id,
          apparatus_id,
          d_score,
          e_scores,
          e_score_avg,
          neutral_deductions,
          final_score,
          status,
          notes,
          created_at,
          approved_at,
          apparatuses (
            code,
            name
          ),
          registrations (
            bib_number,
            gymnasts (
              first_name,
              last_name
            ),
            clubs (
              name
            ),
            categories (
              name,
              scoring_regime
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data) {
        const mapped: HeadJudgeScoreItem[] = (data as unknown as Record<string, unknown>[]).map((row) => {
          const app = row.apparatuses as { code: string; name: string } | null
          const reg = row.registrations as {
            bib_number?: number
            gymnasts: { first_name: string; last_name: string } | null
            clubs: { name: string } | null
            categories: { name: string; scoring_regime?: string } | null
          } | null

          const gym = reg?.gymnasts
          const club = reg?.clubs
          const cat = reg?.categories

          const rawEScores = Array.isArray(row.e_scores) ? (row.e_scores as number[]) : []

          return {
            id: row.id as string,
            championshipId: row.championship_id as string,
            gymnastName: gym ? `${gym.first_name} ${gym.last_name}` : 'Gimnasta',
            clubName: club?.name || 'Club',
            categoryName: cat?.name || 'General',
            scoringRegime: (cat?.scoring_regime === 'obligatory' ? 'obligatory' : 'free') as 'free' | 'obligatory',
            apparatusCode: app?.code || 'VT',
            apparatusName: app?.name || 'Aparato',
            bibNumber: reg?.bib_number,
            dScore: Number(row.d_score),
            eScores: rawEScores,
            eAvg: Number(row.e_score_avg),
            nd: Number(row.neutral_deductions),
            finalScore: Number(row.final_score),
            status: row.status as HeadJudgeScoreItem['status'],
            notes: (row.notes as string) ?? undefined,
            createdAt: row.created_at as string,
            approvedAt: (row.approved_at as string) ?? undefined,
          }
        })
        setScores(mapped)
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadScores()

    const channel = supabase
      .channel('head_judge_live_scores')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        () => {
          loadScores()
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadScores])

  const handleApprove = async (scoreId: string) => {
    setIsProcessing(scoreId)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const { error } = await supabase
        .from('scores')
        .update({
          status: 'official_approved',
          approved_by_user_id: user?.id || null,
          approved_at: new Date().toISOString(),
        })
        .eq('id', scoreId)

      if (error) throw error

      setSuccessMsg('¡Puntuación aprobada oficialmente y transmitida al medallero!')
      await loadScores()
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    } finally {
      setIsProcessing(null)
    }
  }

  // Abrir Modal de Apelación
  const handleOpenAdjustment = (item: HeadJudgeScoreItem) => {
    setAdjustingScore(item)
    setAdjDScore(item.dScore.toFixed(3))
    setAdjND(item.nd.toFixed(3))
    setAdjReason('')
  }

  // Guardar Resolución de Apelación y Corrección Oficial
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustingScore) return

    const cleanReason = adjReason.trim()
    if (!cleanReason) {
      setErrorMsg('Debes especificar el motivo oficial de la apelación o ajuste técnico.')
      return
    }

    const newD = parseFloat(adjDScore)
    const newND = parseFloat(adjND) || 0
    if (isNaN(newD) || newD < 0 || newD > 10.0) {
      setErrorMsg('La nota de Dificultad D debe estar entre 0.000 y 10.000.')
      return
    }

    setIsSavingAdjustment(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const newFinal = Math.round((newD + adjustingScore.eAvg - newND) * 1000) / 1000

      const { error } = await supabase
        .from('scores')
        .update({
          d_score: newD,
          neutral_deductions: newND,
          final_score: newFinal,
          status: 'official_approved',
          approved_by_user_id: user?.id || null,
          approved_at: new Date().toISOString(),
          notes: `[Resolución Apelación Jurado Superior]: ${cleanReason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', adjustingScore.id)

      if (error) throw error

      setSuccessMsg(
        `¡Apelación resuelta! Nota corregida a ${newFinal.toFixed(3)} y registrada en la pista de auditoría inmutable.`
      )
      setAdjustingScore(null)
      await loadScores()
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    } finally {
      setIsSavingAdjustment(false)
    }
  }

  // Abrir Historial Inmutable de Auditoría
  const handleOpenAudit = async (item: HeadJudgeScoreItem) => {
    setAuditScore(item)
    setIsLoadingAudits(true)
    setAuditLogs([])

    try {
      const { data, error } = await supabase
        .from('score_audits')
        .select('*')
        .eq('score_id', item.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAuditLogs((data as ScoreAuditRecord[]) || [])
    } catch (err: unknown) {
      console.warn('Error loading audit trail:', (err as Error).message)
    } finally {
      setIsLoadingAudits(false)
    }
  }

  const pendingScores = scores.filter((s) => s.status !== 'official_approved')
  const approvedScores = scores.filter((s) => s.status === 'official_approved')
  const activeList = filterTab === 'pending' ? pendingScores : approvedScores

  const handleExportPDF = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header with Title, Realtime Status & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 shadow-2xs">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black tracking-tight text-slate-900">
                Consola del Juez Árbitro (Superior Jury)
              </h3>
              {isRealtimeActive ? (
                <Badge variant="success" className="text-[10px] flex items-center gap-1 font-bold">
                  <Radio className="h-3 w-3 animate-pulse text-emerald-600" /> Realtime Sincronizado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Conectando...</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Revisión oficial de notas FIG, resolución de apelaciones (Score Inquiries) y pista de auditoría inmutable.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadScores}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 shadow-2xs transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar Acta Oficial</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3.5 text-xs text-rose-700 border border-rose-200 shadow-2xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3.5 text-xs text-emerald-800 border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Filter Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilterTab('pending')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterTab === 'pending'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Pendientes de Firma & Revisión
              <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-mono">
                {pendingScores.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('approved')}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterTab === 'approved'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Oficiales Aprobadas
              <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-mono">
                {approvedScores.length}
              </span>
            </button>
          </div>

          <Badge variant={filterTab === 'pending' ? 'warning' : 'success'} className="text-[10px] font-bold">
            {filterTab === 'pending' ? 'En espera de firma' : 'Firmadas & Públicas'}
          </Badge>
        </div>

        {/* Content List */}
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 font-medium">
            Consultando puntuaciones en vivo...
          </div>
        ) : activeList.length === 0 ? (
          <Card className="text-center py-12 border-dashed border-2 border-slate-200 bg-slate-50/50 rounded-2xl">
            <FileQuestion className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">
              {filterTab === 'pending'
                ? 'No hay puntuaciones pendientes de revisión'
                : 'Aún no se han emitido puntuaciones oficiales aprobadas'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {filterTab === 'pending'
                ? 'Las notas enviadas desde los paneles de jurado aparecerán aquí automáticamente en tiempo real.'
                : 'Aprueba puntuaciones pendientes para que pasen al registro oficial definitivo.'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeList.map((item) => (
              <Card
                key={item.id}
                className={`transition-all rounded-2xl p-5 ${
                  item.status === 'official_approved'
                    ? 'border-emerald-200 bg-emerald-50/15 shadow-2xs'
                    : 'border-indigo-200 bg-indigo-50/20 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{item.gymnastName}</h4>
                      {item.bibNumber && (
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                          #{item.bibNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.clubName} • {item.apparatusName} ({item.apparatusCode})
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] font-medium text-slate-700">{item.categoryName}</span>
                      <Badge variant={item.scoringRegime === 'obligatory' ? 'default' : 'outline'} className="text-[9px] font-bold">
                        {item.scoringRegime === 'obligatory' ? 'Rutina Establecida' : 'Nivel Libre'}
                      </Badge>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-white p-3.5 border border-slate-200 shadow-2xs">
                  <div className="flex justify-between items-center text-xs">
                    <span>
                      Nota D: <strong className="font-mono">{item.dScore.toFixed(3)}</strong>
                    </span>
                    <span>
                      Promedio E: <strong className="text-emerald-700 font-mono">+{item.eAvg.toFixed(3)}</strong>
                    </span>
                    <span>
                      ND: <strong className="text-rose-600 font-mono">-{item.nd.toFixed(3)}</strong>
                    </span>
                    <span className="text-base font-black text-blue-900 font-mono">
                      {item.finalScore.toFixed(3)}
                    </span>
                  </div>

                  {item.eScores && item.eScores.length > 0 && (
                    <p className="text-[10px] text-slate-500 mt-2 font-mono">
                      Jueces E: [{item.eScores.join(', ')}]
                    </p>
                  )}

                  {item.notes && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-2 mt-2 border border-amber-200 font-medium">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  {/* Audit Trail Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenAudit(item)}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-indigo-700 hover:underline"
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Pista de Auditoría</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Inquiry / Technical Adjustment Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenAdjustment(item)}
                      title="Resolver apelación técnica o ajustar nota por revisión de jurado superior"
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                    >
                      <Scale className="h-3.5 w-3.5 text-amber-600" />
                      <span>Apelación / Ajuste</span>
                    </button>

                    {item.status !== 'official_approved' && (
                      <button
                        type="button"
                        disabled={isProcessing === item.id}
                        onClick={() => handleApprove(item.id)}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 shadow-2xs disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{isProcessing === item.id ? 'Aprobando...' : 'Aprobar Oficial'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL: APELACIÓN TÉCNICA & AJUSTE OFICIAL DE NOTA (SCORE INQUIRY)
         ========================================================================= */}
      {adjustingScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-lg border-amber-300 bg-white shadow-2xl rounded-2xl p-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    Resolución de Apelación Técnica (FIG)
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {adjustingScore.gymnastName} • {adjustingScore.apparatusName} ({adjustingScore.apparatusCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingScore(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              {/* Current Score Summary */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs grid grid-cols-4 gap-2 text-center font-mono">
                <div>
                  <div className="text-[10px] text-slate-500">D Actual</div>
                  <div className="font-bold">{adjustingScore.dScore.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">E Actual</div>
                  <div className="font-bold text-emerald-700">+{adjustingScore.eAvg.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">ND Actual</div>
                  <div className="font-bold text-rose-600">-{adjustingScore.nd.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Final Actual</div>
                  <div className="font-black text-blue-900">{adjustingScore.finalScore.toFixed(3)}</div>
                </div>
              </div>

              {/* Adjustment Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nueva Nota Dificultad (D)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    required
                    value={adjDScore}
                    onChange={(e) => setAdjDScore(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deducciones Neutras (ND)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={adjND}
                    onChange={(e) => setAdjND(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Live Preview of Projected Final Score */}
              <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">Nota Final Proyectada:</span>
                <span className="font-mono text-lg font-black text-amber-950">
                  {(!isNaN(parseFloat(adjDScore))
                    ? Math.max(0, parseFloat(adjDScore) + adjustingScore.eAvg - (parseFloat(adjND) || 0)).toFixed(3)
                    : '-'
                  )}
                </span>
              </div>

              {/* Mandatory Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo Oficial de la Resolución / Corrección <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ej. Apelación D-Score aceptada: se acredita el elemento de giro en viga (+0.200 D)."
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustingScore(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdjustment}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow-xs disabled:opacity-50"
                >
                  {isSavingAdjustment ? 'Guardando en Auditoría...' : 'Guardar & Publicar Ajuste'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* =========================================================================
          MODAL: PISTA INMUTABLE DE AUDITORÍA (AUDIT TRAIL LOGS)
         ========================================================================= */}
      {auditScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <Card className="w-full max-w-xl border-slate-200 bg-white shadow-2xl rounded-2xl p-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900">
                    Pista Inmutable de Auditoría & Apelaciones
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {auditScore.gymnastName} • {auditScore.apparatusName} ({auditScore.apparatusCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditScore(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {isLoadingAudits ? (
                <div className="py-8 text-center text-xs text-slate-500">Cargando registros inmutables...</div>
              ) : auditLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <FileText className="mx-auto h-7 w-7 text-slate-300 mb-2" />
                  No existen modificaciones registradas para esta puntuación.
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => {
                    const prevFinal = log.previous_value?.final_score
                    const newFinal = log.new_value?.final_score
                    const prevD = log.previous_value?.d_score
                    const newD = log.new_value?.d_score

                    return (
                      <div
                        key={log.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-indigo-900">Modificación Oficial</span>
                          <span className="font-mono text-slate-400">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 font-medium">
                          {log.reason}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center font-mono text-[11px] pt-1">
                          <div className="bg-rose-50 text-rose-800 rounded p-1.5 border border-rose-200">
                            Nota Previa: Final {Number(prevFinal).toFixed(3)} (D: {Number(prevD).toFixed(3)})
                          </div>
                          <div className="bg-emerald-50 text-emerald-800 rounded p-1.5 border border-emerald-200">
                            Nota Corregida: Final {Number(newFinal).toFixed(3)} (D: {Number(newD).toFixed(3)})
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAuditScore(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

