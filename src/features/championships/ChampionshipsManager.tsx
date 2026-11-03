import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useOrganization } from '@/features/organizations/OrganizationContext'
import type { Championship, ChampionshipVisibility, ChampionshipStatus } from '@/core/types/championship'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Plus, Calendar, MapPin, Eye, Settings2, AlertCircle } from 'lucide-react'

export const ChampionshipsManager: React.FC = () => {
  const { activeOrganization, activeRole } = useOrganization()
  const [championships, setChampionships] = useState<Championship[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [venueName, setVenueName] = useState('')
  const [visibility, setVisibility] = useState<ChampionshipVisibility>('public')
  const [rulesetVersion, setRulesetVersion] = useState('FIG_2025_2028_V1')

  const canManage = activeRole === 'org_admin' || activeRole === 'competition_manager'

  const loadChampionships = useCallback(async () => {
    if (!activeOrganization) {
      setChampionships([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMsg(null)
      const { data, error } = await supabase
        .from('championships')
        .select('*')
        .eq('organization_id', activeOrganization.id)
        .order('start_date', { ascending: false })

      if (error) throw error

      setChampionships(
        (data || []).map((row) => ({
          id: row.id,
          organizationId: row.organization_id,
          name: row.name,
          slug: row.slug,
          description: row.description ?? undefined,
          startDate: row.start_date,
          endDate: row.end_date,
          location: row.location ?? undefined,
          venueName: row.venue_name ?? undefined,
          visibility: row.visibility,
          status: row.status,
          rulesetVersion: row.ruleset_version,
          scoringSchemaVersion: row.scoring_schema_version,
          bannerUrl: row.banner_url ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      )
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [activeOrganization])

  useEffect(() => {
    loadChampionships()
  }, [loadChampionships])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrganization) return

    try {
      setErrorMsg(null)
      const { error } = await supabase.from('championships').insert({
        organization_id: activeOrganization.id,
        name,
        slug,
        start_date: startDate,
        end_date: endDate,
        location: location || null,
        venue_name: venueName || null,
        visibility,
        status: 'draft',
        ruleset_version: rulesetVersion,
        scoring_schema_version: 'FIG_STANDARD_V1',
      })

      if (error) throw error

      setIsCreating(false)
      setName('')
      setSlug('')
      setStartDate('')
      setEndDate('')
      setLocation('')
      setVenueName('')
      await loadChampionships()
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    }
  }

  const statusBadges: Record<ChampionshipStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'outline' }> = {
    draft: { label: 'Borrador', variant: 'outline' },
    registration_open: { label: 'Inscripciones Abiertas', variant: 'success' },
    registration_closed: { label: 'Inscripciones Cerradas', variant: 'warning' },
    in_progress: { label: 'En Progreso / En Vivo', variant: 'default' },
    completed: { label: 'Finalizado', variant: 'success' },
    archived: { label: 'Archivado', variant: 'outline' },
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-blue-700" />
            Campeonatos de la Organización
          </h3>
          <p className="text-xs text-slate-500">
            Administra los torneos, reglamento técnico congelado, visibilidad y cronograma.
          </p>
        </div>

        {canManage && !isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Campeonato
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isCreating && (
        <Card className="border-blue-200 bg-blue-50/30">
          <h4 className="text-sm font-bold text-slate-900 mb-4">Crear Nuevo Campeonato</h4>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre del Campeonato</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Campeonato Nacional GAF Apertura 2026"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Slug URL</label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fecha de Inicio</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fecha de Término</label>
                <input
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ciudad / Ubicación</label>
                <input
                  type="text"
                  placeholder="Ej. Santiago, Chile"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Gimnasio / Recinto</label>
                <input
                  type="text"
                  placeholder="Ej. Polideportivo Estadio Nacional"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Visibilidad</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as ChampionshipVisibility)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                >
                  <option value="public">Público (Visible en portal de resultados)</option>
                  <option value="private">Privado (Solo organizador)</option>
                  <option value="invitational">Por Invitación (Solo clubes autorizados)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Código de Puntuación (Reglamento)</label>
                <select
                  value={rulesetVersion}
                  onChange={(e) => setRulesetVersion(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                >
                  <option value="FIG_2025_2028_V1">FIG Código de Puntuación 2025-2028</option>
                  <option value="USAG_DEVELOPMENT_2024">USAG Niveles 1 al 10 (2024)</option>
                  <option value="ESCOLAR_FORMATIVO_V1">Reglamento Escolar / Promocional</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Guardar Campeonato
              </button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Cargando campeonatos...</div>
      ) : championships.length === 0 ? (
        <Card className="text-center py-8">
          <Trophy className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No hay campeonatos creados aún</p>
          <p className="text-xs text-slate-500 mt-1">Crea el primer campeonato para comenzar a configurar categorías y aparatos.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {championships.map((champ) => {
            const statusInfo = statusBadges[champ.status]
            return (
              <Card key={champ.id} className="hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{champ.name}</h4>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">{champ.slug}</p>
                  </div>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{champ.startDate} al {champ.endDate}</span>
                  </div>
                  {champ.venueName && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{champ.venueName}{champ.location ? ` • ${champ.location}` : ''}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                      Reglamento: {champ.rulesetVersion}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {champ.visibility}
                  </span>
                  <button
                    type="button"
                    className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                  >
                    Configurar Categorías & Jurado →
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
