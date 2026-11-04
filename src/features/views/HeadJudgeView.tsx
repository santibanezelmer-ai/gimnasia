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

export const HeadJudgeView: React.FC = () => {
  const { user } = useAuth()
  const [scores, setScores] = useState<HeadJudgeScoreItem[]>([])
  const [filterTab, setFilterTab] = useState<'pending' | 'approved'>('pending')
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isRealtimeActive, setIsRealtimeActive] = useState(false)

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

  const handleInquiry = async (scoreId: string) => {
    const reason = window.prompt('Ingrese el motivo de la observación o apelación técnica:')
    if (!reason || reason.trim() === '') return

    setIsProcessing(scoreId)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const { error } = await supabase
        .from('scores')
        .update({
          status: 'draft',
          notes: `[Observación Juez Árbitro]: ${reason.trim()}`,
        })
        .eq('id', scoreId)

      if (error) throw error

      setSuccessMsg('Puntuación observada y devuelta a la mesa de jurado para revisión.')
      await loadScores()
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    } finally {
      setIsProcessing(null)
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
              Revisión oficial de notas FIG, aprobación de resultados, resolución de apelaciones y actas.
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
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
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
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filterTab === 'pending'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Pendientes de Aprobación
              <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                {pendingScores.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('approved')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filterTab === 'approved'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Oficiales Aprobadas
              <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
                {approvedScores.length}
              </span>
            </button>
          </div>

          <Badge variant={filterTab === 'pending' ? 'warning' : 'success'} className="text-[10px]">
            {filterTab === 'pending' ? 'En espera de firma' : 'Firmadas & Públicas'}
          </Badge>
        </div>

        {/* Content List */}
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Consultando puntuaciones en vivo...
          </div>
        ) : activeList.length === 0 ? (
          <Card className="text-center py-12 border-dashed border-slate-200">
            <FileQuestion className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">
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
                className={`transition-all ${
                  item.status === 'official_approved'
                    ? 'border-emerald-100 bg-emerald-50/10'
                    : 'border-indigo-100 bg-indigo-50/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{item.gymnastName}</h4>
                      {item.bibNumber && (
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 rounded">
                          #{item.bibNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.clubName} • {item.apparatusName} ({item.apparatusCode})
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] font-medium text-slate-700">{item.categoryName}</span>
                      <Badge variant={item.scoringRegime === 'obligatory' ? 'default' : 'outline'} className="text-[9px]">
                        {item.scoringRegime === 'obligatory' ? 'Rutina Establecida' : 'Nivel Libre'}
                      </Badge>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="mt-4 rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
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
                    <p className="text-[10px] text-amber-700 bg-amber-50 rounded p-1.5 mt-2 border border-amber-200">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  {item.status !== 'official_approved' && (
                    <>
                      <button
                        type="button"
                        disabled={isProcessing === item.id}
                        onClick={() => handleInquiry(item.id)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Observar / Apelación
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing === item.id}
                        onClick={() => handleApprove(item.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 shadow-sm disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isProcessing === item.id ? 'Aprobando...' : 'Aprobar & Publicar Oficial'}
                      </button>
                    </>
                  )}
                  {item.status === 'official_approved' && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Firma Oficial Registrada
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
